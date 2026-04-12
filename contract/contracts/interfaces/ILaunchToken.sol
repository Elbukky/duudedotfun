// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILaunchToken is IERC20 {
    function initialize(string memory name_, string memory symbol_) external;
    function setBondingCurve(address curve) external;
    function TOTAL_SUPPLY() external view returns (uint256);
    function factory() external view returns (address);
    function bondingCurve() external view returns (address);
}
