// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFeeVault {
    function depositProtocolFee() external payable;
    function depositSplitFee(
        address creator,
        address referrer,
        uint256 protocolAmt,
        uint256 creatorAmt
    ) external payable;

    function claimProtocolFees() external;
    function claimCreatorFees() external;
    function claimReferrerFees() external;

    function authorizeSource(address source) external;
    function revokeSource(address source) external;
    function authorizeFactory(address factory_) external;

    function rescueERC20(address token, address to, uint256 amount) external;
    function rescueExcessNative(address to) external;

    function protocolClaimable() external view returns (uint256);
    function creatorClaimable(address creator) external view returns (uint256);
    function referrerClaimable(address referrer) external view returns (uint256);
    function totalAccountedUSDC() external view returns (uint256);
    function authorizedSources(address source) external view returns (bool);
}
