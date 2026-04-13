// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/IFeeVault.sol";

/// @title PostMigrationPool — Uni-V2 style AMM with 3-way fee split
/// @notice Created by PostMigrationFactory after a token graduates.
///         LP token is this ERC-20 itself (cloneable via EIP-1167).
///
///  Fee schedule — ALWAYS 0.40 % total (no variable rate)
///  ────────────────────────────────────────────────────────
///  protocol  0.20 %  ·  creator 0.05 %  ·  LP 0.15 %
///  ────────────────────────────────────────────────────────
///  When activeLPSupply == 0 the LP portion redirects to protocol.
///
///  ALL fee USDC is held by FeeVault (single custody).
///  This contract holds only AMM reserve USDC — zero fee USDC.
///  LP fees are tracked via a fee-per-share accumulator here,
///  but actual payouts go through FeeVault.releaseLPFee().
contract PostMigrationPool is ERC20Upgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ══════════════════════════════════════════════════════════════════
       CONSTANTS
    ══════════════════════════════════════════════════════════════════ */
    uint256 public constant TOTAL_FEE_BPS    = 40;  // 0.40 % always
    uint256 public constant PROTOCOL_FEE_BPS = 20;  // 0.20 %
    uint256 public constant CREATOR_FEE_BPS  =  5;  // 0.05 %
    uint256 public constant LP_FEE_BPS       = 15;  // 0.15 %
    uint256 private constant BPS = 10_000;

    address private constant DEAD = address(0xdEaD);
    uint256 private constant LP_PRECISION = 1e18;

    /* ══════════════════════════════════════════════════════════════════
       STORAGE
    ══════════════════════════════════════════════════════════════════ */
    address public token;
    address public feeVault;
    address public creator;
    address public referrer;

    uint256 public tokenReserve;
    uint256 public usdcReserve;

    uint256 public burnedLP;  // seed LP minted to DEAD address

    /* ── LP fee-per-share accumulator ──────────────────────────────── */
    uint256 public lpFeePerShareAccumulated;           // scaled by LP_PRECISION
    mapping(address => uint256) public lpFeeDebt;      // per-user debt
    mapping(address => uint256) public lpFeeClaimable;  // pending claimable

    /* ── init guard: handled by OZ Initializable (inherited via ERC20Upgradeable) ── */

    /* ══════════════════════════════════════════════════════════════════
       EVENTS
    ══════════════════════════════════════════════════════════════════ */
    event Swap(
        address indexed sender,
        address indexed to,
        uint256 tokenIn,
        uint256 usdcIn,
        uint256 tokenOut,
        uint256 usdcOut
    );
    event LiquidityAdded(
        address indexed provider,
        address indexed to,
        uint256 tokenAmount,
        uint256 usdcAmount,
        uint256 lpMinted
    );
    event LiquidityRemoved(
        address indexed provider,
        address indexed to,
        uint256 tokenAmount,
        uint256 usdcAmount,
        uint256 lpBurned
    );
    event LPFeesClaimed(address indexed user, uint256 amount);

    /* ══════════════════════════════════════════════════════════════════
       CONSTRUCTOR (disable implementation)
    ══════════════════════════════════════════════════════════════════ */
    constructor() {
        _disableInitializers();
    }

    /* ══════════════════════════════════════════════════════════════════
       INITIALIZE  (called once by PostMigrationFactory)
    ══════════════════════════════════════════════════════════════════ */
    function init(
        address _token,
        address _feeVault,
        address _creator,
        address _referrer,
        uint256 _tokenAmount,
        uint256 _usdcAmount
    ) external payable initializer {
        require(msg.value == _usdcAmount, "Pool: USDC mismatch");
        require(_tokenAmount > 0 && _usdcAmount > 0, "Pool: zero amount");

        __ERC20_init("Duude LP", "dLP");

        token    = _token;
        feeVault = _feeVault;
        creator  = _creator;
        referrer = _referrer;

        tokenReserve = _tokenAmount;
        usdcReserve  = _usdcAmount;

        // seed LP = sqrt(tokenAmount * usdcAmount)  → burned permanently
        uint256 seedLP = Math.sqrt(_tokenAmount * _usdcAmount);
        require(seedLP > 0, "Pool: insufficient seed liquidity");

        _mint(DEAD, seedLP);
        burnedLP = seedLP;
    }

    /* ══════════════════════════════════════════════════════════════════
       LP FEE-PER-SHARE HOOK — runs on every LP balance change
    ══════════════════════════════════════════════════════════════════ */

    /// @dev Checkpoint a user's pending LP fees BEFORE their balance changes.
    function _checkpointLP(address user) internal {
        uint256 bal = balanceOf(user);
        if (bal > 0) {
            uint256 pending = (bal * lpFeePerShareAccumulated / LP_PRECISION)
                              - lpFeeDebt[user];
            if (pending > 0) {
                lpFeeClaimable[user] += pending;
            }
        }
    }

    /// @dev Override ERC-20 _update to intercept all transfers/mints/burns.
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override {
        // checkpoint BEFORE balance change
        if (from != address(0) && from != DEAD) _checkpointLP(from);
        if (to   != address(0) && to   != DEAD) _checkpointLP(to);

        super._update(from, to, amount);

        // reset debt AFTER balance change
        if (from != address(0) && from != DEAD) {
            lpFeeDebt[from] = balanceOf(from) * lpFeePerShareAccumulated / LP_PRECISION;
        }
        if (to != address(0) && to != DEAD) {
            lpFeeDebt[to] = balanceOf(to) * lpFeePerShareAccumulated / LP_PRECISION;
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       SWAP
    ══════════════════════════════════════════════════════════════════ */
    /// @param tokenOut Desired token output (set 0 when selling tokens)
    /// @param usdcOut  Desired USDC output  (set 0 when buying tokens)
    /// @param to       Recipient
    /// @param maxIn    Maximum input the caller is willing to spend
    function swap(
        uint256 tokenOut,
        uint256 usdcOut,
        address to,
        uint256 maxIn
    ) external payable nonReentrant {
        require((tokenOut > 0) != (usdcOut > 0), "Pool: exactly one output");
        require(to != address(0), "Pool: zero address");

        if (tokenOut > 0) {
            _swapUSDCForTokens(tokenOut, to, maxIn);
        } else {
            _swapTokensForUSDC(usdcOut, to, maxIn);
        }
    }

    /* ── buy tokens with USDC ──────────────────────────────────────── */
    function _swapUSDCForTokens(
        uint256 tokenOut,
        address to,
        uint256 maxIn
    ) internal {
        require(tokenOut < tokenReserve, "Pool: insufficient token reserve");

        // AMM: how much net USDC is needed for `tokenOut` tokens
        uint256 usdcInNet = (usdcReserve * tokenOut + (tokenReserve - tokenOut - 1))
                            / (tokenReserve - tokenOut); // round up

        // gross = net / (1 − feePct)  →  net * BPS / (BPS − TOTAL_FEE_BPS)  round up
        uint256 usdcInGross = (usdcInNet * BPS + (BPS - TOTAL_FEE_BPS - 1))
                              / (BPS - TOTAL_FEE_BPS);
        uint256 totalFee = usdcInGross - usdcInNet;

        require(msg.value >= usdcInGross, "Pool: insufficient USDC sent");
        require(usdcInGross <= maxIn, "Pool: exceeds maxIn");

        // effects
        tokenReserve -= tokenOut;
        usdcReserve  += usdcInNet;

        // fee distribution → ALL to FeeVault
        _distributeFees(totalFee);

        // send tokens to buyer
        IERC20(token).safeTransfer(to, tokenOut);

        // refund excess
        uint256 refund = msg.value - usdcInGross;
        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok, "Pool: refund failed");
        }

        emit Swap(msg.sender, to, 0, usdcInGross, tokenOut, 0);
    }

    /* ── sell tokens for USDC ──────────────────────────────────────── */
    function _swapTokensForUSDC(
        uint256 usdcOut,
        address to,
        uint256 maxIn
    ) internal {
        // gross USDC that must leave reserves (before fee split)
        // usdcOut is net (what receiver gets); gross = out / (1 - fee%)
        uint256 usdcOutGross = (usdcOut * BPS + (BPS - TOTAL_FEE_BPS - 1))
                               / (BPS - TOTAL_FEE_BPS);
        uint256 totalFee = usdcOutGross - usdcOut;

        require(usdcOutGross <= usdcReserve, "Pool: insufficient USDC reserve");

        // AMM: how many tokens are needed to extract usdcOutGross
        uint256 tokensIn = (tokenReserve * usdcOutGross + (usdcReserve - usdcOutGross - 1))
                           / (usdcReserve - usdcOutGross); // round up

        require(tokensIn <= maxIn, "Pool: exceeds maxIn");

        // effects
        tokenReserve += tokensIn;
        usdcReserve  -= usdcOutGross;

        // interactions
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokensIn);

        // fee distribution → ALL to FeeVault
        _distributeFees(totalFee);

        (bool ok, ) = to.call{value: usdcOut}("");
        require(ok, "Pool: transfer failed");

        emit Swap(msg.sender, to, tokensIn, 0, 0, usdcOut);
    }

    /* ══════════════════════════════════════════════════════════════════
       ADD LIQUIDITY
    ══════════════════════════════════════════════════════════════════ */
    /// @param tokenAmount Tokens to deposit (must be approved)
    /// @param minLPOut    Minimum LP tokens to receive
    /// @param to          LP recipient
    function addLiquidity(
        uint256 tokenAmount,
        uint256 minLPOut,
        address to
    ) external payable nonReentrant {
        require(to != address(0), "Pool: zero address");
        require(tokenAmount > 0 && msg.value > 0, "Pool: zero amounts");

        uint256 _totalSupply = totalSupply();

        // proportional amounts
        uint256 lpFromTokens = (tokenAmount * _totalSupply) / tokenReserve;
        uint256 lpFromUSDC   = (msg.value   * _totalSupply) / usdcReserve;
        uint256 lpToMint     = lpFromTokens < lpFromUSDC ? lpFromTokens : lpFromUSDC;
        require(lpToMint >= minLPOut, "Pool: slippage");

        // actual amounts used (based on the binding ratio)
        uint256 actualToken;
        uint256 actualUSDC;
        if (lpFromTokens <= lpFromUSDC) {
            actualToken = tokenAmount;
            actualUSDC  = (lpToMint * usdcReserve + _totalSupply - 1) / _totalSupply; // round up
        } else {
            actualUSDC  = msg.value;
            actualToken = (lpToMint * tokenReserve + _totalSupply - 1) / _totalSupply; // round up
        }

        // effects
        tokenReserve += actualToken;
        usdcReserve  += actualUSDC;

        // interactions
        IERC20(token).safeTransferFrom(msg.sender, address(this), actualToken);
        _mint(to, lpToMint);

        // refund excess USDC
        uint256 refundUSDC = msg.value - actualUSDC;
        if (refundUSDC > 0) {
            (bool ok, ) = msg.sender.call{value: refundUSDC}("");
            require(ok, "Pool: refund failed");
        }

        emit LiquidityAdded(msg.sender, to, actualToken, actualUSDC, lpToMint);
    }

    /* ══════════════════════════════════════════════════════════════════
       REMOVE LIQUIDITY  (auto-claims LP fees)
    ══════════════════════════════════════════════════════════════════ */
    function removeLiquidity(
        uint256 lpAmount,
        uint256 minToken,
        uint256 minUSDC,
        address to
    ) external nonReentrant {
        require(to != address(0), "Pool: zero address");
        require(lpAmount > 0, "Pool: zero LP");
        require(balanceOf(msg.sender) >= lpAmount, "Pool: insufficient LP");

        uint256 _totalSupply = totalSupply();
        uint256 tokenOut = (lpAmount * tokenReserve) / _totalSupply;
        uint256 usdcOut  = (lpAmount * usdcReserve)  / _totalSupply;

        require(tokenOut >= minToken, "Pool: token slippage");
        require(usdcOut  >= minUSDC,  "Pool: USDC slippage");

        // auto-claim pending LP fees for the user
        _claimLPFeesInternal(msg.sender);

        // effects
        tokenReserve -= tokenOut;
        usdcReserve  -= usdcOut;

        // burn LP (triggers _update → checkpoint)
        _burn(msg.sender, lpAmount);

        // interactions
        IERC20(token).safeTransfer(to, tokenOut);
        (bool ok, ) = to.call{value: usdcOut}("");
        require(ok, "Pool: transfer failed");

        emit LiquidityRemoved(msg.sender, to, tokenOut, usdcOut, lpAmount);
    }

    /* ══════════════════════════════════════════════════════════════════
       CLAIM LP FEES
    ══════════════════════════════════════════════════════════════════ */
    function claimLPFees() external nonReentrant {
        _claimLPFeesInternal(msg.sender);
    }

    function _claimLPFeesInternal(address user) internal {
        // force checkpoint
        _checkpointLP(user);
        lpFeeDebt[user] = balanceOf(user) * lpFeePerShareAccumulated / LP_PRECISION;

        uint256 amount = lpFeeClaimable[user];
        if (amount == 0) return;

        lpFeeClaimable[user] = 0;

        // Release from FeeVault (which holds the actual USDC)
        IFeeVault(feeVault).releaseLPFee(user, amount);
        emit LPFeesClaimed(user, amount);
    }

    /* ══════════════════════════════════════════════════════════════════
       FEE DISTRIBUTION (internal)
    ══════════════════════════════════════════════════════════════════ */

    function _activeLPSupply() internal view returns (uint256) {
        return totalSupply() - burnedLP;
    }

    /// @dev Split `totalFee` native USDC among protocol, creator, (LP).
    ///      ALL USDC is sent to FeeVault in a single call.
    ///      When there are no active LP providers, the LP portion
    ///      is redirected to protocol (prevents stuck funds).
    function _distributeFees(uint256 totalFee) internal {
        if (totalFee == 0) return;

        uint256 activeLP = _activeLPSupply();
        uint256 protocolFee;
        uint256 creatorFee;
        uint256 lpFee;

        if (activeLP > 0) {
            // Standard 3-way split
            protocolFee = (totalFee * PROTOCOL_FEE_BPS) / TOTAL_FEE_BPS;
            creatorFee  = (totalFee * CREATOR_FEE_BPS)  / TOTAL_FEE_BPS;
            lpFee       = totalFee - protocolFee - creatorFee; // remainder → LP (handles dust)
        } else {
            // No active LPs — LP portion redirected to protocol
            protocolFee = (totalFee * (PROTOCOL_FEE_BPS + LP_FEE_BPS)) / TOTAL_FEE_BPS;
            creatorFee  = totalFee - protocolFee; // remainder → creator (handles dust)
        }

        // Update fee-per-share accumulator BEFORE depositing to vault
        if (lpFee > 0 && activeLP > 0) {
            lpFeePerShareAccumulated += (lpFee * LP_PRECISION) / activeLP;
        }

        // ALL fees go to FeeVault in one call
        IFeeVault(feeVault).depositFee{value: totalFee}(
            creator,
            referrer,
            protocolFee,
            creatorFee,
            lpFee
        );
    }

    /* ══════════════════════════════════════════════════════════════════
       VIEW HELPERS
    ══════════════════════════════════════════════════════════════════ */

    function spotPrice() external view returns (uint256) {
        if (tokenReserve == 0) return 0;
        return (usdcReserve * 1e18) / tokenReserve;
    }

    function getLPBalance(address user) external view returns (uint256) {
        return balanceOf(user);
    }

    function getLPFeeClaimable(address user) external view returns (uint256) {
        uint256 bal = balanceOf(user);
        uint256 pending;
        if (bal > 0) {
            pending = (bal * lpFeePerShareAccumulated / LP_PRECISION) - lpFeeDebt[user];
        }
        return lpFeeClaimable[user] + pending;
    }

    function getPoolStats() external view returns (
        uint256 tokenReserve_,
        uint256 usdcReserve_,
        uint256 totalLPSupply_,
        uint256 activeLPSupply_,
        uint256 spotPrice_
    ) {
        tokenReserve_   = tokenReserve;
        usdcReserve_    = usdcReserve;
        totalLPSupply_  = totalSupply();
        activeLPSupply_ = totalLPSupply_ - burnedLP;
        spotPrice_      = tokenReserve > 0 ? (usdcReserve * 1e18) / tokenReserve : 0;
    }

    /* ── accept native USDC (needed for receiving USDC during swaps/liquidity) ── */
    receive() external payable {}
}
