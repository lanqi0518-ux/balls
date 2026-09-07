// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LotteryToken.sol";
import "../src/PowerballLottery.sol";

contract LotteryTokenTest is Test {
    LotteryToken public token;
    PowerballLottery public lottery;
    
    address public owner = address(1);
    address public teamWallet = address(2);
    address public user1 = address(3);
    address public user2 = address(4);
    address public user3 = address(5);
    
    function setUp() public {
        vm.startPrank(owner);
        
        // 部署代币
        token = new LotteryToken("Powerball Token", "PBALL", teamWallet);
        
        // 部署抽奖合约
        lottery = new PowerballLottery(address(token));
        
        // 设置抽奖合约
        token.setLotteryContract(address(lottery));
        
        // 开启交易
        token.enableTrading();
        
        vm.stopPrank();
    }
    
    function testInitialSupply() public view {
        assertEq(token.totalSupply(), 1_000_000_000 * 10**18);
        assertEq(token.balanceOf(owner), 1_000_000_000 * 10**18);
    }
    
    function testGetNumber() public view {
        // 测试号码计算
        uint8 number1 = token.getNumber(user1);
        uint8 number2 = token.getNumber(user2);
        
        assertTrue(number1 >= 1 && number1 <= 50);
        assertTrue(number2 >= 1 && number2 <= 50);
        
        // 同一地址应该总是得到同一号码
        assertEq(number1, token.getNumber(user1));
    }
    
    function testTaxOnTransfer() public {
        vm.startPrank(owner);
        
        // 转账给user1（owner免税）
        token.transfer(user1, 1000 * 10**18);
        assertEq(token.balanceOf(user1), 1000 * 10**18);
        
        vm.stopPrank();
        
        // user1转给user2应该收税
        vm.startPrank(user1);
        token.transfer(user2, 100 * 10**18);
        vm.stopPrank();
        
        // user2应该收到96%（100 - 4%税）
        assertEq(token.balanceOf(user2), 96 * 10**18);
        
        // 抽奖合约应该收到3%
        assertEq(token.balanceOf(address(lottery)), 3 * 10**18);
        
        // 团队钱包应该收到1%
        assertEq(token.balanceOf(teamWallet), 1 * 10**18);
    }
    
    function testHolderTracking() public {
        vm.startPrank(owner);
        
        // 初始只有owner是持币者
        assertEq(token.getHoldersCount(), 1);
        assertTrue(token.isHolder(owner));
        
        // 转账后user1成为持币者
        token.transfer(user1, 1000 * 10**18);
        assertEq(token.getHoldersCount(), 2);
        assertTrue(token.isHolder(user1));
        
        vm.stopPrank();
        
        // user1转出全部代币后不再是持币者
        vm.startPrank(user1);
        token.transfer(user2, token.balanceOf(user1));
        vm.stopPrank();
        
        assertFalse(token.isHolder(user1));
        assertTrue(token.isHolder(user2));
    }
    
    function testNumberMapping() public {
        vm.startPrank(owner);
        
        token.transfer(user1, 1000 * 10**18);
        token.transfer(user2, 1000 * 10**18);
        token.transfer(user3, 1000 * 10**18);
        
        vm.stopPrank();
        
        // 检查号码映射
        uint8 num1 = token.getNumber(user1);
        uint8 num2 = token.getNumber(user2);
        uint8 num3 = token.getNumber(user3);
        
        address[] memory holdersNum1 = token.getHoldersByNumber(num1);
        
        // 至少应该包含user1
        bool found = false;
        for (uint i = 0; i < holdersNum1.length; i++) {
            if (holdersNum1[i] == user1) {
                found = true;
                break;
            }
        }
        assertTrue(found);
    }
}

