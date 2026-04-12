// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITokenFactory {
    function isPaused(address token) external view returns (bool);
    function onGraduation(address token, address pool) external;
    function onArenaWin(address creator) external;
}
