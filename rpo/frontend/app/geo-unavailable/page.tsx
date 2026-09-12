import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Sphere } from "@/components/ui/Sphere";

export const metadata = {
  title: "Region unavailable",
  description:
    "Robinhood Assets (Jersey) Reg-S Stock Tokens are not offered in your region. RPO is a permissionless protocol; on-chain access is still possible for eligible users.",
  robots: { index: false, follow: false },
};

const BLOCKED_LABELS: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  CH: "Switzerland",
  AE: "United Arab Emirates",
};

export default function GeoUnavailablePage({
  searchParams,
}: {
  searchParams: { cc?: string; from?: string };
}) {
  const cc = (searchParams.cc || "").toUpperCase();
  const region = BLOCKED_LABELS[cc] || "your region";

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-ink-900 flex flex-col">
      {/* Decorative background — kept tasteful, not celebratory */}
      <div className="absolute inset-0 bg-mesh-warm opacity-60 pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <Sphere
        variant="peach"
        size={520}
        className="absolute -top-40 -right-24 opacity-70"
      />

      {/* Top */}
      <header className="relative z-10 container-wide flex items-center justify-between h-16">
        <Logo />
        <a
          href="https://github.com/lanqi0518-ux/balls"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-ink-500 hover:text-ink-900"
        >
          GitHub
        </a>
      </header>

      {/* Body */}
      <section className="relative z-10 flex-1 container-wide flex items-center py-16 lg:py-28">
        <div className="max-w-3xl">
          <div className="eyebrow mb-6">Region notice</div>

          <h1 className="font-display text-5xl lg:text-7xl leading-[0.98] tracking-tight text-ink-900">
            RPO is not available in{" "}
            <span className="italic text-peach-500">{region}</span>.
          </h1>

          <p className="mt-8 text-lg text-ink-500 max-w-2xl leading-relaxed">
            Robinhood Assets (Jersey) Reg-S Stock Tokens — the underlying
            securities RPO subscribes to — are offered under Regulation S of
            the U.S. Securities Act. That framework explicitly excludes
            offerings to U.S. persons, Canadians, U.K., Swiss, and U.A.E.
            residents. Serving the RPO web interface to visitors from these
            jurisdictions would violate the offering&apos;s distribution
            compliance.
          </p>

          <p className="mt-6 text-sm text-ink-500 max-w-2xl leading-relaxed">
            <strong className="text-ink-900">Important:</strong> RPO itself is
            a permissionless open-source smart-contract protocol. On-chain
            interaction is always possible for any wallet globally. This site
            (the marketing + web-app layer) simply cannot be shown to you in
            compliance with the underlying Reg-S offering.
          </p>

          <div className="mt-12 grid sm:grid-cols-2 gap-3 max-w-2xl">
            <a
              href="https://github.com/lanqi0518-ux/balls"
              target="_blank"
              rel="noreferrer"
              className="card p-5 hover:border-line-strong transition-colors"
            >
              <div className="font-semibold text-ink-900 mb-1">
                Read the source →
              </div>
              <div className="text-sm text-ink-500">
                All contracts + SDK on GitHub. Interact directly with the
                on-chain protocol if you&apos;re eligible.
              </div>
            </a>
            <a
              href="https://github.com/lanqi0518-ux/balls/discussions"
              target="_blank"
              rel="noreferrer"
              className="card p-5 hover:border-line-strong transition-colors"
            >
              <div className="font-semibold text-ink-900 mb-1">
                Ask a question →
              </div>
              <div className="text-sm text-ink-500">
                Questions about eligibility or the offering can be raised
                on GitHub Discussions.
              </div>
            </a>
          </div>

          <div className="mt-16 text-xs text-ink-500 font-mono">
            Detected country code: {cc || "unknown"} · Not investment advice.
          </div>
        </div>
      </section>

      <footer className="relative z-10 container-wide py-6 text-xs text-ink-500 border-t border-line">
        © {new Date().getFullYear()} RPO Labs · Robinhood Stock Tokens are
        Reg-S securities issued by Robinhood Assets (Jersey) Limited.
      </footer>
    </main>
  );
}
