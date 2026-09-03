// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LotteryToken
 * @dev ERC20代币，带有4%交易税：3%进入抽奖奖池，1%给团队
 * @notice 用于Powerball抽奖系统的代币
 */
contract LotteryToken is ERC20, Ownable, ReentrancyGuard {
    // ============ 常量 ============
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 10亿代币
    uint256 public constant LOTTERY_TAX_BPS = 300; // 3% = 300基点
    uint256 public constant TEAM_TAX_BPS = 100;    // 1% = 100基点
    uint256 public constant TOTAL_TAX_BPS = 400;   // 4% = 400基点
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // 最小持币时间（秒）- 默认60秒
    uint256 public minHoldingDuration = 60;

    // ============ 状态变量 ============
    address public lotteryContract;
    address public teamWallet;
    
    // 持币者追踪
    address[] public holders;
    mapping(address => uint256) public holderIndex; // 地址在数组中的索引+1 (0表示不存在)
    mapping(address => bool) public isHolder;
    
    // 持币时间追踪
    mapping(address => uint256) public holdingSince; // 首次持币时间戳
    
    // 号码到持币者的映射 (1-50)
    mapping(uint8 => address[]) public numberToHolders;
    mapping(address => uint8) public holderNumber; // 缓存每个地址的号码
    
    // 免税地址（如LP池、合约地址等）
    mapping(address => bool) public isExcludedFromTax;
    
    // 交易开关
    bool public tradingEnabled;
    
    // ============ 事件 ============
    event TaxCollected(address indexed from, uint256 lotteryAmount, uint256 teamAmount);
    event HolderAdded(address indexed holder, uint8 number, uint256 timestamp);
    event HolderRemoved(address indexed holder, uint8 number);
    event LotteryContractUpdated(address indexed newLotteryContract);
    event TeamWalletUpdated(address indexed newTeamWallet);
    event TradingEnabled();
    event AddressExcludedFromTax(address indexed account, bool excluded);
    event MinHoldingDurationUpdated(uint256 newDuration);

    // ============ 构造函数 ============
    constructor(
        string memory name_,
        string memory symbol_,
        address teamWallet_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        require(teamWallet_ != address(0), "Invalid team wallet");
        
        teamWallet = teamWallet_;
        
        // 排除owner和团队钱包的税
        isExcludedFromTax[msg.sender] = true;
        isExcludedFromTax[teamWallet_] = true;
        
        // 铸造全部代币给owner
        _mint(msg.sender, TOTAL_SUPPLY);
        
        // 添加owner为持币者（立即生效）
        _addHolder(msg.sender);
        holdingSince[msg.sender] = 1; // 设为1表示一直有效
    }

    // ============ 管理函数 ============
    
    /**
     * @dev 设置抽奖合约地址
     */
    function setLotteryContract(address lotteryContract_) external onlyOwner {
        require(lotteryContract_ != address(0), "Invalid lottery contract");
        
        if (lotteryContract != address(0)) {
            isExcludedFromTax[lotteryContract] = false;
        }
        
        lotteryContract = lotteryContract_;
        isExcludedFromTax[lotteryContract_] = true;
        
        emit LotteryContractUpdated(lotteryContract_);
    }
    
    /**
     * @dev 更新团队钱包地址
     */
    function setTeamWallet(address teamWallet_) external onlyOwner {
        require(teamWallet_ != address(0), "Invalid team wallet");
        
        isExcludedFromTax[teamWallet] = false;
        teamWallet = teamWallet_;
        isExcludedFromTax[teamWallet_] = true;
        
        emit TeamWalletUpdated(teamWallet_);
    }
    
    /**
     * @dev 设置最小持币时间
     */
    function setMinHoldingDuration(uint256 duration_) external onlyOwner {
        require(duration_ <= 3600, "Duration too long"); // 最多1小时
        minHoldingDuration = duration_;
        emit MinHoldingDurationUpdated(duration_);
    }
    
    /**
     * @dev 开启交易
     */
    function enableTrading() external onlyOwner {
        require(!tradingEnabled, "Trading already enabled");
        tradingEnabled = true;
        emit TradingEnabled();
    }
    
    /**
     * @dev 设置地址是否免税
     */
    function setExcludedFromTax(address account, bool excluded) external onlyOwner {
        isExcludedFromTax[account] = excluded;
        emit AddressExcludedFromTax(account, excluded);
    }

    // ============ 号码计算 ============
    
    /**
     * @dev 根据地址计算1-50的号码
     */
    function getNumber(address holder) public pure returns (uint8) {
        return uint8(uint256(keccak256(abi.encodePacked(holder))) % 50) + 1;
    }

    // ============ 持币者管理 ============
    
    /**
     * @dev 添加持币者
     */
    function _addHolder(address holder) internal {
        if (!isHolder[holder] && holder != address(0)) {
            isHolder[holder] = true;
            holders.push(holder);
            holderIndex[holder] = holders.length;
            
            // 记录首次持币时间
            holdingSince[holder] = block.timestamp;
            
            // 计算并缓存号码
            uint8 number = getNumber(holder);
            holderNumber[holder] = number;
            numberToHolders[number].push(holder);
            
            emit HolderAdded(holder, number, block.timestamp);
        }
    }
    
    /**
     * @dev 移除持币者
     */
    function _removeHolder(address holder) internal {
        if (isHolder[holder]) {
            isHolder[holder] = false;
            
            // 从holders数组中移除
            uint256 index = holderIndex[holder] - 1;
            uint256 lastIndex = holders.length - 1;
            
            if (index != lastIndex) {
                address lastHolder = holders[lastIndex];
                holders[index] = lastHolder;
                holderIndex[lastHolder] = index + 1;
            }
            
            holders.pop();
            holderIndex[holder] = 0;
            
            // 从号码映射中移除
            uint8 number = holderNumber[holder];
            _removeFromNumberMapping(holder, number);
            holderNumber[holder] = 0;
            
            // 清除持币时间
            holdingSince[holder] = 0;
            
            emit HolderRemoved(holder, number);
        }
    }
    
    /**
     * @dev 从号码映射中移除地址
     */
    function _removeFromNumberMapping(address holder, uint8 number) internal {
        address[] storage holdersForNumber = numberToHolders[number];
        for (uint256 i = 0; i < holdersForNumber.length; i++) {
            if (holdersForNumber[i] == holder) {
                holdersForNumber[i] = holdersForNumber[holdersForNumber.length - 1];
                holdersForNumber.pop();
                break;
            }
        }
    }

    // ============ 转账重写 ============
    
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // 铸造和销毁不收税
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            _updateHolderStatus(from, to);
            return;
        }
        
        // 检查交易是否开启
        if (!tradingEnabled) {
            require(from == owner() || to == owner(), "Trading not enabled");
        }
        
        // 检查是否需要收税
        bool shouldTakeTax = !isExcludedFromTax[from] && !isExcludedFromTax[to];
        
        if (shouldTakeTax && lotteryContract != address(0)) {
            uint256 lotteryTax = (amount * LOTTERY_TAX_BPS) / BPS_DENOMINATOR;
            uint256 teamTax = (amount * TEAM_TAX_BPS) / BPS_DENOMINATOR;
            uint256 totalTax = lotteryTax + teamTax;
            uint256 transferAmount = amount - totalTax;
            
            super._update(from, to, transferAmount);
            super._update(from, lotteryContract, lotteryTax);
            super._update(from, teamWallet, teamTax);
            
            emit TaxCollected(from, lotteryTax, teamTax);
        } else {
            super._update(from, to, amount);
        }
        
        _updateHolderStatus(from, to);
    }
    
    /**
     * @dev 更新持币者状态
     */
    function _updateHolderStatus(address from, address to) internal {
        // 检查发送者是否还有余额
        if (from != address(0) && balanceOf(from) == 0) {
            _removeHolder(from);
        }
        
        // 检查接收者是否是新持币者
        if (to != address(0) && balanceOf(to) > 0 && !isHolder[to]) {
            _addHolder(to);
        }
    }

    // ============ 查询函数 ============
    
    /**
     * @dev 检查地址是否有资格参与开奖（持币超过最小时间）
     */
    function isEligibleForDraw(address holder) public view returns (bool) {
        if (!isHolder[holder]) return false;
        if (balanceOf(holder) == 0) return false;
        if (holdingSince[holder] == 0) return false;
        
        // 检查持币时间是否超过最小要求
        return (block.timestamp - holdingSince[holder]) >= minHoldingDuration;
    }
    
    /**
     * @dev 获取地址的持币时长（秒）
     */
    function getHoldingDuration(address holder) public view returns (uint256) {
        if (holdingSince[holder] == 0) return 0;
        return block.timestamp - holdingSince[holder];
    }
    
    /**
     * @dev 获取有资格参与开奖的持币者数量
     */
    function getEligibleHoldersCount() public view returns (uint256 count) {
        for (uint256 i = 0; i < holders.length; i++) {
            if (isEligibleForDraw(holders[i])) {
                count++;
            }
        }
    }
    
    /**
     * @dev 获取某号码的有资格参与者
     */
    function getEligibleHoldersByNumber(uint8 number) external view returns (address[] memory) {
        require(number >= 1 && number <= 50, "Invalid number");
        
        address[] storage allHolders = numberToHolders[number];
        
        // 先计算有资格的数量
        uint256 eligibleCount = 0;
        for (uint256 i = 0; i < allHolders.length; i++) {
            if (isEligibleForDraw(allHolders[i])) {
                eligibleCount++;
            }
        }
        
        // 创建结果数组
        address[] memory eligibleHolders = new address[](eligibleCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allHolders.length; i++) {
            if (isEligibleForDraw(allHolders[i])) {
                eligibleHolders[index] = allHolders[i];
                index++;
            }
        }
        
        return eligibleHolders;
    }
    
    /**
     * @dev 获取所有有资格的持币者及其号码（用于快照公开）
     */
    function getEligibleHoldersSnapshot() external view returns (
        address[] memory eligibleAddresses,
        uint8[] memory assignedNumbers,
        uint256[] memory balances,
        uint256[] memory holdingDurations
    ) {
        uint256 eligibleCount = getEligibleHoldersCount();
        
        eligibleAddresses = new address[](eligibleCount);
        assignedNumbers = new uint8[](eligibleCount);
        balances = new uint256[](eligibleCount);
        holdingDurations = new uint256[](eligibleCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < holders.length; i++) {
            address holder = holders[i];
            if (isEligibleForDraw(holder)) {
                eligibleAddresses[index] = holder;
                assignedNumbers[index] = holderNumber[holder];
                balances[index] = balanceOf(holder);
                holdingDurations[index] = getHoldingDuration(holder);
                index++;
            }
        }
    }
    
    /**
     * @dev 获取每个号码的有资格持币者数量（用于概率展示）
     */
    function getNumberDistribution() external view returns (uint256[50] memory distribution) {
        for (uint8 num = 1; num <= 50; num++) {
            address[] storage holdersForNum = numberToHolders[num];
            for (uint256 i = 0; i < holdersForNum.length; i++) {
                if (isEligibleForDraw(holdersForNum[i])) {
                    distribution[num - 1]++;
                }
            }
        }
    }
    
    function getHoldersCount() external view returns (uint256) {
        return holders.length;
    }
    
    function getAllHolders() external view returns (address[] memory) {
        return holders;
    }
    
    function getHoldersPaginated(uint256 offset, uint256 limit) 
        external 
        view 
        returns (address[] memory) 
    {
        if (offset >= holders.length) {
            return new address[](0);
        }
        
        uint256 end = offset + limit;
        if (end > holders.length) {
            end = holders.length;
        }
        
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = holders[i];
        }
        
        return result;
    }
    
    function getHoldersByNumber(uint8 number) external view returns (address[] memory) {
        require(number >= 1 && number <= 50, "Invalid number");
        return numberToHolders[number];
    }
    
    function getHoldersCountByNumber(uint8 number) external view returns (uint256) {
        require(number >= 1 && number <= 50, "Invalid number");
        return numberToHolders[number].length;
    }
}
