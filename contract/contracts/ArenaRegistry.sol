// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IBondingCurve.sol";
import "./interfaces/ITokenFactory.sol";

/// @title ArenaRegistry — on-chain meme-token battle system
/// @notice Rolling battle windows. Tokens auto-enter the current battle on
///         creation. A graduated token auto-wins. Otherwise the battle
///         resolves (permissionless) after the window ends using a composite
///         score derived from BondingCurve arena metrics.
contract ArenaRegistry is Ownable {

    /* ══════════════════════════════════════════════════════════════════
       STRUCTS
    ══════════════════════════════════════════════════════════════════ */

    struct Participant {
        address token;
        address curve;
        address creator;
    }

    struct Battle {
        uint256 startTime;
        uint256 endTime;
        Participant[] participants;
        bool    resolved;
        address winner;          // winning token
        address winnerCreator;
    }

    struct LeaderboardEntry {
        address token;
        address creator;
        uint256 score;
    }

    struct CreatorRecord {
        uint256 totalWins;
        uint256 battlesParticipated;
    }

    /* ══════════════════════════════════════════════════════════════════
       STORAGE
    ══════════════════════════════════════════════════════════════════ */
    address public factory;      // TokenFactory
    uint256 public battleDuration;

    Battle[] internal _battles;

    /// @dev battleId → token → already entered
    mapping(uint256 => mapping(address => bool)) public isParticipant;

    mapping(address => CreatorRecord) public creatorRecords;

    /* ══════════════════════════════════════════════════════════════════
       EVENTS
    ══════════════════════════════════════════════════════════════════ */
    event BattleStarted(uint256 indexed battleId, uint256 startTime, uint256 endTime);
    event TokenEntered(uint256 indexed battleId, address indexed token, address indexed creator);
    event GraduationWin(uint256 indexed battleId, address indexed token, address indexed creator);
    event BattleResolved(uint256 indexed battleId, address indexed winner, address indexed winnerCreator, uint256 score);

    /* ══════════════════════════════════════════════════════════════════
       CONSTRUCTOR
    ══════════════════════════════════════════════════════════════════ */
    constructor(
        address _factory,
        uint256 _battleDuration
    ) Ownable(msg.sender) {
        factory = _factory;
        battleDuration = _battleDuration;

        // start the first battle immediately
        _startNewBattle();
    }

    /* ══════════════════════════════════════════════════════════════════
       ENTER BATTLE (called by TokenFactory on token creation)
    ══════════════════════════════════════════════════════════════════ */

    function enterBattle(
        address token,
        address curve,
        address creator
    ) external {
        require(msg.sender == factory, "Arena: only factory");

        uint256 battleId = _ensureCurrentBattle();
        require(!isParticipant[battleId][token], "Arena: already entered");

        isParticipant[battleId][token] = true;
        _battles[battleId].participants.push(Participant({
            token:   token,
            curve:   curve,
            creator: creator
        }));

        creatorRecords[creator].battlesParticipated++;

        emit TokenEntered(battleId, token, creator);
    }

    /* ══════════════════════════════════════════════════════════════════
       GRADUATION AUTO-WIN (called by TokenFactory.onGraduation)
    ══════════════════════════════════════════════════════════════════ */

    function onGraduation(address token) external {
        require(msg.sender == factory, "Arena: only factory");

        uint256 battleId = _currentBattleId();
        Battle storage b = _battles[battleId];

        // only auto-win if battle is still active and token is a participant
        if (b.resolved) return;
        if (!isParticipant[battleId][token]) return;

        // find the participant to get their creator
        address creator_;
        for (uint256 i = 0; i < b.participants.length; i++) {
            if (b.participants[i].token == token) {
                creator_ = b.participants[i].creator;
                break;
            }
        }

        _resolveBattleWith(battleId, token, creator_);
        emit GraduationWin(battleId, token, creator_);
    }

    /* ══════════════════════════════════════════════════════════════════
       RESOLVE BATTLE (permissionless, after end time)
    ══════════════════════════════════════════════════════════════════ */

    function resolveBattle(uint256 battleId) external {
        require(battleId < _battles.length, "Arena: invalid battle");
        Battle storage b = _battles[battleId];
        require(!b.resolved, "Arena: already resolved");
        require(block.timestamp >= b.endTime, "Arena: battle not ended");

        if (b.participants.length == 0) {
            // no participants — just mark resolved, no winner
            b.resolved = true;
            emit BattleResolved(battleId, address(0), address(0), 0);
            return;
        }

        // find highest-scoring token
        address bestToken;
        address bestCreator;
        uint256 bestScore;

        for (uint256 i = 0; i < b.participants.length; i++) {
            Participant storage p = b.participants[i];
            uint256 score = _computeScore(p.curve);
            if (score > bestScore) {
                bestScore   = score;
                bestToken   = p.token;
                bestCreator = p.creator;
            }
        }

        _resolveBattleWith(battleId, bestToken, bestCreator);
        emit BattleResolved(battleId, bestToken, bestCreator, bestScore);
    }

    /* ══════════════════════════════════════════════════════════════════
       SCORE FORMULA
    ══════════════════════════════════════════════════════════════════ */

    /// @dev score = retainedBuyers*300 + uniqueBuyers*100
    ///            + buyVolumeUSDC/1e18 + buyPressureBps*10
    ///            + holderCount*50 + percentCompleteBps*5
    function _computeScore(address curve) internal view returns (uint256) {
        IBondingCurve.ArenaMetrics memory m = IBondingCurve(curve).getArenaMetrics();

        return (m.retainedBuyers   * 300)
             + (m.uniqueBuyerCount * 100)
             + (m.totalBuyVolume / 1e18)
             + (m.buyPressureBps   * 10)
             + (m.holderCount      * 50)
             + (m.percentCompleteBps * 5);
    }

    /* ══════════════════════════════════════════════════════════════════
       INTERNAL HELPERS
    ══════════════════════════════════════════════════════════════════ */

    function _resolveBattleWith(
        uint256 battleId,
        address winner,
        address winnerCreator
    ) internal {
        Battle storage b = _battles[battleId];
        b.resolved      = true;
        b.winner        = winner;
        b.winnerCreator = winnerCreator;

        if (winnerCreator != address(0)) {
            creatorRecords[winnerCreator].totalWins++;
            // notify factory
            ITokenFactory(factory).onArenaWin(winnerCreator);
        }
    }

    /// @dev Returns the current battle index, starting a new one if needed.
    function _ensureCurrentBattle() internal returns (uint256) {
        uint256 id = _battles.length - 1;
        Battle storage b = _battles[id];

        // if current battle has ended or is resolved, start a new one
        if (b.resolved || block.timestamp >= b.endTime) {
            if (!b.resolved) {
                // auto-resolve with no winner (will be resolved by anyone later)
                // Actually we don't auto-resolve here — we just start a new one.
                // The old battle can still be resolved via resolveBattle().
            }
            _startNewBattle();
            return _battles.length - 1;
        }
        return id;
    }

    function _startNewBattle() internal {
        uint256 id = _battles.length;
        _battles.push();
        Battle storage b = _battles[id];
        b.startTime = block.timestamp;
        b.endTime   = block.timestamp + battleDuration;
        emit BattleStarted(id, b.startTime, b.endTime);
    }

    function _currentBattleId() internal view returns (uint256) {
        return _battles.length - 1;
    }

    /* ══════════════════════════════════════════════════════════════════
       ADMIN
    ══════════════════════════════════════════════════════════════════ */

    function setBattleDuration(uint256 _duration) external onlyOwner {
        require(_duration > 0, "Arena: zero duration");
        battleDuration = _duration;
    }

    function setFactory(address _factory) external onlyOwner {
        factory = _factory;
    }

    /* ══════════════════════════════════════════════════════════════════
       VIEWS
    ══════════════════════════════════════════════════════════════════ */

    function getCurrentBattle() external view returns (
        uint256 battleId,
        uint256 startTime,
        uint256 endTime,
        uint256 participantCount,
        bool    resolved,
        address winner,
        address winnerCreator
    ) {
        battleId = _currentBattleId();
        Battle storage b = _battles[battleId];
        startTime        = b.startTime;
        endTime          = b.endTime;
        participantCount = b.participants.length;
        resolved         = b.resolved;
        winner           = b.winner;
        winnerCreator    = b.winnerCreator;
    }

    function getBattleParticipants(uint256 battleId)
        external view returns (Participant[] memory)
    {
        require(battleId < _battles.length, "Arena: invalid battle");
        return _battles[battleId].participants;
    }

    function getBattleLeaderboard(uint256 battleId)
        external view returns (LeaderboardEntry[] memory)
    {
        require(battleId < _battles.length, "Arena: invalid battle");
        Battle storage b = _battles[battleId];
        uint256 len = b.participants.length;

        LeaderboardEntry[] memory board = new LeaderboardEntry[](len);
        for (uint256 i = 0; i < len; i++) {
            Participant storage p = b.participants[i];
            board[i] = LeaderboardEntry({
                token:   p.token,
                creator: p.creator,
                score:   _computeScore(p.curve)
            });
        }

        // simple insertion sort (descending by score)
        for (uint256 i = 1; i < len; i++) {
            LeaderboardEntry memory key = board[i];
            uint256 j = i;
            while (j > 0 && board[j - 1].score < key.score) {
                board[j] = board[j - 1];
                j--;
            }
            board[j] = key;
        }

        return board;
    }

    function getCreatorArenaRecord(address creator_)
        external view returns (CreatorRecord memory)
    {
        return creatorRecords[creator_];
    }

    function battleCount() external view returns (uint256) {
        return _battles.length;
    }
}
