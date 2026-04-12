// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/ITokenFactory.sol";
import "./interfaces/IFeeVault.sol";
import "./interfaces/IPostMigrationFactory.sol";

/// @title BondingCurve — virtual-reserve constant-product curve (pump.fun style)
/// @notice VIRTUAL_USDC = 300, graduation at 2 500 USDC net raised.
///         0.3 % fee on every trade → protocol only (no creator/referral in
///         bonding phase). Graduation supports partial-fill so the last buy
///         never overshoots. Tracks rich arena-metrics on-chain.
contract BondingCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ══════════════════════════════════════════════════════════════════
       CONSTANTS
    ══════════════════════════════════════════════════════════════════ */
    uint256 public constant VIRTUAL_USDC   = 300e18;
    uint256 public constant VIRTUAL_TOKENS = 100_000_000_000e18;  // 100 B
    uint256 public constant K              = VIRTUAL_USDC * VIRTUAL_TOKENS; // 3 e49
    uint256 public constant GRADUATION_TARGET = 2_500e18;
    uint256 public constant FEE_BPS = 30;   // 0.3 %
    uint256 private constant BPS    = 10_000;

    /* ══════════════════════════════════════════════════════════════════
       STORAGE  (set once via initialize)
    ══════════════════════════════════════════════════════════════════ */
    address public token;
    address public creator;
    address public referrer;
    address public feeVault;
    address public factory;
    address public postMigrationFactory;

    bool public graduated;
    uint256 public realUSDCRaised;
    uint256 public realTokensSold;

    /* ── arena metrics ─────────────────────────────────────────────── */
    uint256 public totalBuyVolume;
    uint256 public totalSellVolume;
    uint256 public buyCount;
    uint256 public sellCount;
    uint256 public uniqueBuyerCount;
    uint256 public holderCount;

    mapping(address => uint256) public holderBalance;
    mapping(address => uint256) public firstBuyTimestamp;
    mapping(address => bool)    private _isUniqueBuyer;

    /* ── init guard ────────────────────────────────────────────────── */
    bool private _initialized;

    /* ══════════════════════════════════════════════════════════════════
       EVENTS
    ══════════════════════════════════════════════════════════════════ */
    event Buy(
        address indexed buyer,
        address indexed recipient,
        uint256 usdcIn,
        uint256 tokensOut,
        uint256 fee
    );
    event Sell(
        address indexed seller,
        uint256 tokensIn,
        uint256 usdcOut,
        uint256 fee
    );
    event Graduated(
        address indexed token_,
        address indexed pool,
        uint256 usdcLiquidity,
        uint256 tokenLiquidity
    );

    /* ══════════════════════════════════════════════════════════════════
       CONSTRUCTOR (implementation — disable init)
    ══════════════════════════════════════════════════════════════════ */
    constructor() {
        _initialized = true;
    }

    /* ══════════════════════════════════════════════════════════════════
       MODIFIERS
    ══════════════════════════════════════════════════════════════════ */
    modifier notPaused() {
        require(!ITokenFactory(factory).isPaused(token), "BondingCurve: paused");
        _;
    }

    modifier notGraduated() {
        require(!graduated, "BondingCurve: graduated");
        _;
    }

    /* ══════════════════════════════════════════════════════════════════
       INITIALIZE (called once per clone)
    ══════════════════════════════════════════════════════════════════ */
    function initialize(
        address _token,
        address _creator,
        address _referrer,
        address _feeVault,
        address _factory,
        address _postMigrationFactory
    ) external {
        require(!_initialized, "BondingCurve: already initialized");
        _initialized = true;

        token                = _token;
        creator              = _creator;
        referrer             = _referrer;
        feeVault             = _feeVault;
        factory              = _factory;
        postMigrationFactory = _postMigrationFactory;
    }

    /* ══════════════════════════════════════════════════════════════════
       BUY
    ══════════════════════════════════════════════════════════════════ */
    /// @param minTokensOut Slippage guard (0 = no guard)
    /// @param recipient    Where the bought tokens are sent
    function buy(
        uint256 minTokensOut,
        address recipient
    ) external payable nonReentrant notPaused notGraduated {
        require(msg.value > 0, "BondingCurve: zero value");
        require(recipient != address(0), "BondingCurve: zero recipient");

        /* ── fee ──────────────────────────────────────────────────── */
        uint256 fee    = (msg.value * FEE_BPS) / BPS;
        uint256 usdcNet = msg.value - fee;

        /* ── graduation partial fill ──────────────────────────────── */
        uint256 remaining = GRADUATION_TARGET - realUSDCRaised;
        bool    willGraduate;
        uint256 refund;

        if (usdcNet >= remaining) {
            // only use what is needed to reach exactly 1 500 USDC
            uint256 usdcToUse = remaining;
            // gross amount that produces `usdcToUse` net after fee
            uint256 grossUsed = (usdcToUse * BPS + (BPS - FEE_BPS - 1)) / (BPS - FEE_BPS);
            refund  = msg.value - grossUsed;
            fee     = grossUsed - usdcToUse;
            usdcNet = usdcToUse;
            willGraduate = true;
        }

        /* ── constant product ─────────────────────────────────────── */
        uint256 effectiveUSDC      = VIRTUAL_USDC + realUSDCRaised;
        uint256 newEffectiveUSDC   = effectiveUSDC + usdcNet;
        uint256 effectiveTokens    = VIRTUAL_TOKENS - realTokensSold;
        uint256 tokensOut          = effectiveTokens - (K / newEffectiveUSDC);

        require(tokensOut >= minTokensOut, "BondingCurve: slippage");
        require(tokensOut <= effectiveTokens, "BondingCurve: insufficient tokens");

        /* ── effects (CEI) ────────────────────────────────────────── */
        realUSDCRaised  += usdcNet;
        realTokensSold  += tokensOut;
        totalBuyVolume  += usdcNet;
        buyCount++;

        // unique buyers
        if (!_isUniqueBuyer[recipient]) {
            _isUniqueBuyer[recipient] = true;
            uniqueBuyerCount++;
            firstBuyTimestamp[recipient] = block.timestamp;
        }

        // holder tracking (curve-side approximation)
        if (holderBalance[recipient] == 0) holderCount++;
        holderBalance[recipient] += tokensOut;

        emit Buy(msg.sender, recipient, usdcNet, tokensOut, fee);

        /* ── interactions ─────────────────────────────────────────── */
        // 1. fee → FeeVault
        if (fee > 0) {
            IFeeVault(feeVault).depositProtocolFee{value: fee}();
        }

        // 2. tokens → recipient
        IERC20(token).safeTransfer(recipient, tokensOut);

        // 3. refund excess
        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok, "BondingCurve: refund failed");
        }

        // 4. graduate
        if (willGraduate) {
            _graduate();
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       SELL
    ══════════════════════════════════════════════════════════════════ */
    /// @param tokensIn    Amount of tokens to sell back to the curve
    /// @param minUSDCOut  Minimum USDC the seller expects (slippage guard)
    function sell(
        uint256 tokensIn,
        uint256 minUSDCOut
    ) external nonReentrant notPaused notGraduated {
        require(tokensIn > 0, "BondingCurve: zero tokens");

        /* ── constant product ─────────────────────────────────────── */
        uint256 effectiveUSDC       = VIRTUAL_USDC + realUSDCRaised;
        uint256 effectiveTokensAfter = VIRTUAL_TOKENS - realTokensSold + tokensIn;
        uint256 usdcOutGross        = effectiveUSDC - (K / effectiveTokensAfter);

        require(usdcOutGross <= realUSDCRaised, "BondingCurve: insufficient USDC");

        uint256 fee       = (usdcOutGross * FEE_BPS) / BPS;
        uint256 usdcOutNet = usdcOutGross - fee;

        require(usdcOutNet >= minUSDCOut, "BondingCurve: slippage");

        /* ── effects (CEI) ────────────────────────────────────────── */
        realUSDCRaised -= usdcOutGross;
        realTokensSold -= tokensIn;
        totalSellVolume += usdcOutGross;
        sellCount++;

        // holder tracking (safe against off-curve transfers)
        uint256 prevBal = holderBalance[msg.sender];
        if (prevBal > 0) {
            if (tokensIn >= prevBal) {
                holderBalance[msg.sender] = 0;
                holderCount--;
            } else {
                holderBalance[msg.sender] = prevBal - tokensIn;
            }
        }

        emit Sell(msg.sender, tokensIn, usdcOutNet, fee);

        /* ── interactions ─────────────────────────────────────────── */
        // 1. pull tokens from seller
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokensIn);

        // 2. fee → FeeVault
        if (fee > 0) {
            IFeeVault(feeVault).depositProtocolFee{value: fee}();
        }

        // 3. USDC → seller
        (bool ok, ) = msg.sender.call{value: usdcOutNet}("");
        require(ok, "BondingCurve: transfer failed");
    }

    /* ══════════════════════════════════════════════════════════════════
       GRADUATION (internal)
    ══════════════════════════════════════════════════════════════════ */
    function _graduate() internal {
        graduated = true;

        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        uint256 usdcBalance  = realUSDCRaised;

        // approve tokens for PostMigrationFactory to pull
        IERC20(token).approve(postMigrationFactory, tokenBalance);

        // create the pool (sends USDC + tokens)
        address pool = IPostMigrationFactory(postMigrationFactory).createPool{value: usdcBalance}(
            token,
            creator,
            referrer,
            tokenBalance
        );

        emit Graduated(token, pool, usdcBalance, tokenBalance);

        // notify factory (authorises pool in FeeVault, updates records)
        ITokenFactory(factory).onGraduation(token, pool);
    }

    /* ══════════════════════════════════════════════════════════════════
       VIEW HELPERS
    ══════════════════════════════════════════════════════════════════ */

    /// @return price  Current marginal price in USDC per token, scaled 1e18
    function spotPrice() external view returns (uint256 price) {
        uint256 effUSDC   = VIRTUAL_USDC + realUSDCRaised;
        uint256 effTokens = VIRTUAL_TOKENS - realTokensSold;
        price = (effUSDC * 1e18) / effTokens;
    }

    function quoteBuy(uint256 usdcIn)
        external view returns (uint256 tokensOut, uint256 priceImpactBps)
    {
        uint256 fee     = (usdcIn * FEE_BPS) / BPS;
        uint256 usdcNet = usdcIn - fee;

        uint256 effUSDC    = VIRTUAL_USDC + realUSDCRaised;
        uint256 newEffUSDC = effUSDC + usdcNet;
        uint256 effTokens  = VIRTUAL_TOKENS - realTokensSold;
        tokensOut = effTokens - (K / newEffUSDC);

        // price impact = (avgPrice − spotPrice) / spotPrice
        if (tokensOut > 0) {
            uint256 spotScaled = (effUSDC * 1e18) / effTokens;
            uint256 avgScaled  = (usdcNet * 1e18) / tokensOut;
            if (avgScaled > spotScaled) {
                priceImpactBps = ((avgScaled - spotScaled) * BPS) / spotScaled;
            }
        }
    }

    function quoteSell(uint256 tokensIn)
        external view returns (uint256 usdcOut, uint256 priceImpactBps)
    {
        uint256 effUSDC       = VIRTUAL_USDC + realUSDCRaised;
        uint256 effTokensAfter = VIRTUAL_TOKENS - realTokensSold + tokensIn;
        uint256 usdcOutGross  = effUSDC - (K / effTokensAfter);

        uint256 fee = (usdcOutGross * FEE_BPS) / BPS;
        usdcOut = usdcOutGross - fee;

        // price impact
        uint256 effTokens = VIRTUAL_TOKENS - realTokensSold;
        if (tokensIn > 0 && effTokens > 0) {
            uint256 spotScaled = (effUSDC * 1e18) / effTokens;
            uint256 avgScaled  = (usdcOutGross * 1e18) / tokensIn;
            if (spotScaled > avgScaled) {
                priceImpactBps = ((spotScaled - avgScaled) * BPS) / spotScaled;
            }
        }
    }

    /* ── arena metrics ─────────────────────────────────────────────── */
    struct ArenaMetrics {
        uint256 totalBuyVolume;
        uint256 totalSellVolume;
        uint256 buyCount;
        uint256 sellCount;
        uint256 uniqueBuyerCount;
        uint256 holderCount;
        uint256 retainedBuyers;
        uint256 buyPressureBps;
        uint256 percentCompleteBps;
    }

    function getArenaMetrics() external view returns (ArenaMetrics memory) {
        // retainedBuyers ≈ current holders (bought and still hold > 0)
        uint256 retainedBuyers = holderCount;

        uint256 totalVol = totalBuyVolume + totalSellVolume;
        uint256 buyPressureBps_ = totalVol > 0
            ? (totalBuyVolume * BPS) / totalVol
            : 0;

        uint256 pctComplete = GRADUATION_TARGET > 0
            ? (realUSDCRaised * BPS) / GRADUATION_TARGET
            : 0;
        if (pctComplete > BPS) pctComplete = BPS;

        return ArenaMetrics({
            totalBuyVolume:    totalBuyVolume,
            totalSellVolume:   totalSellVolume,
            buyCount:          buyCount,
            sellCount:         sellCount,
            uniqueBuyerCount:  uniqueBuyerCount,
            holderCount:       holderCount,
            retainedBuyers:    retainedBuyers,
            buyPressureBps:    buyPressureBps_,
            percentCompleteBps: pctComplete
        });
    }

    /* ── accept native USDC ────────────────────────────────────────── */
    receive() external payable {}
}
