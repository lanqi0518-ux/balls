"use client";

import { useState } from "react";
import { Section, SectionHeader } from "@/components/ui/Section";
import { ChevronDown } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

const ITEMS = [
  {
    q: "Are Stock Tokens available in my country?",
    a: "Robinhood Stock Tokens are Reg-S securities. They are not offered to U.S. persons, Canadian residents, U.K., Swiss, or U.A.E. residents. RPO does not KYC users on-chain, but Robinhood Assets (Jersey) may apply venue-level restrictions when the underlying is redeemed.",
  },
  {
    q: "What if the IPO never launches on Robinhood?",
    a: "Every SubscriptionVault has a fulfillment deadline. If Robinhood hasn't minted the Stock Token by then, anyone can call activateRefund() and every subscriber withdraws their USDG back 1:1. You never lose principal to an un-launched IPO.",
  },
  {
    q: "Why is Rialto better than sniping Uniswap on launch?",
    a: "Rialto is a propAMM backed by Robinhood's market maker, so its quote is close to the primary-market fill Robinhood itself pays. Uniswap V3 depth on a freshly-minted Stock Token is thin and volatile; the first block is a mev war. Vaults check Rialto first and only fall through to Uniswap if the quote is meaningfully worse.",
  },
  {
    q: "What is the $RPO token for?",
    a: "$RPO is the allocation boost token. Stake it to multiply your weight in every SubscriptionVault, up to 3×. 80% of the 2% platform fee is spent buying $RPO on Pons and either burning it or streaming it to the AllocationBooster. There is no team unlock cliff; it launched fair through Pons paired against SPY.",
  },
  {
    q: "Is this custodial?",
    a: "No. Your USDG sits in a per-IPO SubscriptionVault deployed via CREATE2. You can withdraw before the subscription deadline. Post-fulfillment you claim real ERC-8056 Stock Tokens directly to your address.",
  },
  {
    q: "Has RPO been audited?",
    a: "No. RPO is pre-launch. Third-party audits are a hard prerequisite to any mainnet deployment; when they land the full reports will be published on /audits. The source is public on GitHub in the meantime.",
  },
  {
    q: "How do dividends and splits work?",
    a: "Stock Tokens implement ERC-8056: every corporate action updates a uiMultiplier on the token contract, and your balance-in-shares scales automatically. You never have to redeem, migrate, or claim anything.",
  },
];

export function FAQ() {
  return (
    <Section id="faq" className="border-t border-line">
      <SectionHeader
        eyebrow="FAQ"
        title="Questions people actually ask."
        align="center"
      />
      <div className="max-w-3xl mx-auto divide-y divide-line border-y border-line">
        {ITEMS.map((item, i) => (
          <FAQItem key={i} q={item.q} a={item.a} defaultOpen={i === 0} />
        ))}
      </div>
    </Section>
  );
}

function FAQItem({
  q,
  a,
  defaultOpen,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left py-6 flex items-center justify-between gap-6 group"
        aria-expanded={open}
      >
        <span className="font-display text-2xl text-ink-900 font-medium">
          {q}
        </span>
        <span
          className={cn(
            "h-8 w-8 rounded-full border border-line flex items-center justify-center flex-shrink-0 transition-all",
            open ? "bg-ink-900 border-ink-900" : "bg-white group-hover:border-ink-900"
          )}
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open ? "rotate-180 text-white" : "text-ink-900"
            )}
          />
        </span>
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100 pb-6" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <p className="text-ink-500 leading-relaxed max-w-2xl">{a}</p>
        </div>
      </div>
    </div>
  );
}
