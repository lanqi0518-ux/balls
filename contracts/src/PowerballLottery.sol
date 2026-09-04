// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PowerballLottery
 * @dev Powerball风格的抽奖合约，开奖前公开快照
 */
contract PowerballLottery is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 接口 ============
    interface ILotteryToken {
        function getEligibleHoldersByNumber(uint8 number) external view returns (address[] memory);
        function getEligibleHoldersCount() external view returns (uint256);
        function getEligibleHoldersSnapshot() external view returns (
            address[] memory eligibleAddresses,
            uint8[] memory assignedNumbers,
            uint256[] memory balances,
            uint256[] memory holdingDurations
        );
        function getNumberDistribution() external view returns (uint256[50] memory);
        function balanceOf(address account) external view returns (uint256);
        function getNumber(address holder) external pure returns (uint8);
        function isEligibleForDraw(address holder) external view returns (bool);
    }

    // ============ 结构体 ============
    struct Draw {
        uint256 drawId;
        uint256 timestamp;
        uint8 winningNumber;
        uint256 prizePool;
        uint256 winnersCount;
        uint256 prizePerWinner;
        bool distributed;
        bytes32 snapshotHash;
    }
    
    struct Snapshot {
        uint256 drawId;
        uint256 timestamp;
        uint256 eligibleCount;
        uint256[50] numberDistribution;
        bytes32 snapshotHash;
        bool finalized;
    }
    
    struct WinnerInfo {
        address winner;
        uint256 prize;
        bool claimed;
    }

    // ============ 状态变量 ============
    ILotteryToken public lotteryToken;
    
    uint256 public currentDrawId;
    uint256 public lastDrawTime;
    uint256 public drawInterval = 60;
    uint256 public minPrizePool = 0;
    
    // 快照相关
    uint256 public snapshotLeadTime = 10;
    mapping(uint256 => Snapshot) public snapshots;
    mapping(uint256 => address[]) public snapshotAddresses;
    mapping(uint256 => uint8[]) public snapshotNumbers;
    
    // 历史记录
    mapping(uint256 => Draw) public draws;
    mapping(uint256 => WinnerInfo[]) public drawWinners;
    
    // 未领取奖金
    mapping(address => uint256) public pendingPrizes;
    
    // 开奖者奖励
    uint256 public drawerRewardBps = 100;
    
    // 统计
    uint256 public totalDistributed;
    uint256 public totalDraws;
    
    // ============ 事件 ============
    event SnapshotTaken(uint256 indexed drawId, uint256 eligibleCount, bytes32 snapshotHash, uint256 timestamp);
    event DrawExecuted(uint256 indexed drawId, uint8 winningNumber, uint256 prizePool, uint256 winnersCount, uint256 prizePerWinner);
    event PrizeClaimed(address indexed winner, uint256 amount);
    event DrawerRewarded(address indexed drawer, uint256 reward);
    event PrizeRolledOver(uint256 indexed fromDrawId, uint256 amount);

    // ============ 构造函数 ============
    constructor(address tokenAddress_) Ownable(msg.sender) {
        require(tokenAddress_ != address(0), "Invalid token address");
        lotteryToken = ILotteryToken(tokenAddress_);
        lastDrawTime = block.timestamp;
    }

    // ============ 管理函数 ============
    
    function setDrawInterval(uint256 interval_) external onlyOwner {
        require(interval_ >= 30 && interval_ <= 86400, "Invalid interval");
        drawInterval = interval_;
    }
    
    function setSnapshotLeadTime(uint256 leadTime_) external onlyOwner {
        require(leadTime_ < drawInterval, "Lead time too long");
        snapshotLeadTime = leadTime_;
    }
    
    function setMinPrizePool(uint256 minPrizePool_) external onlyOwner {
        minPrizePool = minPrizePool_;
    }
    
    function setDrawerRewardBps(uint256 bps) external onlyOwner {
        require(bps <= 500, "Reward too high");
        drawerRewardBps = bps;
    }

    // ============ 快照功能 ============
    
    function canTakeSnapshot() public view returns (bool) {
        uint256 nextDrawId = currentDrawId + 1;
        if (snapshots[nextDrawId].finalized) return false;
        
        uint256 nextDrawTime = lastDrawTime + drawInterval;
        if (block.timestamp < nextDrawTime - snapshotLeadTime) return false;
        
        return true;
    }
    
    function takeSnapshot() public returns (bytes32 snapshotHash) {
        require(canTakeSnapshot(), "Cannot take snapshot yet");
        
        uint256 nextDrawId = currentDrawId + 1;
        
        (
            address[] memory eligibleAddresses,
            uint8[] memory assignedNumbers,
            ,
        ) = lotteryToken.getEligibleHoldersSnapshot();
        
        uint256[50] memory distribution = lotteryToken.getNumberDistribution();
        
        snapshotHash = keccak256(abi.encodePacked(
            nextDrawId,
            block.timestamp,
            eligibleAddresses,
            assignedNumbers
        ));
        
        snapshots[nextDrawId] = Snapshot({
            drawId: nextDrawId,
            timestamp: block.timestamp,
            eligibleCount: eligibleAddresses.length,
            numberDistribution: distribution,
            snapshotHash: snapshotHash,
            finalized: true
        });
        
        snapshotAddresses[nextDrawId] = eligibleAddresses;
        snapshotNumbers[nextDrawId] = assignedNumbers;
        
        emit SnapshotTaken(nextDrawId, eligibleAddresses.length, snapshotHash, block.timestamp);
        
        return snapshotHash;
    }
    
    function getSnapshot(uint256 drawId) external view returns (
        uint256 timestamp,
        uint256 eligibleCount,
        uint256[50] memory numberDistribution,
        bytes32 snapshotHash,
        bool finalized
    ) {
        Snapshot storage s = snapshots[drawId];
        return (s.timestamp, s.eligibleCount, s.numberDistribution, s.snapshotHash, s.finalized);
    }
    
    function getSnapshotParticipants(uint256 drawId) external view returns (
        address[] memory addresses,
        uint8[] memory numbers
    ) {
        return (snapshotAddresses[drawId], snapshotNumbers[drawId]);
    }
    
    function isInSnapshot(uint256 drawId, address holder) external view returns (bool inSnapshot, uint8 number) {
        address[] storage addresses = snapshotAddresses[drawId];
        uint8[] storage numbers = snapshotNumbers[drawId];
        
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == holder) {
                return (true, numbers[i]);
            }
        }
        return (false, 0);
    }

    // ============ 核心抽奖逻辑 ============
    
    function canDraw() public view returns (bool) {
        if (block.timestamp < lastDrawTime + drawInterval) return false;
        
        uint256 prizePool = IERC20(address(lotteryToken)).balanceOf(address(this));
        if (prizePool < minPrizePool) return false;
        
        uint256 nextDrawId = currentDrawId + 1;
        if (!snapshots[nextDrawId].finalized) return false;
        if (snapshots[nextDrawId].eligibleCount == 0) return false;
        
        return true;
    }
    
    function draw() external nonReentrant returns (uint256 drawId) {
        // 如果还没有快照，先尝试拍摄
        uint256 nextDrawId = currentDrawId + 1;
        if (!snapshots[nextDrawId].finalized && canTakeSnapshot()) {
            takeSnapshot();
        }
        
        require(canDraw(), "Cannot draw yet");
        
        currentDrawId++;
        drawId = currentDrawId;
        lastDrawTime = block.timestamp;
        totalDraws++;
        
        uint256 prizePool = IERC20(address(lotteryToken)).balanceOf(address(this));
        
        uint256 drawerReward = (prizePool * drawerRewardBps) / 10000;
        uint256 actualPrizePool = prizePool - drawerReward;
        
        uint8 winningNumber = _generateWinningNumber(drawId);
        
        // 从快照中获取中奖者
        address[] memory winners = _getWinnersFromSnapshot(drawId, winningNumber);
        uint256 winnersCount = winners.length;
        
        uint256 prizePerWinner = winnersCount > 0 ? actualPrizePool / winnersCount : 0;
        
        draws[drawId] = Draw({
            drawId: drawId,
            timestamp: block.timestamp,
            winningNumber: winningNumber,
            prizePool: actualPrizePool,
            winnersCount: winnersCount,
            prizePerWinner: prizePerWinner,
            distributed: false,
            snapshotHash: snapshots[drawId].snapshotHash
        });
        
        if (winnersCount > 0 && prizePerWinner > 0) {
            for (uint256 i = 0; i < winnersCount; i++) {
                pendingPrizes[winners[i]] += prizePerWinner;
                drawWinners[drawId].push(WinnerInfo({
                    winner: winners[i],
                    prize: prizePerWinner,
                    claimed: false
                }));
            }
            draws[drawId].distributed = true;
            totalDistributed += actualPrizePool;
        } else {
            emit PrizeRolledOver(drawId, actualPrizePool);
        }
        
        if (drawerReward > 0) {
            IERC20(address(lotteryToken)).safeTransfer(msg.sender, drawerReward);
            emit DrawerRewarded(msg.sender, drawerReward);
        }
        
        emit DrawExecuted(drawId, winningNumber, actualPrizePool, winnersCount, prizePerWinner);
        
        return drawId;
    }
    
    function _getWinnersFromSnapshot(uint256 drawId, uint8 winningNumber) internal view returns (address[] memory) {
        address[] storage addresses = snapshotAddresses[drawId];
        uint8[] storage numbers = snapshotNumbers[drawId];
        
        // 计算中奖人数
        uint256 count = 0;
        for (uint256 i = 0; i < numbers.length; i++) {
            if (numbers[i] == winningNumber) {
                count++;
            }
        }
        
        // 创建结果数组
        address[] memory winners = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < numbers.length; i++) {
            if (numbers[i] == winningNumber) {
                winners[index] = addresses[i];
                index++;
            }
        }
        
        return winners;
    }
    
    function _generateWinningNumber(uint256 drawId) internal view returns (uint8) {
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            block.timestamp,
            block.prevrandao,
            drawId,
            snapshots[drawId].eligibleCount,
            snapshots[drawId].snapshotHash,
            IERC20(address(lotteryToken)).balanceOf(address(this)),
            msg.sender
        )));
        
        return uint8(randomSeed % 50) + 1;
    }
    
    function claimPrize() external nonReentrant {
        uint256 prize = pendingPrizes[msg.sender];
        require(prize > 0, "No prize to claim");
        
        pendingPrizes[msg.sender] = 0;
        IERC20(address(lotteryToken)).safeTransfer(msg.sender, prize);
        
        emit PrizeClaimed(msg.sender, prize);
    }

    // ============ 查询函数 ============
    
    function getCurrentPrizePool() external view returns (uint256) {
        return IERC20(address(lotteryToken)).balanceOf(address(this));
    }
    
    function getTimeUntilNextDraw() external view returns (uint256) {
        uint256 nextDrawTime = lastDrawTime + drawInterval;
        if (block.timestamp >= nextDrawTime) return 0;
        return nextDrawTime - block.timestamp;
    }
    
    function getTimeUntilSnapshot() external view returns (uint256) {
        uint256 snapshotTime = lastDrawTime + drawInterval - snapshotLeadTime;
        if (block.timestamp >= snapshotTime) return 0;
        return snapshotTime - block.timestamp;
    }
    
    function getNextDrawId() external view returns (uint256) {
        return currentDrawId + 1;
    }
    
    function getDrawInfo(uint256 drawId) external view returns (Draw memory) {
        return draws[drawId];
    }
    
    function getDrawWinners(uint256 drawId) external view returns (WinnerInfo[] memory) {
        return drawWinners[drawId];
    }
    
    function getRecentDraws(uint256 count) external view returns (Draw[] memory) {
        if (count > currentDrawId) count = currentDrawId;
        
        Draw[] memory result = new Draw[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = draws[currentDrawId - i];
        }
        
        return result;
    }
    
    function getUserNumber(address user) external view returns (uint8) {
        return lotteryToken.getNumber(user);
    }
    
    function getPendingPrize(address user) external view returns (uint256) {
        return pendingPrizes[user];
    }
    
    function getStats() external view returns (
        uint256 totalDraws_,
        uint256 totalDistributed_,
        uint256 currentPrizePool_,
        uint256 holdersCount_
    ) {
        return (
            totalDraws,
            totalDistributed,
            IERC20(address(lotteryToken)).balanceOf(address(this)),
            lotteryToken.getEligibleHoldersCount()
        );
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
