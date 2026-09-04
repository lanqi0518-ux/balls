// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TaxReceiver
 * @dev 税费接收代理合约
 * @notice 作为 Pons 的 creatorFeeRecipient，可以后续设置真正的抽奖合约
 */
contract TaxReceiver is Ownable {
    using SafeERC20 for IERC20;
    
    address public lotteryContract;
    address public teamWallet;
    IERC20 public token;
    
    // 费率（基点）
    uint256 public teamShareBps = 1892; // 18.92% → 团队
    uint256 public prizeShareBps = 8108; // 81.08% → 奖池
    
    bool public autoForward = true;
    
    event LotteryContractSet(address indexed lottery);
    event TaxForwarded(uint256 toPrize, uint256 toTeam);
    event ManualWithdraw(address indexed to, uint256 amount);
    
    constructor(address teamWallet_) Ownable(msg.sender) {
        require(teamWallet_ != address(0), "Invalid team wallet");
        teamWallet = teamWallet_;
    }
    
    /**
     * @dev 设置代币地址（发射后调用）
     */
    function setToken(address token_) external onlyOwner {
        require(token_ != address(0), "Invalid token");
        token = IERC20(token_);
    }
    
    /**
     * @dev 设置抽奖合约地址
     */
    function setLotteryContract(address lottery_) external onlyOwner {
        require(lottery_ != address(0), "Invalid lottery");
        lotteryContract = lottery_;
        emit LotteryContractSet(lottery_);
    }
    
    /**
     * @dev 设置团队钱包
     */
    function setTeamWallet(address wallet_) external onlyOwner {
        require(wallet_ != address(0), "Invalid wallet");
        teamWallet = wallet_;
    }
    
    /**
     * @dev 设置分配比例
     */
    function setShares(uint256 team_, uint256 prize_) external onlyOwner {
        require(team_ + prize_ == 10000, "Must sum to 10000");
        teamShareBps = team_;
        prizeShareBps = prize_;
    }
    
    /**
     * @dev 设置是否自动转发
     */
    function setAutoForward(bool auto_) external onlyOwner {
        autoForward = auto_;
    }
    
    /**
     * @dev 转发税费到抽奖合约和团队
     */
    function forwardTax() external {
        require(address(token) != address(0), "Token not set");
        
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No balance");
        
        uint256 toTeam = (balance * teamShareBps) / 10000;
        uint256 toPrize = balance - toTeam;
        
        // 转给团队
        if (toTeam > 0) {
            token.safeTransfer(teamWallet, toTeam);
        }
        
        // 转给抽奖合约
        if (toPrize > 0 && lotteryContract != address(0)) {
            token.safeTransfer(lotteryContract, toPrize);
        }
        
        emit TaxForwarded(toPrize, toTeam);
    }
    
    /**
     * @dev 手动提取（紧急情况）
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(address(token) != address(0), "Token not set");
        token.safeTransfer(to, amount);
        emit ManualWithdraw(to, amount);
    }
    
    /**
     * @dev 查询余额
     */
    function getBalance() external view returns (uint256) {
        if (address(token) == address(0)) return 0;
        return token.balanceOf(address(this));
    }
}
