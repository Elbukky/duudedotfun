// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FeeVault — **single custody** for every fee on the platform
/// @notice ALL protocol / creator / referrer / LP-provider fees flow through
///         this contract.  Nothing stays in pool contracts.
///
///  Deposit paths
///  ─────────────────────────────────────────────────────────────────
///  BondingCurve  → depositFee(creator, referrer, pAmt, cAmt, 0)
///  PostMigPool   → depositFee(creator, referrer, pAmt, cAmt, lpAmt)
///  ─────────────────────────────────────────────────────────────────
///
///  LP fee custody
///  ─────────────────────────────────────────────────────────────────
///  LP fees are held here, keyed by pool address.  The pool's own
///  fee-per-share accumulator decides *who* gets *how much*; the pool
///  then calls `releaseLPFee(user, amount)` and this contract pays out.
///  ─────────────────────────────────────────────────────────────────
///
///  Protocol fees are split evenly (1/N) among all owners.
///  Creator fees are optionally split with a referrer (20 % of creator
///  share → referrer, if one exists).
contract FeeVault is Ownable {
    using SafeERC20 for IERC20;

    /* ── constants ─────────────────────────────────────────────────── */
    /// @dev 20 % of the creator's share goes to the referrer (if any).
    uint256 public constant REFERRAL_SHARE_OF_CREATOR = 2000; // bps of creator amt
    uint256 private constant BPS = 10_000;

    /* ── claimable balances ────────────────────────────────────────── */
    uint256 public protocolClaimable;
    mapping(address => uint256) public creatorClaimable;
    mapping(address => uint256) public referrerClaimable;

    /* ── LP fee custody (keyed by pool address) ────────────────────── */
    mapping(address => uint256) public lpPoolBalance;

    /* ── accounting ────────────────────────────────────────────────── */
    uint256 public totalAccountedUSDC;

    /* ── multi-owner for protocol fee split ─────────────────────────── */
    address[] public owners;
    mapping(address => bool) public isOwner;
    bool public adminRenounced;

    /* ── access control ────────────────────────────────────────────── */
    mapping(address => bool) public authorizedSources;   // curves & pools
    mapping(address => bool) public authorizedFactories;  // can authorize new sources

    /* ── events ────────────────────────────────────────────────────── */
    event FeeDeposited(
        address indexed source,
        address indexed creator,
        address indexed referrer,
        uint256 protocolAmt,
        uint256 creatorAmt,
        uint256 lpAmt
    );
    event ProtocolFeesClaimed(address indexed to, uint256 amount);
    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event ReferrerFeesClaimed(address indexed referrer, uint256 amount);
    event LPFeesReleased(address indexed pool, address indexed user, uint256 amount);
    event SourceAuthorized(address indexed source);
    event SourceRevoked(address indexed source);
    event FactoryAuthorized(address indexed factory_);
    event FactoryRevoked(address indexed factory_);
    event OwnerAdded(address indexed newOwner);
    event AdminRenounced();

    /* ── modifiers ─────────────────────────────────────────────────── */
    modifier onlyAuthorized() {
        require(authorizedSources[msg.sender], "FeeVault: not authorized source");
        _;
    }

    modifier onlyOwnerOrFactory() {
        require(
            msg.sender == owner() || authorizedFactories[msg.sender],
            "FeeVault: not owner or factory"
        );
        _;
    }

    modifier onlyProtocolOwner() {
        require(isOwner[msg.sender], "FeeVault: not a protocol owner");
        _;
    }

    modifier adminNotRenounced() {
        require(!adminRenounced, "FeeVault: admin renounced");
        _;
    }

    /* ── constructor ───────────────────────────────────────────────── */
    constructor() Ownable(msg.sender) {
        // Deployer is the first owner by default
        owners.push(msg.sender);
        isOwner[msg.sender] = true;
        emit OwnerAdded(msg.sender);
    }

    /* ══════════════════════════════════════════════════════════════════
       ADMIN — only deployer (Ownable owner), unless renounced
    ══════════════════════════════════════════════════════════════════ */

    /// @notice Add a new protocol owner. Split adjusts automatically to 1/N.
    ///         Only the deployer (Ownable owner) can call, unless admin is renounced.
    function addOwner(address newOwner) external onlyOwner adminNotRenounced {
        require(newOwner != address(0), "FeeVault: zero address");
        require(!isOwner[newOwner], "FeeVault: already an owner");
        owners.push(newOwner);
        isOwner[newOwner] = true;
        emit OwnerAdded(newOwner);
    }

    /// @notice Permanently renounce the admin power to add owners.
    ///         Cannot be undone. Owner count is locked after this.
    function renounceAdmin() external onlyOwner {
        adminRenounced = true;
        emit AdminRenounced();
    }

    /// @notice Get the number of protocol owners.
    function ownerCount() external view returns (uint256) {
        return owners.length;
    }

    /// @notice Get all protocol owners.
    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function authorizeFactory(address factory_) external onlyOwner {
        authorizedFactories[factory_] = true;
        emit FactoryAuthorized(factory_);
    }

    function revokeFactory(address factory_) external onlyOwner {
        authorizedFactories[factory_] = false;
        emit FactoryRevoked(factory_);
    }

    /// @notice Owner or an authorized factory can authorize a new source
    ///         (e.g. a freshly-cloned BondingCurve or PostMigrationPool).
    function authorizeSource(address source) external onlyOwnerOrFactory {
        authorizedSources[source] = true;
        emit SourceAuthorized(source);
    }

    function revokeSource(address source) external onlyOwner {
        authorizedSources[source] = false;
        emit SourceRevoked(source);
    }

    /* ══════════════════════════════════════════════════════════════════
       DEPOSITS — unified entry for every fee type
    ══════════════════════════════════════════════════════════════════ */

    /// @notice Universal fee deposit.  Called by BondingCurves (lpAmt = 0)
    ///         and PostMigrationPools (lpAmt > 0).
    /// @param creator   Token creator address
    /// @param referrer  Referrer address (address(0) if none)
    /// @param protocolAmt  Amount destined for protocol owners
    /// @param creatorAmt   Amount destined for creator (referrer carve-out applied here)
    /// @param lpAmt        Amount destined for LP providers of the calling pool
    function depositFee(
        address creator,
        address referrer,
        uint256 protocolAmt,
        uint256 creatorAmt,
        uint256 lpAmt
    ) external payable onlyAuthorized {
        require(
            msg.value == protocolAmt + creatorAmt + lpAmt,
            "FeeVault: value mismatch"
        );

        // ── protocol ──
        protocolClaimable += protocolAmt;

        // ── creator + referrer ──
        if (referrer != address(0) && creatorAmt > 0) {
            uint256 referrerShare = (creatorAmt * REFERRAL_SHARE_OF_CREATOR) / BPS;
            uint256 creatorNet = creatorAmt - referrerShare;
            creatorClaimable[creator] += creatorNet;
            referrerClaimable[referrer] += referrerShare;
        } else {
            creatorClaimable[creator] += creatorAmt;
        }

        // ── LP (keyed by calling pool) ──
        if (lpAmt > 0) {
            lpPoolBalance[msg.sender] += lpAmt;
        }

        totalAccountedUSDC += msg.value;
        emit FeeDeposited(msg.sender, creator, referrer, protocolAmt, creatorAmt, lpAmt);
    }

    /* ══════════════════════════════════════════════════════════════════
       LP FEE RELEASE — called by the pool after its fee-per-share math
    ══════════════════════════════════════════════════════════════════ */

    /// @notice A pool calls this to pay out LP fees to a specific user.
    ///         The pool is responsible for the distribution math; this
    ///         contract only verifies that the pool has enough deposited
    ///         LP fees and transfers to the user.
    /// @param user   Recipient LP provider
    /// @param amount USDC amount to release
    function releaseLPFee(address user, uint256 amount) external onlyAuthorized {
        require(lpPoolBalance[msg.sender] >= amount, "FeeVault: insufficient LP pool balance");
        lpPoolBalance[msg.sender] -= amount;
        totalAccountedUSDC -= amount;
        _sendNative(user, amount);
        emit LPFeesReleased(msg.sender, user, amount);
    }

    /* ══════════════════════════════════════════════════════════════════
       CLAIMS
    ══════════════════════════════════════════════════════════════════ */

    /// @notice Claim protocol fees. Splits evenly (1/N) among all owners.
    ///         Any protocol owner can trigger. All owners receive their share.
    function claimProtocolFees() external onlyProtocolOwner {
        uint256 amount = protocolClaimable;
        require(amount > 0, "FeeVault: nothing to claim");
        protocolClaimable = 0;
        totalAccountedUSDC -= amount;

        uint256 n = owners.length;
        uint256 share = amount / n;
        uint256 distributed = 0;

        // Send equal shares to all owners except the last
        for (uint256 i = 0; i < n - 1; i++) {
            _sendNative(owners[i], share);
            emit ProtocolFeesClaimed(owners[i], share);
            distributed += share;
        }

        // Last owner gets share + any remainder (dust from integer division)
        uint256 lastShare = amount - distributed;
        _sendNative(owners[n - 1], lastShare);
        emit ProtocolFeesClaimed(owners[n - 1], lastShare);
    }

    function claimCreatorFees() external {
        uint256 amount = creatorClaimable[msg.sender];
        require(amount > 0, "FeeVault: nothing to claim");
        creatorClaimable[msg.sender] = 0;
        totalAccountedUSDC -= amount;
        _sendNative(msg.sender, amount);
        emit CreatorFeesClaimed(msg.sender, amount);
    }

    function claimReferrerFees() external {
        uint256 amount = referrerClaimable[msg.sender];
        require(amount > 0, "FeeVault: nothing to claim");
        referrerClaimable[msg.sender] = 0;
        totalAccountedUSDC -= amount;
        _sendNative(msg.sender, amount);
        emit ReferrerFeesClaimed(msg.sender, amount);
    }

    /* ══════════════════════════════════════════════════════════════════
       RESCUE
    ══════════════════════════════════════════════════════════════════ */

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueExcessNative(address to) external onlyOwner {
        uint256 excess = address(this).balance - totalAccountedUSDC;
        require(excess > 0, "FeeVault: no excess");
        _sendNative(to, excess);
    }

    /* ── helpers ────────────────────────────────────────────────────── */
    function _sendNative(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "FeeVault: native transfer failed");
    }

    receive() external payable {}
}
