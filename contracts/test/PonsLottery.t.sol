// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/PonsLottery.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MOCK") {
        _mint(msg.sender, 1_000_000_000 * 10**18);
    }
}

contract PonsLotteryTest is Test {
    MockERC20 public token;
    PonsLottery public lottery;

    address public owner = address(1);
    address public teamWallet = address(2);
    address public attacker = address(0xBAD);

    uint256 constant TAX_AMOUNT = 100_000 * 10**18;
    uint256 constant HOLDER_BALANCE = 1_000 * 10**18;

    function setUp() public {
        vm.startPrank(owner);
        token = new MockERC20();
        lottery = new PonsLottery(address(token), teamWallet);
        token.transfer(address(lottery), TAX_AMOUNT);
        vm.stopPrank();
    }

    /// @dev 给 1-50 每个号码都安排一个已注册的持币者，保证开奖必定命中
    function _seedHolderForEveryNumber() internal returns (address[] memory) {
        address[] memory seeded = new address[](50);
        bool[51] memory covered;
        uint256 found;

        for (uint160 i = 1000; found < 50 && i < 10000; i++) {
            address holder = address(i);
            uint8 number = lottery.getNumber(holder);

            if (!covered[number]) {
                covered[number] = true;
                vm.prank(owner);
                token.transfer(holder, HOLDER_BALANCE);
                lottery.registerHolder(holder);
                seeded[found] = holder;
                found++;
            }
        }

        assertEq(found, 50, "failed to cover all 50 numbers");
        return seeded;
    }

    function _runDraw() internal {
        vm.warp(block.timestamp + 61);
        vm.roll(block.number + 1);
        lottery.draw();
    }

    /// @dev processTax(uint256) 曾经让任何人指定任意金额、不做鉴权也不校验，
    ///      反复调用即可把奖池按 teamShareBps 一份一份转给团队钱包直到掏空。
    function testTaxProcessingCannotDrainPrizePool() public {
        uint256 expectedTeamCut = (TAX_AMOUNT * lottery.teamShareBps()) / 10000;
        uint256 expectedPool = TAX_AMOUNT - expectedTeamCut;

        // 结算前后展示的奖池必须一致，不能因为有人触发结算就跳变
        assertEq(lottery.getCurrentPrizePool(), expectedPool);

        // 攻击者反复触发税费结算
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(attacker);
            lottery.processAllTax();
        }

        // 第一次结算之后就再没有「新税费」可分，团队拿到的份额有上限
        assertEq(token.balanceOf(teamWallet), expectedTeamCut);
        assertEq(lottery.totalTeamReceived(), expectedTeamCut);

        // 奖池剩下的部分仍在合约里
        assertEq(token.balanceOf(address(lottery)), expectedPool);
        assertEq(lottery.getCurrentPrizePool(), expectedPool);
    }

    /// @dev 预留金额曾经靠遍历 holders 数组求和，中奖者卖光被移出数组后
    ///      他的奖金就不再被预留，会被当成新税费重新分配掉。
    function testUnclaimedPrizeSurvivesHolderRemoval() public {
        _seedHolderForEveryNumber();
        _runDraw();

        uint8 winningNumber = lottery.getDrawInfo(1).winningNumber;
        address winner;
        for (uint160 i = 1000; i < 10000; i++) {
            if (lottery.isHolder(address(i)) && lottery.holderNumber(address(i)) == winningNumber) {
                winner = address(i);
                break;
            }
        }
        assertTrue(winner != address(0), "no winner found");

        uint256 prize = lottery.getPendingPrize(winner);
        assertTrue(prize > 0, "winner has no prize");

        // 中奖者卖光并退出持币者名单
        uint256 winnerBalance = token.balanceOf(winner);
        vm.prank(winner);
        token.transfer(attacker, winnerBalance);
        lottery.removeHolder(winner);
        assertFalse(lottery.isHolder(winner));

        // 他的奖金仍被预留，不会被后续开奖重新分配
        assertEq(lottery.totalPendingPrizes(), prize);
        assertLe(
            lottery.totalPendingPrizes() + lottery.prizePool(),
            token.balanceOf(address(lottery))
        );

        _runDraw();

        // 退出名单之后依然领得到钱
        vm.prank(winner);
        lottery.claimPrize();
        assertEq(token.balanceOf(winner), prize);
    }

    /// @dev 合约必须始终留得出所有已承诺的奖金
    function testContractAlwaysCoversPromisedPrizes() public {
        _seedHolderForEveryNumber();

        for (uint256 round = 0; round < 5; round++) {
            _runDraw();
            assertGe(
                token.balanceOf(address(lottery)),
                lottery.totalPendingPrizes(),
                "contract cannot cover the prizes it promised"
            );
        }

        assertTrue(lottery.totalPendingPrizes() > 0, "expected at least one winner");
    }

    /// @dev 注册即开始计时，所以尘埃余额不能用来占号
    function testDustBalanceCannotRegister() public {
        address sybil = address(0x5177);

        vm.prank(owner);
        token.transfer(sybil, 1);

        vm.expectRevert("Below minimum balance");
        lottery.registerHolder(sybil);
    }

    function testHolderListIsCapped() public {
        vm.prank(owner);
        lottery.setMaxHolders(2);

        for (uint160 i = 1; i <= 2; i++) {
            vm.prank(owner);
            token.transfer(address(i + 100), HOLDER_BALANCE);
            lottery.registerHolder(address(i + 100));
        }

        vm.prank(owner);
        token.transfer(address(999), HOLDER_BALANCE);

        vm.expectRevert("Holder list full");
        lottery.registerHolder(address(999));
    }

    /// @dev 开奖者能拿到 1% 奖励，所以中奖号码不能依赖调用者可改变的输入。
    ///      合约余额曾经是种子的一部分，任何人转账进来就能改变结果。
    function testWinningNumberIgnoresContractBalance() public {
        _seedHolderForEveryNumber();

        uint256 snapshotId = vm.snapshotState();

        _runDraw();
        uint8 baseline = lottery.getDrawInfo(1).winningNumber;

        vm.revertToState(snapshotId);

        // 攻击者在开奖前往合约里塞钱
        vm.prank(owner);
        token.transfer(address(lottery), 12_345 * 10**18);
        _runDraw();

        assertEq(lottery.getDrawInfo(1).winningNumber, baseline);
    }
}
