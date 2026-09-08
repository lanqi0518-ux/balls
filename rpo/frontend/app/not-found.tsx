import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/Icons";

export default function NotFound() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden py-32 lg:py-40">
        <div className="absolute inset-0 bg-mesh-warm pointer-events-none" />
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="container-tight relative text-center">
          <div className="eyebrow mb-6 justify-center">Error 404</div>
          <h1 className="font-display text-display-lg text-fg">
            This vault doesn&apos;t exist.
          </h1>
          <p className="mt-6 text-lg text-fg-muted max-w-xl mx-auto">
            The page you&apos;re looking for either hasn&apos;t been listed
            yet or its CREATE2 salt is on another chain.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <LinkButton
              href="/"
              size="md"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Back home
            </LinkButton>
            <Link href="/app" className="btn-outline text-sm">
              Or open the app
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
