// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PonsLottery
 * @dev 专为 Pons 平台设计的抽奖合约
 * @notice 此合约作为 Pons 的 creatorFeeRecipient，直接接收交易税
 */
contract PonsLottery is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 结构体 ============
    struct Draw {
        uint256 drawId;
        uint256 timestamp;
        uint8 winningNumber;
        uint256 prizePool;
        uint256 winnersCount;
        uint256 prizePerWinner;
        bytes32 snapshotHash;
    }
    
    struct Snapshot {
        uint256 timestamp;
        uint256 eligibleCount;
        bytes32 snapshotHash;
        bool finalized;
    }

    // ============ 状态变量 ============
    IERC20 public token;
    address public teamWallet;
    
    // 费率配置（基点，10000 = 100%）
    uint256 public teamShareBps = 1892; // 0.7% / 3.7% ≈ 18.92%
    uint256 public prizeShareBps = 8108; // 3% / 3.7% ≈ 81.08%
    
    // 开奖配置
    uint256 public currentDrawId;
    uint256 public lastDrawTime;
    uint256 public drawInterval = 60; // 1分钟
    uint256 public minHoldingDuration = 60; // 最少持币1分钟
    uint256 public snapshotLeadTime = 10; // 开奖前10秒快照
    
    // 持币者追踪
    address[] public holders;
    mapping(address => uint256) public holderIndex;
    mapping(address => bool) public isHolder;
    mapping(address => uint256) public holdingSince;
    mapping(address => uint8) public holderNumber;
    mapping(uint8 => address[]) public numberToHolders;
    
    // 快照
    mapping(uint256 => Snapshot) public snapshots;
    mapping(uint256 => address[]) public snapshotAddresses;
    mapping(uint256 => uint8[]) public snapshotNumbers;
    
    // 开奖记录
    mapping(uint256 => Draw) public draws;
    mapping(address => uint256) public pendingPrizes;
    
    // 统计
    uint256 public totalDistributed;
    uint256 public totalTeamReceived;
    uint256 public drawerRewardBps = 100; // 1%给开奖触发者
    
    // ============ 事件 ============
    event TaxReceived(uint256 amount, uint256 toPrize, uint256 toTeam);
    event HolderRegistered(address indexed holder, uint8 number, uint256 timestamp);
    event HolderRemoved(address indexed holder);
    event SnapshotTaken(uint256 indexed drawId, uint256 eligibleCount, bytes32 snapshotHash);
    event DrawExecuted(uint256 indexed drawId, uint8 winningNumber, uint256 prizePool, uint256 winnersCount);
    event PrizeClaimed(address indexed winner, uint256 amount);

    // ============ 构造函数 ============
    constructor(address token_, address teamWallet_) Ownable(msg.sender) {
        require(token_ != address(0), "Invalid token");
        require(teamWallet_ != address(0), "Invalid team wallet");
        
        token = IERC20(token_);
        teamWallet = teamWallet_;
        lastDrawTime = block.timestamp;
    }

    // ============ 接收税费 ============
    
    /**
     * @dev 处理收到的税费（Pons 会调用 transfer 发送税费）
     * @notice 需要在收到代币后调用此函数分配
     */
    function processTax(uint256 amount) external nonReentrant {
        require(amount > 0, "No amount");
        
        // 计算分配
        uint256 toTeam = (amount * teamShareBps) / 10000;
        uint256 toPrize = amount - toTeam;
        
        // 转给团队
        if (toTeam > 0) {
            token.safeTransfer(teamWallet, toTeam);
            totalTeamReceived += toTeam;
        }
        
        // 剩余留在合约作为奖池
        emit TaxReceived(amount, toPrize, toTeam);
    }
    
    /**
     * @dev 自动处理所有新收到的代币
     */
    function processAllTax() external nonReentrant {
        uint256 balance = token.balanceOf(address(this));
        uint256 reservedForPrizes = _getTotalPendingPrizes();
        
        if (balance > reservedForPrizes) {
            uint256 newTax = balance - reservedForPrizes;
            
            uint256 toTeam = (newTax * teamShareBps) / 10000;
            
            if (toTeam > 0) {
                token.safeTransfer(teamWallet, toTeam);
                totalTeamReceived += toTeam;
            }
            
            emit TaxReceived(newTax, newTax - toTeam, toTeam);
        }
    }

    // ============ 持币者注册 ============
    
    /**
     * @dev 持币者自行注册（或由后端批量注册）
     */
    function registerHolder(address holder) external {
        require(token.balanceOf(holder) > 0, "No balance");
        require(!isHolder[holder], "Already registered");
        
        _addHolder(holder);
    }
    
    /**
     * @dev 批量注册持币者
     */
    function registerHolders(address[] calldata holderList) external {
        for (uint256 i = 0; i < holderList.length; i++) {
            address holder = holderList[i];
            if (token.balanceOf(holder) > 0 && !isHolder[holder]) {
                _addHolder(holder);
            }
        }
    }
    
    /**
     * @dev 移除零余额持币者
     */
    function removeHolder(address holder) external {
        require(token.balanceOf(holder) == 0, "Still has balance");
        require(isHolder[holder], "Not registered");
        
        _removeHolder(holder);
    }
    
    function _addHolder(address holder) internal {
        isHolder[holder] = true;
        holders.push(holder);
        holderIndex[holder] = holders.length;
        holdingSince[holder] = block.timestamp;
        
        uint8 number = getNumber(holder);
        holderNumber[holder] = number;
        numberToHolders[number].push(holder);
        
        emit HolderRegistered(holder, number, block.timestamp);
    }
    
    function _removeHolder(address holder) internal {
        isHolder[holder] = false;
        
        uint256 index = holderIndex[holder] - 1;
        uint256 lastIndex = holders.length - 1;
        
        if (index != lastIndex) {
            address lastHolder = holders[lastIndex];
            holders[index] = lastHolder;
            holderIndex[lastHolder] = index + 1;
        }
        
        holders.pop();
        holderIndex[holder] = 0;
        
        uint8 number = holderNumber[holder];
        _removeFromNumberMapping(holder, number);
        holderNumber[holder] = 0;
        holdingSince[holder] = 0;
        
        emit HolderRemoved(holder);
    }
    
    function _removeFromNumberMapping(address holder, uint8 number) internal {
        address[] storage list = numberToHolders[number];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == holder) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
    }

    // ============ 号码计算 ============
    
    function getNumber(address holder) public pure returns (uint8) {
        return uint8(uint256(keccak256(abi.encodePacked(holder))) % 50) + 1;
    }
    
    function isEligible(address holder) public view returns (bool) {
        if (!isHolder[holder]) return false;
        if (token.balanceOf(holder) == 0) return false;
        if (holdingSince[holder] == 0) return false;
        return (block.timestamp - holdingSince[holder]) >= minHoldingDuration;
    }

    // ============ 快照 ============
    
    function canTakeSnapshot() public view returns (bool) {
        uint256 nextDrawId = currentDrawId + 1;
        if (snapshots[nextDrawId].finalized) return false;
        
        uint256 nextDrawTime = lastDrawTime + drawInterval;
        return block.timestamp >= nextDrawTime - snapshotLeadTime;
    }
    
    function takeSnapshot() public returns (bytes32) {
        require(canTakeSnapshot(), "Too early");
        
        uint256 nextDrawId = currentDrawId + 1;
        
        // 收集有资格的持币者
        address[] memory eligible = new address[](holders.length);
        uint8[] memory numbers = new uint8[](holders.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < holders.length; i++) {
            if (isEligible(holders[i])) {
                eligible[count] = holders[i];
                numbers[count] = holderNumber[holders[i]];
                count++;
            }
        }
        
        // 调整数组大小
        address[] memory finalAddresses = new address[](count);
        uint8[] memory finalNumbers = new uint8[](count);
        for (uint256 i = 0; i < count; i++) {
            finalAddresses[i] = eligible[i];
            finalNumbers[i] = numbers[i];
        }
        
        bytes32 hash = keccak256(abi.encodePacked(nextDrawId, block.timestamp, finalAddresses, finalNumbers));
        
        snapshots[nextDrawId] = Snapshot({
            timestamp: block.timestamp,
            eligibleCount: count,
            snapshotHash: hash,
            finalized: true
        });
        
        snapshotAddresses[nextDrawId] = finalAddresses;
        snapshotNumbers[nextDrawId] = finalNumbers;
        
        emit SnapshotTaken(nextDrawId, count, hash);
        
        return hash;
    }

    // ============ 开奖 ============
    
    function canDraw() public view returns (bool) {
        if (block.timestamp < lastDrawTime + drawInterval) return false;
        
        uint256 nextDrawId = currentDrawId + 1;
        if (!snapshots[nextDrawId].finalized) return false;
        if (snapshots[nextDrawId].eligibleCount == 0) return false;
        
        return true;
    }
    
    function draw() external nonReentrant returns (uint256) {
        // 先尝试快照
        uint256 nextDrawId = currentDrawId + 1;
        if (!snapshots[nextDrawId].finalized && canTakeSnapshot()) {
            takeSnapshot();
        }
        
        require(canDraw(), "Cannot draw");
        
        // 先处理新税费
        _processNewTax();
        
        currentDrawId++;
        uint256 drawId = currentDrawId;
        lastDrawTime = block.timestamp;
        
        uint256 prizePool = _getAvailablePrizePool();
        uint256 drawerReward = (prizePool * drawerRewardBps) / 10000;
        uint256 actualPrize = prizePool - drawerReward;
        
        uint8 winningNumber = _generateNumber(drawId);
        
        // 从快照获取中奖者
        address[] memory winners = _getWinners(drawId, winningNumber);
        uint256 winnersCount = winners.length;
        uint256 prizePerWinner = winnersCount > 0 ? actualPrize / winnersCount : 0;
        
        draws[drawId] = Draw({
            drawId: drawId,
            timestamp: block.timestamp,
            winningNumber: winningNumber,
            prizePool: actualPrize,
            winnersCount: winnersCount,
            prizePerWinner: prizePerWinner,
            snapshotHash: snapshots[drawId].snapshotHash
        });
        
        // 分配奖金
        if (winnersCount > 0 && prizePerWinner > 0) {
            for (uint256 i = 0; i < winnersCount; i++) {
                pendingPrizes[winners[i]] += prizePerWinner;
            }
            totalDistributed += actualPrize;
        }
        
        // 开奖者奖励
        if (drawerReward > 0) {
            token.safeTransfer(msg.sender, drawerReward);
        }
        
        emit DrawExecuted(drawId, winningNumber, actualPrize, winnersCount);
        
        return drawId;
    }
    
    function _processNewTax() internal {
        uint256 balance = token.balanceOf(address(this));
        uint256 reserved = _getTotalPendingPrizes();
        
        if (balance > reserved) {
            uint256 newTax = balance - reserved;
            uint256 toTeam = (newTax * teamShareBps) / 10000;
            
            if (toTeam > 0) {
                token.safeTransfer(teamWallet, toTeam);
                totalTeamReceived += toTeam;
            }
        }
    }
    
    function _getAvailablePrizePool() internal view returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        uint256 reserved = _getTotalPendingPrizes();
        return balance > reserved ? balance - reserved : 0;
    }
    
    function _getTotalPendingPrizes() internal view returns (uint256 total) {
        for (uint256 i = 0; i < holders.length; i++) {
            total += pendingPrizes[holders[i]];
        }
    }
    
    function _getWinners(uint256 drawId, uint8 winningNumber) internal view returns (address[] memory) {
        address[] storage addresses = snapshotAddresses[drawId];
        uint8[] storage numbers = snapshotNumbers[drawId];
        
        uint256 count = 0;
        for (uint256 i = 0; i < numbers.length; i++) {
            if (numbers[i] == winningNumber) count++;
        }
        
        address[] memory winners = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < numbers.length; i++) {
            if (numbers[i] == winningNumber) {
                winners[idx++] = addresses[i];
            }
        }
        
        return winners;
    }
    
    function _generateNumber(uint256 drawId) internal view returns (uint8) {
        return uint8(uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            block.timestamp,
            block.prevrandao,
            drawId,
            snapshots[drawId].snapshotHash,
            token.balanceOf(address(this))
        ))) % 50) + 1;
    }

    // ============ 领奖 ============
    
    function claimPrize() external nonReentrant {
        uint256 prize = pendingPrizes[msg.sender];
        require(prize > 0, "No prize");
        
        pendingPrizes[msg.sender] = 0;
        token.safeTransfer(msg.sender, prize);
        
        emit PrizeClaimed(msg.sender, prize);
    }

    // ============ 查询函数 ============
    
    function getCurrentPrizePool() external view returns (uint256) {
        return _getAvailablePrizePool();
    }
    
    function getTimeUntilNextDraw() external view returns (uint256) {
        uint256 next = lastDrawTime + drawInterval;
        return block.timestamp >= next ? 0 : next - block.timestamp;
    }
    
    function getHoldersCount() external view returns (uint256) {
        return holders.length;
    }
    
    function getEligibleCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < holders.length; i++) {
            if (isEligible(holders[i])) count++;
        }
    }
    
    function getDrawInfo(uint256 drawId) external view returns (Draw memory) {
        return draws[drawId];
    }
    
    function getPendingPrize(address user) external view returns (uint256) {
        return pendingPrizes[user];
    }
    
    function getUserInfo(address user) external view returns (
        uint8 number,
        uint256 balance,
        uint256 holdingDuration,
        bool eligible,
        uint256 pending
    ) {
        number = holderNumber[user];
        balance = token.balanceOf(user);
        holdingDuration = holdingSince[user] > 0 ? block.timestamp - holdingSince[user] : 0;
        eligible = isEligible(user);
        pending = pendingPrizes[user];
    }

    // ============ 管理函数 ============
    
    function setTeamWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "Invalid");
        teamWallet = wallet;
    }
    
    function setShareBps(uint256 team, uint256 prize) external onlyOwner {
        require(team + prize == 10000, "Must sum to 10000");
        teamShareBps = team;
        prizeShareBps = prize;
    }
    
    function setDrawInterval(uint256 interval) external onlyOwner {
        require(interval >= 30 && interval <= 86400, "Invalid");
        drawInterval = interval;
    }
    
    function setMinHoldingDuration(uint256 duration) external onlyOwner {
        require(duration <= 3600, "Too long");
        minHoldingDuration = duration;
    }
}
