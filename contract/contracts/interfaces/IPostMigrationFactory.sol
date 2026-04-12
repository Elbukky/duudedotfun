// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPostMigrationFactory {
    function createPool(
        address token,
        address creator,
        address referrer,
        uint256 tokenAmount
    ) external payable returns (address pool);

    function authorizeCurve(address curve) external;
    function setAuthorizedFactory(address factory_) external;

    function getPool(address token) external view returns (address);
    function isPool(address addr) external view returns (bool);
    function getPools(uint256 offset, uint256 limit) external view returns (address[] memory);
}
