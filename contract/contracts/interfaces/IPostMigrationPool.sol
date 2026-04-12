// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPostMigrationPool {
    function init(
        address token_,
        address feeVault_,
        address creator_,
        address referrer_,
        uint256 tokenAmount,
        uint256 usdcAmount
    ) external payable;

    function swap(
        uint256 tokenOut,
        uint256 usdcOut,
        address to,
        uint256 maxIn
    ) external payable;

    function addLiquidity(
        uint256 tokenAmount,
        uint256 minLPOut,
        address to
    ) external payable;

    function removeLiquidity(
        uint256 lpAmount,
        uint256 minToken,
        uint256 minUSDC,
        address to
    ) external;

    function claimLPFees() external;

    function token() external view returns (address);
    function spotPrice() external view returns (uint256);
    function getLPBalance(address user) external view returns (uint256);
    function getLPFeeClaimable(address user) external view returns (uint256);

    function getPoolStats() external view returns (
        uint256 tokenReserve,
        uint256 usdcReserve,
        uint256 totalLPSupply,
        uint256 activeLPSupply,
        uint256 spotPriceValue
    );
}