contract PowerballLotteryTest is Test {
    LotteryToken public token;
    PowerballLottery public lottery;
    
    address public owner = address(1);
    address public teamWallet = address(2);
    address public user1 = address(3);
    address public user2 = address(4);
    
    function setUp() public {
        vm.startPrank(owner);
        
        token = new LotteryToken("Powerball Token", "PBALL", teamWallet);
        lottery = new PowerballLottery(address(token));
        token.setLotteryContract(address(lottery));
        token.enableTrading();
        
        // 分发代币给用户
        token.transfer(user1, 100_000 * 10**18);
        token.transfer(user2, 100_000 * 10**18);
        
        vm.stopPrank();
        
        // 产生一些交易税
        vm.prank(user1);
        token.transfer(user2, 10_000 * 10**18);
    }

    /// @dev 给 1-50 每个号码都安排一个持币者，这样开奖必定命中，
    ///      测试才不会依赖随机号码碰巧落在少数几个持币者身上。
    function _seedHolderForEveryNumber() internal {
        bool[51] memory covered;
        uint256 found;

        for (uint160 i = 1000; found < 50 && i < 10000; i++) {
            address holder = address(i);
            uint8 number = token.getNumber(holder);

            if (!covered[number]) {
                covered[number] = true;
                found++;
                vm.prank(owner);
                token.transfer(holder, 1_000 * 10**18);
            }
        }

        assertEq(found, 50, "failed to cover all 50 numbers");
    }
    
    function testCanDrawAfterInterval() public {
        // 初始状态：刚部署，需要等待
        assertFalse(lottery.canDraw());
        
        // 快进时间
        vm.warp(block.timestamp + 61);
        
        assertTrue(lottery.canDraw());
    }
    
    function testDraw() public {
        // 快进时间
        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        
        uint256 prizePoolBefore = token.balanceOf(address(lottery));
        assertTrue(prizePoolBefore > 0, "Prize pool should have tokens");
        
        // 执行开奖
        uint256 drawId = lottery.draw();
        
        assertEq(drawId, 1);
        assertEq(lottery.totalDraws(), 1);
        
        // 检查开奖记录
        PowerballLottery.Draw memory drawInfo = lottery.getDrawInfo(1);
        assertTrue(drawInfo.winningNumber >= 1 && drawInfo.winningNumber <= 50);
    }
    
    function testClaimPrize() public {
        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        
        lottery.draw();
        
        PowerballLottery.Draw memory drawInfo = lottery.getDrawInfo(1);
        
        // 找到一个中奖者
        address[] memory winners = token.getHoldersByNumber(drawInfo.winningNumber);
        
        if (winners.length > 0) {
            address winner = winners[0];
            uint256 pending = lottery.getPendingPrize(winner);
            
            if (pending > 0) {
                uint256 balanceBefore = token.balanceOf(winner);
                
                vm.prank(winner);
                lottery.claimPrize();
                
                uint256 balanceAfter = token.balanceOf(winner);
                assertEq(balanceAfter - balanceBefore, pending);
                assertEq(lottery.getPendingPrize(winner), 0);
            }
        }
    }
    
    function testDrawerReward() public {
        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        
        address drawer = address(100);
        uint256 prizePool = token.balanceOf(address(lottery));
        uint256 expectedReward = (prizePool * 100) / 10000; // 1%
        
        vm.prank(drawer);
        lottery.draw();
        
        // 开奖者应该收到奖励
        assertEq(token.balanceOf(drawer), expectedReward);
    }
    
    function testGetUserNumber() public view {
        uint8 num1 = lottery.getUserNumber(user1);
        uint8 num2 = lottery.getUserNumber(user2);
        
        assertTrue(num1 >= 1 && num1 <= 50);
        assertTrue(num2 >= 1 && num2 <= 50);
    }
    
    function testGetStats() public view {
        (uint256 totalDraws, uint256 totalDistributed, uint256 currentPool, uint256 holders) = lottery.getStats();
        
        assertEq(totalDraws, 0);
        assertTrue(currentPool > 0);
        assertTrue(holders > 0);
    }

    /// @dev 奖池曾经直接取合约余额，而余额里含有已承诺但未领取的奖金，
    ///      于是每一轮都把同一笔钱重新发一遍，承诺总额最终超过实际持有量。
    function testUnclaimedPrizesAreNotRedistributed() public {
        _seedHolderForEveryNumber();

        for (uint256 round = 0; round < 5; round++) {
            vm.warp(block.timestamp + 61);
            vm.roll(block.number + 1);
            lottery.draw();

            // 合约必须始终留得出所有已承诺的奖金
            assertGe(
                token.balanceOf(address(lottery)),
                lottery.totalPendingPrizes(),
                "contract cannot cover the prizes it promised"
            );

            // 可分配奖池不含已承诺部分
            assertEq(
                lottery.getCurrentPrizePool(),
                token.balanceOf(address(lottery)) - lottery.totalPendingPrizes()
            );
        }

        assertTrue(lottery.totalPendingPrizes() > 0, "expected at least one winner in 5 rounds");
    }

    /// @dev 每一位中奖者都必须真的能把奖金领走
    function testEveryWinnerCanClaim() public {
        address[] memory candidates = new address[](3);
        candidates[0] = owner;
        candidates[1] = user1;
        candidates[2] = user2;

        for (uint256 round = 0; round < 5; round++) {
            vm.warp(block.timestamp + 61);
            vm.roll(block.number + 1);
            lottery.draw();
        }

        for (uint256 i = 0; i < candidates.length; i++) {
            uint256 pending = lottery.getPendingPrize(candidates[i]);
            if (pending == 0) continue;

            uint256 before = token.balanceOf(candidates[i]);
            vm.prank(candidates[i]);
            lottery.claimPrize();

            assertEq(token.balanceOf(candidates[i]) - before, pending);
            assertEq(lottery.getPendingPrize(candidates[i]), 0);
        }

        assertEq(lottery.totalPendingPrizes(), 0);
    }

    function testEmergencyWithdrawCannotStrandPrizes() public {
        _seedHolderForEveryNumber();

        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        lottery.draw();

        uint256 pending = lottery.totalPendingPrizes();
        assertTrue(pending > 0, "expected a winner");

        uint256 balance = token.balanceOf(address(lottery));

        vm.prank(owner);
        vm.expectRevert("Would strand unclaimed prizes");
        lottery.emergencyWithdraw(address(token), balance);

        // 只提取未被承诺的部分是允许的
        vm.prank(owner);
        lottery.emergencyWithdraw(address(token), balance - pending);

        assertEq(token.balanceOf(address(lottery)), pending);
    }

    /// @dev 开奖者能拿到 1% 奖励，所以中奖号码不能依赖调用者可选的输入
    function testWinningNumberDoesNotDependOnCaller() public {
        uint256 snapshotId = vm.snapshotState();

        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        vm.prank(address(0xA11CE));
        lottery.draw();
        uint8 numberFromAlice = lottery.getDrawInfo(1).winningNumber;

        vm.revertToState(snapshotId);

        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        vm.prank(address(0xB0B));
        lottery.draw();
        uint8 numberFromBob = lottery.getDrawInfo(1).winningNumber;

        assertEq(numberFromAlice, numberFromBob);
    }
}
