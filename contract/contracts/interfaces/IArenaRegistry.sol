// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IArenaRegistry {
    struct BattleInfo {
        uint256 battleId;
        uint256 startTime;
        uint256 endTime;
        address[] participants;
        bool resolved;
        address winner;
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

    function enterBattle(address token, address curve, address creator) external;
    function onGraduation(address token) external;
    function resolveBattle(uint256 battleId) external;

    function getCurrentBattle() external view returns (BattleInfo memory);
    function getBattleLeaderboard(uint256 battleId) external view returns (LeaderboardEntry[] memory);
    function getCreatorArenaRecord(address creator) external view returns (CreatorRecord memory);
}
