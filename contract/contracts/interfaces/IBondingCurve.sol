// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBondingCurve {
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

    function initialize(
        address token_,
        address creator_,
        address referrer_,
        address feeVault_,
        address factory_,
        address postMigrationFactory_
    ) external;

    function buy(uint256 minTokensOut, address recipient) external payable;
    function sell(uint256 tokensIn, uint256 minUSDCOut) external;

    function token() external view returns (address);
    function creator() external view returns (address);
    function graduated() external view returns (bool);
    function realUSDCRaised() external view returns (uint256);
    function realTokensSold() external view returns (uint256);

    function spotPrice() external view returns (uint256);
    function quoteBuy(uint256 usdcIn) external view returns (uint256 tokensOut, uint256 priceImpactBps);
    function quoteSell(uint256 tokensIn) external view returns (uint256 usdcOut, uint256 priceImpactBps);
    function getArenaMetrics() external view returns (ArenaMetrics memory);
}
