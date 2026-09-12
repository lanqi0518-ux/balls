"use client";

/**
 * Live USDG → dSTOCK buy widget powered by Uniswap V4 on Robinhood
 * Chain. The whole flow is real — nothing simulated:
 *
 *   1. Read pool mid via PoolManager.extsload (refetched every 30s)
 *   2. Show quote = amountIn / usdgPerStock, with slippage floor
 *   3. Approve USDG → Permit2 if allowance is short (one-time forever)
 *   4. Approve Permit2 → UR if that allowance is short (recurring)
 *   5. Call UniversalRouter.execute(0x10, [V4_SWAP input], deadline)
 *   6. On confirm, refetch USDG + dSTOCK balances so UI shows the fill
 *
 * The buttons all disable themselves when a step is pending, so the
 * widget can never re-enter or double-fire.
 */

import { useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { ArrowUpRight, Bolt, Check, Shield } from "@/components/ui/Icons";
import { fmtNum, fmtUSD } from "@/lib/format";
import {
  useAllowance,
  useErc20Balance,
  usePermit2Allowance,
  useUsdgBalance,
  useV4PoolMid,
} from "@/lib/onchain/reads";
import { useErc20Approve, usePermit2Approve, useV4Swap } from "@/lib/onchain/writes";
import { CANONICAL_USDG, robinhoodChain } from "@/lib/chain";
import { PERMIT2_ADDRESS, V4_POOLS } from "@/lib/robinhood/v4";
import type { StockToken } from "@/lib/robinhood/tokens";

const USDG_DECIMALS = 6;
const MIN_TRADE_USDG = 1;

export function BuyPanel({
  token,
  priceUsd,
}: {
  token: StockToken;
  priceUsd: number | null;
}) {
  const ticker = token.ticker.toUpperCase();
  const pool = V4_POOLS[ticker as keyof typeof V4_POOLS];

  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const onCorrectChain =
    !isConnected || currentChainId === robinhoodChain.id;

  const usdgBalance = useUsdgBalance();
  const stockBalance = useErc20Balance(token.address);
  const poolMid = useV4PoolMid(ticker);

  const usdgToPermit2 = useAllowance(CANONICAL_USDG, PERMIT2_ADDRESS);
  const permit2ToUR = usePermit2Allowance(CANONICAL_USDG);

  const approveUsdg = useErc20Approve(CANONICAL_USDG, PERMIT2_ADDRESS);
  const approvePermit2 = usePermit2Approve(CANONICAL_USDG);
  const swap = useV4Swap({
    poolKey: pool?.poolKey ?? {
      currency0: CANONICAL_USDG,
      currency1: token.address,
      fee: 0,
      tickSpacing: 0,
      hooks: "0x0000000000000000000000000000000000000000",
    },
    zeroForOne: !!pool?.usdgIsCurrency0,
  });

  const [amountStr, setAmountStr] = useState("100");
  const [slippagePct, setSlippagePct] = useState(1);

  const amount = Number(amountStr) || 0;
  const amountUnits = BigInt(Math.floor(amount * 10 ** USDG_DECIMALS));

  const balanceUSDG = Number(usdgBalance.data) / 10 ** USDG_DECIMALS;
  const balanceStock = Number(stockBalance.data) / 10 ** token.decimals;

  // Live V4 mid — this is what the pool would fill at with zero fee /
  // zero slippage / infinitely thin trade. Fees + curvature will make
  // the actual fill slightly worse.
  const midUsdgPerStock = poolMid.data.usdgPerStock || 0;
  const lpFeePct =
    poolMid.data.lpFee > 0 ? poolMid.data.lpFee / 1_000_000 : 0.001; // fallback 0.1%
  const expectedStock =
    midUsdgPerStock > 0 ? amount / midUsdgPerStock : 0;
  const minOutStock = expectedStock * (1 - slippagePct / 100);
  const minOutStockUnits = BigInt(
    Math.max(0, Math.floor(minOutStock * 10 ** token.decimals))
  );

  const needsUsdgApprove =
    isConnected && amountUnits > 0n && usdgToPermit2.data < amountUnits;
  const needsPermit2Approve =
    isConnected &&
    amountUnits > 0n &&
    (permit2ToUR.data.amount < amountUnits ||
      permit2ToUR.data.expiration <=
        BigInt(Math.floor(Date.now() / 1000)));

  const validation = useMemo(() => {
    if (!isConnected)
      return { ok: false, hint: "Connect wallet to buy" };
    if (!onCorrectChain)
      return { ok: true, hint: "Switch to Robinhood Chain" };
    if (!pool)
      return { ok: false, hint: `No V4 pool configured for ${ticker}` };
    if (midUsdgPerStock <= 0)
      return { ok: false, hint: "Live price loading…" };
    if (amount < MIN_TRADE_USDG)
      return { ok: false, hint: `Enter at least ${MIN_TRADE_USDG} USDG` };
    if (amount > balanceUSDG)
      return {
        ok: false,
        hint:
          balanceUSDG <= 0
            ? "You have 0 USDG on RH Chain — bridge first"
            : `Insufficient USDG (have ${fmtUSD(balanceUSDG)})`,
      };
    if (needsUsdgApprove) return { ok: true, hint: "Approve USDG → Permit2" };
    if (needsPermit2Approve)
      return { ok: true, hint: "Approve Permit2 → UniversalRouter" };
    return { ok: true, hint: `Buy ~${fmtNum(expectedStock, 4)} d${ticker}` };
  }, [
    amount,
    balanceUSDG,
    expectedStock,
    isConnected,
    midUsdgPerStock,
    needsPermit2Approve,
    needsUsdgApprove,
    onCorrectChain,
    pool,
    ticker,
  ]);

  const busy =
    approveUsdg.pending ||
    approvePermit2.pending ||
    swap.pending ||
    switchPending;

  async function handlePrimary() {
    if (!validation.ok || busy) return;
    if (!onCorrectChain) {
      try {
        await switchChainAsync({ chainId: robinhoodChain.id });
      } catch (e: any) {
        toast.error(
          e?.shortMessage ??
            "Add Robinhood Chain (id 4663) to your wallet first"
        );
      }
      return;
    }
    if (needsUsdgApprove) {
      await approveUsdg.run((1n << 255n) - 1n, {
        onConfirmed: () => usdgToPermit2.refetch(),
      });
      return;
    }
    if (needsPermit2Approve) {
      await approvePermit2.run({ onConfirmed: () => permit2ToUR.refetch() });
      return;
    }
    await swap.run(
      {
        amountInUsdg6: amountUnits,
        amountOutMinStock18: minOutStockUnits,
        deadlineSeconds: 900,
      },
      {
        onConfirmed: () => {
          usdgBalance.refetch();
          stockBalance.refetch();
          poolMid.refetch();
        },
      }
    );
  }

  const setPreset = (frac: number) => {
    setAmountStr(String(Math.max(0, Math.floor(balanceUSDG * frac))));
  };

  // Effective price shown to the user — Chainlink first (matches the top
  // header), fall back to pool mid.
  const displayPrice = priceUsd ?? midUsdgPerStock;
  const feeShownBps = Math.round(lpFeePct * 10000);

  if (!pool) {
    return (
      <div className="card p-6">
        <div className="text-sm text-ink-900 font-semibold mb-2">
          No V4 pool configured for {ticker}
        </div>
        <div className="text-xs text-ink-500 leading-relaxed">
          {ticker} does not yet have a curated deep pool on Robinhood
          Chain. Add it to <code className="font-mono">V4_POOLS</code>{" "}
          in <code>lib/robinhood/v4.ts</code> once one has been
          initialized.
        </div>
      </div>
    );
  }

  return (
    <div className="card-floating p-6 lg:p-8 sticky top-24 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-500">
            Buy d{ticker} · live
          </div>
          <div className="text-sm text-ink-900 font-semibold mt-1">
            Uniswap V4 · Robinhood Chain
          </div>
        </div>
        <Badge
          variant={midUsdgPerStock > 0 ? "forest" : "peach"}
          dot={midUsdgPerStock > 0}
        >
          {midUsdgPerStock > 0 ? "Pool live" : "Loading pool"}
        </Badge>
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-2 block">
          You pay
        </label>
        <div className="rounded-xl bg-paper-100 border border-line p-4 flex items-center gap-3">
          <input
            className="bg-transparent text-2xl font-mono text-ink-900 outline-none flex-1 tabular-nums placeholder:text-ink-400"
            value={amountStr}
            onChange={(e) =>
              setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))
            }
            placeholder="100"
            inputMode="decimal"
          />
          <span className="text-sm text-ink-500">USDG</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-ink-500">
            Balance:{" "}
            <span className="font-mono">{fmtUSD(balanceUSDG)}</span>
          </span>
          <div className="flex gap-2">
            <button
              className="text-ink-500 hover:text-ink-900"
              onClick={() => setPreset(0.25)}
              type="button"
            >
              25%
            </button>
            <button
              className="text-ink-500 hover:text-ink-900"
              onClick={() => setPreset(0.5)}
              type="button"
            >
              50%
            </button>
            <button
              className="text-ink-500 hover:text-ink-900"
              onClick={() => setPreset(1)}
              type="button"
            >
              MAX
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-2 block">
          You receive (est.)
        </label>
        <div className="rounded-xl bg-paper-100 border border-line p-4 flex items-center gap-3">
          <div className="text-2xl font-mono text-ink-900 tabular-nums flex-1">
            {expectedStock > 0 ? fmtNum(expectedStock, 6) : "—"}
          </div>
          <span className="text-sm text-ink-500">d{ticker}</span>
        </div>
        <div className="mt-2 text-[11px] text-ink-500">
          {midUsdgPerStock > 0
            ? `Live pool mid: ${fmtUSD(midUsdgPerStock)} per d${ticker}`
            : "Pool price unavailable"}
          {priceUsd && midUsdgPerStock > 0
            ? ` · Chainlink: ${fmtUSD(priceUsd)} (${
                (((midUsdgPerStock - priceUsd) / priceUsd) * 100).toFixed(2)
              }% vs mid)`
            : ""}
        </div>
      </div>

      <div className="space-y-2 text-sm border-t border-line pt-4">
        <Row
          k="LP fee"
          v={
            pool.poolKey.fee === 8388608
              ? "dynamic (hook)"
              : `${(lpFeePct * 100).toFixed(3)}% (${feeShownBps} bps)`
          }
        />
        <Row
          k="Max slippage"
          v={
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                className="text-ink-500 hover:text-ink-900 disabled:opacity-40"
                onClick={() =>
                  setSlippagePct((s) => Math.max(0.1, +(s - 0.5).toFixed(1)))
                }
                disabled={slippagePct <= 0.5}
              >
                −
              </button>
              <span className="font-mono">{slippagePct.toFixed(2)}%</span>
              <button
                type="button"
                className="text-ink-500 hover:text-ink-900 disabled:opacity-40"
                onClick={() =>
                  setSlippagePct((s) => Math.min(50, +(s + 0.5).toFixed(1)))
                }
                disabled={slippagePct >= 50}
              >
                +
              </button>
            </span>
          }
        />
        <Row
          k="Min received"
          v={
            minOutStock > 0
              ? `${fmtNum(minOutStock, 6)} d${ticker}`
              : "—"
          }
        />
        <Row
          k={`Wallet d${ticker}`}
          v={
            balanceStock > 0 ? `${fmtNum(balanceStock, 4)} d${ticker}` : "0"
          }
          tone={balanceStock > 0 ? "forest" : undefined}
        />
      </div>

      {isConnected ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!validation.ok || busy}
          onClick={handlePrimary}
          trailingIcon={
            !busy && validation.ok ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : undefined
          }
        >
          {busy
            ? switchPending
              ? "Switching network…"
              : approveUsdg.pending
              ? "Approving USDG…"
              : approvePermit2.pending
              ? "Approving Permit2…"
              : "Swapping…"
            : validation.hint}
        </Button>
      ) : (
        <div className="space-y-3">
          <ConnectButton
            size="md"
            variant="primary"
            className="w-full [&>div]:w-full [&_button]:w-full [&_button]:justify-center"
            label="Connect wallet to buy"
          />
          <div className="text-[11px] text-ink-500 leading-relaxed">
            Need a wallet? Install{" "}
            <a
              href="https://metamask.io/download"
              target="_blank"
              rel="noreferrer"
              className="text-forest-500 hover:underline"
            >
              MetaMask
            </a>{" "}
            or{" "}
            <a
              href="https://rabby.io"
              target="_blank"
              rel="noreferrer"
              className="text-forest-500 hover:underline"
            >
              Rabby
            </a>{" "}
            (any EVM wallet works). On mobile, open this page{" "}
            <em>inside</em> your wallet&apos;s browser tab.
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-line">
        <TrustBadge
          Icon={Bolt}
          title="Instant"
          body="Fills at the current pool price — no waitlist."
        />
        <TrustBadge
          Icon={Shield}
          title="Non-custodial"
          body="Funds route USDG → Permit2 → UR → PoolManager."
        />
        <TrustBadge
          Icon={Check}
          title="Verifiable"
          body={`Pool ${pool.poolId.slice(0, 6)}…${pool.poolId.slice(-4)} live now.`}
        />
      </div>

      <div className="pt-3 border-t border-line">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 mb-2">
          Need USDG on Robinhood Chain?
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <a
            href="https://app.across.to/?toChain=4663&outputToken=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line bg-white hover:bg-paper-100 px-2 py-1.5 text-center transition-colors"
          >
            <div className="font-semibold text-ink-900">Across</div>
            <div className="text-ink-500">bridge · ~2s</div>
          </a>
          <a
            href="https://buy.moonpay.com/?defaultCurrencyCode=usdg&defaultNetwork=robinhood_chain"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line bg-white hover:bg-paper-100 px-2 py-1.5 text-center transition-colors"
          >
            <div className="font-semibold text-ink-900">MoonPay</div>
            <div className="text-ink-500">card / bank</div>
          </a>
          <a
            href="https://app.garden.finance/swap?to=robinhoodChain&toAsset=USDG"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line bg-white hover:bg-paper-100 px-2 py-1.5 text-center transition-colors"
          >
            <div className="font-semibold text-ink-900">Garden</div>
            <div className="text-ink-500">BTC · SOL · ETH</div>
          </a>
        </div>
      </div>

      <p className="text-[11px] text-ink-500 leading-relaxed">
        Real Uniswap V4 swap through UniversalRouter{" "}
        <span className="font-mono">
          0x8876…C0904
        </span>{" "}
        on Robinhood Chain (id 4663). This buys the already-minted
        Robinhood Stock Token — a Reg-S security. Not available to
        U.S., Canadian, U.K., Swiss, or U.A.E. residents.
      </p>
    </div>
  );
}

function Row({
  k,
  v,
  tone,
}: {
  k: string;
  v: React.ReactNode;
  tone?: "forest";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{k}</span>
      <span
        className={
          tone === "forest"
            ? "text-forest-500 font-mono tabular-nums font-semibold"
            : "text-ink-900 font-mono tabular-nums"
        }
      >
        {v}
      </span>
    </div>
  );
}

function TrustBadge({
  Icon,
  title,
  body,
}: {
  Icon: (props: { className?: string }) => JSX.Element;
  title: string;
  body: string;
}) {
  return (
    <div>
      <Icon className="h-4 w-4 text-forest-500 mb-2" />
      <div className="text-xs font-semibold text-ink-900">{title}</div>
      <div className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">
        {body}
      </div>
    </div>
  );
}
