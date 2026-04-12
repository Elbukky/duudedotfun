// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/// @title LaunchToken — EIP-1167 cloneable ERC-20
/// @notice Mints full 100 B supply to the factory (msg.sender of initialize).
///         Factory then distributes to VestingVault + BondingCurve.
contract LaunchToken is ERC20Upgradeable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000_000e18; // 100 billion, 18 decimals

    address public factory;
    address public bondingCurve;

    /* ── disable implementation initializer ────────────────────────── */
    constructor() {
        _disableInitializers();
    }

    /* ── clone initializer ─────────────────────────────────────────── */
    /// @param name_   Token name
    /// @param symbol_ Token symbol
    function initialize(
        string memory name_,
        string memory symbol_
    ) external initializer {
        __ERC20_init(name_, symbol_);
        factory = msg.sender;
        _mint(msg.sender, TOTAL_SUPPLY); // mint everything to factory
    }

    /* ── one-time setter (called by factory after curve is cloned) ── */
    function setBondingCurve(address _bondingCurve) external {
        require(msg.sender == factory, "Only factory");
        require(bondingCurve == address(0), "Already set");
        bondingCurve = _bondingCurve;
    }
}
