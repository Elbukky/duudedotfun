// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title VestingVault — EIP-1167 cloneable, one instance per token
/// @notice Cliff (30-90 days configurable) then linear unlock over
///         the remaining days up to 365 total. Linear starts AFTER cliff ends.
contract VestingVault {
    using SafeERC20 for IERC20;

    /* ── structs ───────────────────────────────────────────────────── */
    struct Beneficiary {
        address wallet;
        uint256 totalAllocation;
        uint256 claimed;
    }

    /* ── state ─────────────────────────────────────────────────────── */
    IERC20 public token;
    address public factory;

    uint256 public startTime;
    uint256 public cliffDuration;    // seconds
    uint256 public linearDuration;   // seconds  (365 days − cliff)
    uint256 public totalVestingDuration; // always 365 days

    Beneficiary[] internal _beneficiaries;
    /// @dev 1-indexed; 0 means "not a beneficiary"
    mapping(address => uint256) public beneficiaryIndex;

    bool private _initialized;

    /* ── events ────────────────────────────────────────────────────── */
    event Claimed(address indexed beneficiary, uint256 amount);

    /* ── constructor (disables impl) ───────────────────────────────── */
    constructor() {
        _initialized = true;
    }

    /* ── clone initializer ─────────────────────────────────────────── */
    function init(
        address _token,
        address _factory,
        address[] calldata wallets,
        uint256[] calldata amounts,
        uint256 cliffDays
    ) external {
        require(!_initialized, "VestingVault: already initialized");
        _initialized = true;

        require(wallets.length == amounts.length, "VestingVault: length mismatch");
        require(wallets.length > 0, "VestingVault: no beneficiaries");
        require(cliffDays >= 30 && cliffDays <= 90, "VestingVault: cliff 30-90 days");

        token = IERC20(_token);
        factory = _factory;
        startTime = block.timestamp;
        cliffDuration = cliffDays * 1 days;
        totalVestingDuration = 365 days;
        linearDuration = totalVestingDuration - cliffDuration;

        for (uint256 i = 0; i < wallets.length; i++) {
            require(wallets[i] != address(0), "VestingVault: zero address");
            require(amounts[i] > 0, "VestingVault: zero amount");
            require(beneficiaryIndex[wallets[i]] == 0, "VestingVault: duplicate");

            _beneficiaries.push(Beneficiary({
                wallet: wallets[i],
                totalAllocation: amounts[i],
                claimed: 0
            }));
            beneficiaryIndex[wallets[i]] = _beneficiaries.length; // 1-indexed
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       CLAIM
    ══════════════════════════════════════════════════════════════════ */

    function claim() external {
        uint256 idx = beneficiaryIndex[msg.sender];
        require(idx > 0, "VestingVault: not a beneficiary");

        Beneficiary storage b = _beneficiaries[idx - 1];
        uint256 vested = _vestedAmount(b.totalAllocation);
        uint256 pending = vested - b.claimed;
        require(pending > 0, "VestingVault: nothing to claim");

        b.claimed += pending;
        token.safeTransfer(msg.sender, pending);
        emit Claimed(msg.sender, pending);
    }

    /* ══════════════════════════════════════════════════════════════════
       VIEWS
    ══════════════════════════════════════════════════════════════════ */

    function claimable(address wallet) external view returns (uint256) {
        uint256 idx = beneficiaryIndex[wallet];
        if (idx == 0) return 0;
        Beneficiary storage b = _beneficiaries[idx - 1];
        return _vestedAmount(b.totalAllocation) - b.claimed;
    }

    function getVestingSchedule(address wallet) external view returns (
        uint256 totalAllocation,
        uint256 claimed,
        uint256 claimableNow,
        uint256 cliffEnd,
        uint256 vestingEnd
    ) {
        uint256 idx = beneficiaryIndex[wallet];
        require(idx > 0, "VestingVault: not a beneficiary");
        Beneficiary storage b = _beneficiaries[idx - 1];

        totalAllocation = b.totalAllocation;
        claimed = b.claimed;
        claimableNow = _vestedAmount(b.totalAllocation) - b.claimed;
        cliffEnd = startTime + cliffDuration;
        vestingEnd = startTime + totalVestingDuration;
    }

    function getAllBeneficiaries() external view returns (
        address[] memory wallets,
        uint256[] memory allocations,
        uint256[] memory claimedAmounts
    ) {
        uint256 len = _beneficiaries.length;
        wallets = new address[](len);
        allocations = new uint256[](len);
        claimedAmounts = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            Beneficiary storage b = _beneficiaries[i];
            wallets[i] = b.wallet;
            allocations[i] = b.totalAllocation;
            claimedAmounts[i] = b.claimed;
        }
    }

    /* ── internal ──────────────────────────────────────────────────── */

    /// @dev Linear vesting starts AFTER cliff. Nothing vested during cliff.
    function _vestedAmount(uint256 total) internal view returns (uint256) {
        uint256 cliffEnd = startTime + cliffDuration;
        if (block.timestamp < cliffEnd) return 0;

        uint256 elapsedAfterCliff = block.timestamp - cliffEnd;
        if (elapsedAfterCliff >= linearDuration) return total;

        return (total * elapsedAfterCliff) / linearDuration;
    }
}
