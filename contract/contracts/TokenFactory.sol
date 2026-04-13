// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/ILaunchToken.sol";
import "./interfaces/IBondingCurve.sol";
import "./interfaces/IVestingVault.sol";
import "./interfaces/IFeeVault.sol";
import "./interfaces/IPostMigrationFactory.sol";
import "./interfaces/IArenaRegistry.sol";

/// @title TokenFactory — main entry-point for launching meme tokens
/// @notice Clones LaunchToken + BondingCurve (+ VestingVault if vesting).
///         Stores full TokenRecord, CreatorStats, social links,
///         pause controls, and graduation / arena-win callbacks.
contract TokenFactory is Ownable {

    /* ══════════════════════════════════════════════════════════════════
       STRUCTS
    ══════════════════════════════════════════════════════════════════ */

    struct SocialLinks {
        string website;
        string twitter;
        string telegram;
        string discord;
        string extra;
    }

    struct TokenRecord {
        address token;
        address curve;
        address vestingVault;
        address creator;
        address referrer;
        string  name;
        string  symbol;
        string  description;
        string  imageURI;
        SocialLinks links;
        uint256 createdAt;
        bool    graduated;
        address migrationPool;
    }

    struct CreatorStats {
        uint256 tokensCreated;
        uint256 tokensGraduated;
        uint256 arenaBattlesWon;
        address[] tokenList;
    }

    /// @dev Packs createToken calldata to avoid stack-too-deep.
    struct CreateParams {
        string  name;
        string  symbol;
        string  description;
        string  imageURI;
        SocialLinks links;
        address[] beneficiaries;
        uint256[] bpsAllocations;
        uint256 cliffDays;       // 30-90; 0 = use defaultCliffDays
        address referrer;
    }

    /* ══════════════════════════════════════════════════════════════════
       IMPLEMENTATION ADDRESSES (for EIP-1167 cloning)
    ══════════════════════════════════════════════════════════════════ */
    address public launchTokenImpl;
    address public bondingCurveImpl;
    address public vestingVaultImpl;

    /* ══════════════════════════════════════════════════════════════════
       EXTERNAL CONTRACTS
    ══════════════════════════════════════════════════════════════════ */
    address public postMigrationFactory;
    address public feeVault;
    address public arenaRegistry;

    /* ══════════════════════════════════════════════════════════════════
       CONFIG
    ══════════════════════════════════════════════════════════════════ */
    uint256 public defaultCliffDays; // 30-90

    /* ══════════════════════════════════════════════════════════════════
       STORAGE
    ══════════════════════════════════════════════════════════════════ */
    TokenRecord[] internal _allTokens;
    /// @dev 1-indexed; 0 = unknown token
    mapping(address => uint256) public tokenIndex;
    mapping(address => CreatorStats) internal _creatorStats;
    mapping(address => bool) public pausedCurves;

    /* ══════════════════════════════════════════════════════════════════
       EVENTS
    ══════════════════════════════════════════════════════════════════ */
    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string  name,
        string  symbol
    );
    event TokenGraduated(address indexed token, address indexed pool);
    event ArenaWin(address indexed creator);
    event CurvePaused(address indexed token);
    event CurveUnpaused(address indexed token);
    event SocialLinksUpdated(address indexed token);

    /* ══════════════════════════════════════════════════════════════════
       CONSTRUCTOR
    ══════════════════════════════════════════════════════════════════ */
    constructor(
        address _launchTokenImpl,
        address _bondingCurveImpl,
        address _vestingVaultImpl,
        address _postMigrationFactory,
        address _feeVault,
        uint256 _defaultCliffDays
    ) Ownable(msg.sender) {
        launchTokenImpl      = _launchTokenImpl;
        bondingCurveImpl     = _bondingCurveImpl;
        vestingVaultImpl     = _vestingVaultImpl;
        postMigrationFactory = _postMigrationFactory;
        feeVault             = _feeVault;
        defaultCliffDays     = _defaultCliffDays;
    }

    /* ══════════════════════════════════════════════════════════════════
       CREATE TOKEN
    ══════════════════════════════════════════════════════════════════ */

    function createToken(
        CreateParams calldata p
    ) external payable returns (address tokenAddr, address curveAddr) {
        require(msg.value >= 1e18, "Factory: min 1 USDC");
        require(p.beneficiaries.length == p.bpsAllocations.length, "Factory: length mismatch");

        // validate vesting allocations
        uint256 totalBps;
        for (uint256 i = 0; i < p.bpsAllocations.length; i++) {
            totalBps += p.bpsAllocations[i];
        }
        require(totalBps <= 500, "Factory: max 5% vesting");

        /* ── 1. Clone & init LaunchToken ──────────────────────────── */
        tokenAddr = Clones.clone(launchTokenImpl);
        ILaunchToken(tokenAddr).initialize(p.name, p.symbol);

        uint256 totalSupply_ = ILaunchToken(tokenAddr).TOTAL_SUPPLY();

        /* ── 2. Handle vesting (if any) ───────────────────────────── */
        uint256 vestedAmount;
        address vestingVaultAddr;
        if (p.beneficiaries.length > 0 && totalBps > 0) {
            uint256 cliff = p.cliffDays > 0 ? p.cliffDays : defaultCliffDays;
            require(cliff >= 30 && cliff <= 90, "Factory: cliff 30-90 days");
            (vestingVaultAddr, vestedAmount) = _setupVesting(
                tokenAddr, totalSupply_, totalBps, p.beneficiaries, p.bpsAllocations, cliff
            );
        }

        /* ── 3. Clone & init BondingCurve ─────────────────────────── */
        curveAddr = _setupCurve(tokenAddr, totalSupply_ - vestedAmount, p.referrer);

        /* ── 4. Store record + stats + arena ──────────────────────── */
        _storeRecord(tokenAddr, curveAddr, vestingVaultAddr, p);
        _creatorStats[msg.sender].tokensCreated++;
        _creatorStats[msg.sender].tokenList.push(tokenAddr);

        if (arenaRegistry != address(0)) {
            IArenaRegistry(arenaRegistry).enterBattle(tokenAddr, curveAddr, msg.sender);
        }

        /* ── 5. Initial creator buy (forward all msg.value) ───────── */
        IBondingCurve(curveAddr).buy{value: msg.value}(0, msg.sender);

        emit TokenCreated(tokenAddr, curveAddr, msg.sender, p.name, p.symbol);
    }

    /* ── internal: vesting setup ───────────────────────────────────── */
    function _setupVesting(
        address tokenAddr,
        uint256 totalSupply_,
        uint256 totalBps,
        address[] calldata beneficiaries,
        uint256[] calldata bpsAllocations,
        uint256 cliffDays
    ) internal returns (address vault, uint256 vestedAmount) {
        vestedAmount = (totalSupply_ * totalBps) / 10_000;

        uint256[] memory amounts = new uint256[](beneficiaries.length);
        uint256 sumAmounts;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            amounts[i] = (totalSupply_ * bpsAllocations[i]) / 10_000;
            sumAmounts += amounts[i];
        }
        if (sumAmounts < vestedAmount) {
            amounts[amounts.length - 1] += vestedAmount - sumAmounts;
        }

        vault = Clones.clone(vestingVaultImpl);
        IERC20(tokenAddr).transfer(vault, vestedAmount);
        IVestingVault(vault).init(
            tokenAddr,
            address(this),
            beneficiaries,
            amounts,
            cliffDays
        );
    }

    /* ── internal: curve setup ─────────────────────────────────────── */
    function _setupCurve(
        address tokenAddr,
        uint256 curveTokens,
        address referrer
    ) internal returns (address curveAddr) {
        curveAddr = Clones.clone(bondingCurveImpl);
        ILaunchToken(tokenAddr).setBondingCurve(curveAddr);

        IERC20(tokenAddr).transfer(curveAddr, curveTokens);

        IBondingCurve(curveAddr).initialize(
            tokenAddr,
            msg.sender,
            referrer,
            feeVault,
            address(this),
            postMigrationFactory
        );

        IFeeVault(feeVault).authorizeSource(curveAddr);
        IPostMigrationFactory(postMigrationFactory).authorizeCurve(curveAddr);
    }

    /* ── internal: record storage ──────────────────────────────────── */
    function _storeRecord(
        address tokenAddr,
        address curveAddr,
        address vestingVaultAddr,
        CreateParams calldata p
    ) internal {
        _allTokens.push(TokenRecord({
            token:         tokenAddr,
            curve:         curveAddr,
            vestingVault:  vestingVaultAddr,
            creator:       msg.sender,
            referrer:      p.referrer,
            name:          p.name,
            symbol:        p.symbol,
            description:   p.description,
            imageURI:      p.imageURI,
            links:         p.links,
            createdAt:     block.timestamp,
            graduated:     false,
            migrationPool: address(0)
        }));
        tokenIndex[tokenAddr] = _allTokens.length;
    }

    /* ══════════════════════════════════════════════════════════════════
       CALLBACKS
    ══════════════════════════════════════════════════════════════════ */

    /// @notice Called by the BondingCurve when it graduates.
    function onGraduation(address tokenAddr, address pool) external {
        uint256 idx = tokenIndex[tokenAddr];
        require(idx > 0, "Factory: unknown token");
        TokenRecord storage rec = _allTokens[idx - 1];
        require(msg.sender == rec.curve, "Factory: only curve");

        rec.graduated     = true;
        rec.migrationPool = pool;

        IFeeVault(feeVault).authorizeSource(pool);
        _creatorStats[rec.creator].tokensGraduated++;

        if (arenaRegistry != address(0)) {
            IArenaRegistry(arenaRegistry).onGraduation(tokenAddr);
        }

        emit TokenGraduated(tokenAddr, pool);
    }

    /// @notice Called by ArenaRegistry when a creator wins a battle.
    function onArenaWin(address creator_) external {
        require(msg.sender == arenaRegistry, "Factory: only arena");
        _creatorStats[creator_].arenaBattlesWon++;
        emit ArenaWin(creator_);
    }

    /* ══════════════════════════════════════════════════════════════════
       PAUSE CONTROLS
    ══════════════════════════════════════════════════════════════════ */

    function isPaused(address tokenAddr) external view returns (bool) {
        return pausedCurves[tokenAddr];
    }

    function pauseCurve(address tokenAddr) external onlyOwner {
        pausedCurves[tokenAddr] = true;
        emit CurvePaused(tokenAddr);
    }

    function unpauseCurve(address tokenAddr) external onlyOwner {
        pausedCurves[tokenAddr] = false;
        emit CurveUnpaused(tokenAddr);
    }

    /* ══════════════════════════════════════════════════════════════════
       ADMIN SETTERS
    ══════════════════════════════════════════════════════════════════ */

    function setArenaRegistry(address _arenaRegistry) external onlyOwner {
        arenaRegistry = _arenaRegistry;
    }

    function setDefaultCliffDays(uint256 _days) external onlyOwner {
        require(_days >= 30 && _days <= 90, "Factory: cliff 30-90 days");
        defaultCliffDays = _days;
    }

    /* ══════════════════════════════════════════════════════════════════
       SOCIAL LINKS
    ══════════════════════════════════════════════════════════════════ */

    function updateSocialLinks(
        address tokenAddr,
        SocialLinks calldata links
    ) external {
        uint256 idx = tokenIndex[tokenAddr];
        require(idx > 0, "Factory: unknown token");
        require(_allTokens[idx - 1].creator == msg.sender, "Factory: only creator");
        _allTokens[idx - 1].links = links;
        emit SocialLinksUpdated(tokenAddr);
    }

    /* ══════════════════════════════════════════════════════════════════
       VIEWS
    ══════════════════════════════════════════════════════════════════ */

    function getTokenRecord(address tokenAddr)
        external view returns (TokenRecord memory)
    {
        uint256 idx = tokenIndex[tokenAddr];
        require(idx > 0, "Factory: unknown token");
        return _allTokens[idx - 1];
    }

    function getTokenCount() external view returns (uint256) {
        return _allTokens.length;
    }

    function getTokens(
        uint256 offset,
        uint256 limit
    ) external view returns (TokenRecord[] memory) {
        uint256 total = _allTokens.length;
        if (offset >= total) return new TokenRecord[](0);
        uint256 count = limit;
        if (offset + count > total) count = total - offset;

        TokenRecord[] memory result = new TokenRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = _allTokens[offset + i];
        }
        return result;
    }

    function getGraduatedTokens(
        uint256 offset,
        uint256 limit
    ) external view returns (TokenRecord[] memory) {
        uint256 gradCount;
        for (uint256 i = 0; i < _allTokens.length; i++) {
            if (_allTokens[i].graduated) gradCount++;
        }
        if (offset >= gradCount) return new TokenRecord[](0);
        uint256 count = limit;
        if (offset + count > gradCount) count = gradCount - offset;

        TokenRecord[] memory result = new TokenRecord[](count);
        uint256 found;
        uint256 added;
        for (uint256 i = 0; i < _allTokens.length && added < count; i++) {
            if (_allTokens[i].graduated) {
                if (found >= offset) {
                    result[added++] = _allTokens[i];
                }
                found++;
            }
        }
        return result;
    }

    function getCreatorStats(address creator_)
        external view returns (
            uint256 tokensCreated,
            uint256 tokensGraduated,
            uint256 arenaBattlesWon,
            address[] memory tokenList
        )
    {
        CreatorStats storage s = _creatorStats[creator_];
        tokensCreated   = s.tokensCreated;
        tokensGraduated = s.tokensGraduated;
        arenaBattlesWon = s.arenaBattlesWon;
        tokenList       = s.tokenList;
    }
}
