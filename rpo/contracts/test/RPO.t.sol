// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {IPORegistry} from "../src/IPORegistry.sol";
import {SubscriptionVault} from "../src/SubscriptionVault.sol";
import {AllocationBooster} from "../src/AllocationBooster.sol";
import {RialtoAdapter} from "../src/adapters/RialtoAdapter.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockRialtoRouter} from "../src/mocks/MockRialtoRouter.sol";

contract RPOTest is Test {
    // Actors
    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address feeCollector = makeAddr("fees");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    // Contracts
    MockERC20 usdg;
    MockERC20 rpoToken;
    MockERC20 dSTRIPE;
    MockRialtoRouter rialtoRouter;
    RialtoAdapter adapter;
    AllocationBooster booster;
    IPORegistry registry;

    // Config
    uint256 constant SUB_WINDOW = 3 days;
    uint256 constant FUL_WINDOW = 4 days;

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 18);
        rpoToken = new MockERC20("RPO", "IPO", 18);
        dSTRIPE = new MockERC20("Stripe Stock Token", "dSTRIPE", 18);

        rialtoRouter = new MockRialtoRouter();
        // Rate: 1 USDG → 0.01 dSTRIPE (i.e. 1 stripe = $100)
        rialtoRouter.setRate(1e16);

        adapter = new RialtoAdapter(owner, address(rialtoRouter), address(0));
        booster = new AllocationBooster(address(rpoToken));

        registry = new IPORegistry(
            owner,
            keeper,
            address(usdg),
            feeCollector,
            booster,
            adapter
        );

        // Seed users
        usdg.mint(alice, 100_000e18);
        usdg.mint(bob, 100_000e18);
        usdg.mint(carol, 100_000e18);
        rpoToken.mint(alice, 100_000e18);
        rpoToken.mint(bob, 100_000e18);
    }

    // -----------------------------------------------------------------
    // Registry
    // -----------------------------------------------------------------

    function test_announceIPO_deploysVault() public {
        vm.prank(keeper);
        address vault = registry.announceIPO(
            "STRIPE",
            "Stripe Inc.",
            SUB_WINDOW,
            FUL_WINDOW
        );

        IPORegistry.IPO memory ipo = registry.getIPO("STRIPE");
        assertEq(ipo.vault, vault);
        assertEq(uint(ipo.status), uint(IPORegistry.Status.ANNOUNCED));
        assertEq(SubscriptionVault(vault).ticker(), "STRIPE");
    }

    function test_announceIPO_onlyKeeper() public {
        vm.prank(alice);
        vm.expectRevert("not keeper");
        registry.announceIPO("X", "X", 1, 1);
    }

    // -----------------------------------------------------------------
    // Subscribe / cancel
    // -----------------------------------------------------------------

    function test_subscribe_addsDepositAndWeight() public {
        SubscriptionVault vault = _bootstrapVault("STRIPE");

        vm.startPrank(alice);
        usdg.approve(address(vault), 5_000e18);
        vault.subscribe(5_000e18);
        vm.stopPrank();

        assertEq(vault.deposits(alice), 5_000e18);
        assertEq(vault.totalUSDG(), 5_000e18);
        // Without staking $RPO, boost = 1x → weight == amount
        assertEq(vault.weights(alice), 5_000e18);
    }

    function test_subscribe_appliesBoost() public {
        SubscriptionVault vault = _bootstrapVault("STRIPE");

        // Alice stakes 10k $RPO, becoming the only staker → boost approaches MAX
        vm.startPrank(alice);
        rpoToken.approve(address(booster), 10_000e18);
        booster.stake(10_000e18);
        usdg.approve(address(vault), 1_000e18);
        vault.subscribe(1_000e18);
        vm.stopPrank();

        // Boost is up to 3x (share = 100%)
        uint256 boost = booster.getBoost(alice);
        assertEq(boost, 3e18);
        assertEq(vault.weights(alice), 3_000e18);
    }

    function test_cancel_returnsFunds() public {
        SubscriptionVault vault = _bootstrapVault("STRIPE");

        vm.startPrank(alice);
        usdg.approve(address(vault), 1_000e18);
        vault.subscribe(1_000e18);
        uint256 balBefore = usdg.balanceOf(alice);
        vault.cancel();
        vm.stopPrank();

        assertEq(usdg.balanceOf(alice) - balBefore, 1_000e18);
        assertEq(vault.deposits(alice), 0);
        assertEq(vault.totalUSDG(), 0);
    }

    function test_subscribe_afterDeadline_reverts() public {
        SubscriptionVault vault = _bootstrapVault("STRIPE");
        vm.warp(block.timestamp + SUB_WINDOW + 1);

        vm.startPrank(alice);
        usdg.approve(address(vault), 100e18);
        vm.expectRevert(SubscriptionVault.SubscriptionClosed.selector);
        vault.subscribe(100e18);
    }

    // -----------------------------------------------------------------
    // Fulfill / claim
    // -----------------------------------------------------------------

    function test_fulfillAndClaim_proportionalAllocation() public {
        SubscriptionVault vault = _bootstrapVault("STRIPE");

        // Two subscribers: alice 3000, bob 1000
        vm.startPrank(alice);
        usdg.approve(address(vault), 3_000e18);
        vault.subscribe(3_000e18);
        vm.stopPrank();

        vm.startPrank(bob);
        usdg.approve(address(vault), 1_000e18);
        vault.subscribe(1_000e18);
        vm.stopPrank();

        // Wait past subscription deadline
        vm.warp(block.timestamp + SUB_WINDOW + 1);

        // Keeper marks launched
        vm.prank(keeper);
        registry.markLaunched("STRIPE", address(dSTRIPE), 0);

        assertTrue(vault.fulfilled());
        // 4000 USDG * 2% fee = 80 USDG fee, 3920 traded
        // rate 1e16 → 39.2 dSTRIPE
        uint256 totalStock = 3_920e18 * 1e16 / 1e18;
        assertEq(vault.totalStockTokenReceived(), totalStock);
        assertEq(usdg.balanceOf(feeCollector), 80e18);

        // Alice claims 3/4, Bob claims 1/4
        uint256 aliceExpected = totalStock * 3 / 4;
        uint256 bobExpected = totalStock * 1 / 4;

        vm.prank(alice); vault.claim();
        vm.prank(bob);   vault.claim();

        assertEq(dSTRIPE.balanceOf(alice), aliceExpected);
        assertEq(dSTRIPE.balanceOf(bob), bobExpected);
    }

    function test_doubleClaim_reverts() public {
        SubscriptionVault vault = _bootstrapVault("STRIPE");
        vm.startPrank(alice);
        usdg.approve(address(vault), 1_000e18);
        vault.subscribe(1_000e18);
        vm.stopPrank();

        vm.warp(block.timestamp + SUB_WINDOW + 1);
        vm.prank(keeper);
        registry.markLaunched("STRIPE", address(dSTRIPE), 0);

        vm.prank(alice); vault.claim();
        vm.prank(alice);
        vm.expectRevert(SubscriptionVault.NothingToClaim.selector);
        vault.claim();
    }

    // -----------------------------------------------------------------
    // Refund flow
    // -----------------------------------------------------------------

    function test_refund_afterFulfillmentDeadline() public {
        SubscriptionVault vault = _bootstrapVault("STRIPE");

        vm.startPrank(alice);
        usdg.approve(address(vault), 2_000e18);
        vault.subscribe(2_000e18);
        vm.stopPrank();

        // No launch happens; time passes both deadlines
        vm.warp(block.timestamp + SUB_WINDOW + FUL_WINDOW + 1);
        registry.activateRefund("STRIPE");

        uint256 balBefore = usdg.balanceOf(alice);
        vm.prank(alice); vault.withdrawRefund();
        assertEq(usdg.balanceOf(alice) - balBefore, 2_000e18);
    }

    // -----------------------------------------------------------------
    // Booster
    // -----------------------------------------------------------------

    function test_booster_stakeLockAndUnstake() public {
        vm.startPrank(alice);
        rpoToken.approve(address(booster), 5_000e18);
        booster.stake(5_000e18);
        vm.expectRevert(AllocationBooster.Locked.selector);
        booster.unstake(1_000e18);

        vm.warp(block.timestamp + booster.MIN_LOCK() + 1);
        booster.unstake(1_000e18);
        vm.stopPrank();

        (uint256 amt, ) = booster.stakes(alice);
        assertEq(amt, 4_000e18);
    }

    function test_boosterCurve_capsAt3x() public {
        vm.startPrank(alice);
        rpoToken.approve(address(booster), 100_000e18);
        booster.stake(100_000e18);
        vm.stopPrank();
        assertEq(booster.getBoost(alice), 3e18);
    }

    function test_boosterCurve_nonStakerIs1x() public view {
        assertEq(booster.getBoost(carol), 1e18);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    function _bootstrapVault(string memory ticker) internal returns (SubscriptionVault) {
        vm.prank(keeper);
        address v = registry.announceIPO(ticker, ticker, SUB_WINDOW, FUL_WINDOW);
        return SubscriptionVault(v);
    }
}
