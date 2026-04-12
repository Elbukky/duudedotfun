// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IPostMigrationPool.sol";

/// @title PostMigrationFactory — deploys PostMigrationPool clones
/// @notice Only authorized BondingCurve contracts (registered by the
///         authorized factory) may call `createPool`.
contract PostMigrationFactory is Ownable {
    using SafeERC20 for IERC20;

    /* ── storage ───────────────────────────────────────────────────── */
    address public poolImplementation;
    address public feeVault;
    address public authorizedFactory;         // TokenFactory

    mapping(address => bool)    public authorizedCurves;
    mapping(address => address) public tokenToPool;   // token → pool
    mapping(address => bool)    public isPool;
    address[] public allPools;

    /* ── events ────────────────────────────────────────────────────── */
    event PoolCreated(
        address indexed token,
        address indexed pool,
        address indexed creator,
        uint256 tokenAmount,
        uint256 usdcAmount
    );
    event CurveAuthorized(address indexed curve);

    /* ── constructor ───────────────────────────────────────────────── */
    constructor(
        address _poolImplementation,
        address _feeVault
    ) Ownable(msg.sender) {
        poolImplementation = _poolImplementation;
        feeVault = _feeVault;
    }

    /* ══════════════════════════════════════════════════════════════════
       ADMIN
    ══════════════════════════════════════════════════════════════════ */

    function setAuthorizedFactory(address _factory) external onlyOwner {
        authorizedFactory = _factory;
    }

    /// @notice Called by the authorized factory when it creates a new
    ///         BondingCurve clone, so that curve can later call createPool.
    function authorizeCurve(address curve) external {
        require(
            msg.sender == authorizedFactory || msg.sender == owner(),
            "PostMigrationFactory: not authorized"
        );
        authorizedCurves[curve] = true;
        emit CurveAuthorized(curve);
    }

    /* ══════════════════════════════════════════════════════════════════
       CREATE POOL (called by graduating BondingCurve)
    ══════════════════════════════════════════════════════════════════ */

    /// @param token       The LaunchToken address
    /// @param creator     Token creator (for fee split)
    /// @param referrer    Original referrer (for fee split)
    /// @param tokenAmount Tokens to seed the pool (must be approved by caller)
    /// @return pool       The new pool address
    function createPool(
        address token,
        address creator,
        address referrer,
        uint256 tokenAmount
    ) external payable returns (address pool) {
        require(authorizedCurves[msg.sender], "PostMigrationFactory: not authorized curve");
        require(tokenToPool[token] == address(0), "PostMigrationFactory: pool exists");
        require(msg.value > 0 && tokenAmount > 0, "PostMigrationFactory: zero amounts");

        // 1. Clone
        pool = Clones.clone(poolImplementation);

        // 2. Pull tokens from the graduating curve
        IERC20(token).safeTransferFrom(msg.sender, pool, tokenAmount);

        // 3. Initialize the pool (sends USDC via msg.value)
        IPostMigrationPool(pool).init{value: msg.value}(
            token,
            feeVault,
            creator,
            referrer,
            tokenAmount,
            msg.value
        );

        // 4. Register
        tokenToPool[token] = pool;
        isPool[pool] = true;
        allPools.push(pool);

        emit PoolCreated(token, pool, creator, tokenAmount, msg.value);
    }

    /* ══════════════════════════════════════════════════════════════════
       VIEWS
    ══════════════════════════════════════════════════════════════════ */

    function getPool(address token) external view returns (address) {
        return tokenToPool[token];
    }

    function getPools(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        uint256 total = allPools.length;
        if (offset >= total) return new address[](0);
        uint256 count = limit;
        if (offset + count > total) count = total - offset;

        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = allPools[offset + i];
        }
        return result;
    }

    function poolCount() external view returns (uint256) {
        return allPools.length;
    }
}
