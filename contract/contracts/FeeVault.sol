// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FeeVault — central fee collection & distribution
/// @notice Bonding curves deposit protocol-only fees; post-migration pools
///         deposit 3-way split fees (protocol + creator; referrer share is
///         carved out of the creator portion inside this contract).
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

    /* ── accounting ────────────────────────────────────────────────── */
    uint256 public totalAccountedUSDC;

    /* ── access control ────────────────────────────────────────────── */
    mapping(address => bool) public authorizedSources;   // curves & pools
    mapping(address => bool) public authorizedFactories;  // can authorize new sources

    /* ── events ────────────────────────────────────────────────────── */
    event ProtocolFeeDeposited(address indexed source, uint256 amount);
    event SplitFeeDeposited(
        address indexed source,
        address indexed creator,
        address indexed referrer,
        uint256 protocolAmt,
        uint256 creatorAmt
    );
    event ProtocolFeesClaimed(address indexed to, uint256 amount);
    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event ReferrerFeesClaimed(address indexed referrer, uint256 amount);
    event SourceAuthorized(address indexed source);
    event SourceRevoked(address indexed source);
    event FactoryAuthorized(address indexed factory_);
    event FactoryRevoked(address indexed factory_);

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

    /* ── constructor ───────────────────────────────────────────────── */
    constructor() Ownable(msg.sender) {}

    /* ══════════════════════════════════════════════════════════════════
       ADMIN
    ══════════════════════════════════════════════════════════════════ */

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
       DEPOSITS (only authorized curves / pools)
    ══════════════════════════════════════════════════════════════════ */

    /// @notice Called by BondingCurve — all bonding-phase fees go to protocol.
    function depositProtocolFee() external payable onlyAuthorized {
        protocolClaimable += msg.value;
        totalAccountedUSDC += msg.value;
        emit ProtocolFeeDeposited(msg.sender, msg.value);
    }

    /// @notice Called by PostMigrationPool — protocol + creator portions.
    ///         Referrer share is carved from the creator amount internally.
    function depositSplitFee(
        address creator,
        address referrer,
        uint256 protocolAmt,
        uint256 creatorAmt
    ) external payable onlyAuthorized {
        require(msg.value == protocolAmt + creatorAmt, "FeeVault: value mismatch");

        protocolClaimable += protocolAmt;

        if (referrer != address(0) && creatorAmt > 0) {
            uint256 referrerShare = (creatorAmt * REFERRAL_SHARE_OF_CREATOR) / BPS;
            uint256 creatorNet = creatorAmt - referrerShare;
            creatorClaimable[creator] += creatorNet;
            referrerClaimable[referrer] += referrerShare;
        } else {
            creatorClaimable[creator] += creatorAmt;
        }

        totalAccountedUSDC += msg.value;
        emit SplitFeeDeposited(msg.sender, creator, referrer, protocolAmt, creatorAmt);
    }

    /* ══════════════════════════════════════════════════════════════════
       CLAIMS
    ══════════════════════════════════════════════════════════════════ */

    function claimProtocolFees() external onlyOwner {
        uint256 amount = protocolClaimable;
        require(amount > 0, "FeeVault: nothing to claim");
        protocolClaimable = 0;
        totalAccountedUSDC -= amount;
        _sendNative(msg.sender, amount);
        emit ProtocolFeesClaimed(msg.sender, amount);
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
