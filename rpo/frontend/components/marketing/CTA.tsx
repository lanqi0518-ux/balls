import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight, ArrowUpRight } from "@/components/ui/Icons";

export function CTA() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <Container>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-display-md text-fg">
            Own the next IPO the moment{" "}
            <span className="italic text-mint-500">it lists</span>.
          </h2>
          <p className="mt-6 text-lg text-fg-muted max-w-2xl mx-auto">
            No forms. No brokers. No jurisdictions to fight. Bring USDG,
            pick a vault, sign once.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <LinkButton
              href="/app"
              size="lg"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Launch app
            </LinkButton>
            <LinkButton
              href="/docs"
              variant="outline"
              size="lg"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            >
              Read the docs
            </LinkButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
