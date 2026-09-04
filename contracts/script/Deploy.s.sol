// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/LotteryToken.sol";
import "../src/PowerballLottery.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address teamWallet = vm.envAddress("TEAM_WALLET");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. 部署代币
        LotteryToken token = new LotteryToken(
            "Powerball Token",
            "PBALL",
            teamWallet
        );
        console.log("LotteryToken deployed at:", address(token));
        
        // 2. 部署抽奖合约
        PowerballLottery lottery = new PowerballLottery(address(token));
        console.log("PowerballLottery deployed at:", address(lottery));
        
        // 3. 设置抽奖合约地址
        token.setLotteryContract(address(lottery));
        console.log("Lottery contract set in token");
        
        // 4. 开启交易
        token.enableTrading();
        console.log("Trading enabled");
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("Token:", address(token));
        console.log("Lottery:", address(lottery));
        console.log("Team Wallet:", teamWallet);
        console.log("Total Supply:", token.totalSupply() / 1e18, "tokens");
    }
}
