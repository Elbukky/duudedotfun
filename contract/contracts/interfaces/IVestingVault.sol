// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVestingVault {
    function init(
        address token_,
        address factory_,
        address[] calldata wallets,
        uint256[] calldata amounts,
        uint256 cliffDays
    ) external;

    function claim() external;
    function claimable(address wallet) external view returns (uint256);

    function getVestingSchedule(address wallet) external view returns (
        uint256 totalAllocation,
        uint256 claimed,
        uint256 claimableNow,
        uint256 cliffEnd,
        uint256 vestingEnd
    );

    function getAllBeneficiaries() external view returns (
        address[] memory wallets,
        uint256[] memory allocations,
        uint256[] memory claimedAmounts
    );
}
