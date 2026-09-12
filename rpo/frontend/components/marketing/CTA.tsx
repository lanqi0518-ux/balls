import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight, ArrowUpRight } from "@/components/ui/Icons";
import { Sphere } from "@/components/ui/Sphere";

export function CTA() {
  return (
    <section className="relative py-28 lg:py-40 overflow-hidden bg-ink-900 text-white">
      {/* Warm mesh over dark base */}
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 40% 60% at 20% 30%, rgba(255,106,61,0.35), transparent 60%), radial-gradient(ellipse 50% 55% at 85% 70%, rgba(11,77,62,0.6), transparent 60%)",
        }}
      />
      <Sphere
        variant="peach"
        size={420}
        className="absolute -bottom-24 -left-16 opacity-60 pointer-events-none animate-float-slow"
      />
      <Sphere
        variant="forest"
        size={320}
        className="absolute -top-20 -right-10 opacity-70 pointer-events-none animate-float"
      />

      <Container className="relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/60 font-medium mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-peach-500" />
            The offer
          </div>
          <h2 className="font-display text-display-md text-white">
            Own the next IPO the moment{" "}
            <span className="italic text-peach-300">it lists</span>.
          </h2>
          <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto">
            No forms. No brokers. No jurisdictions to fight. Bring USDG,
            pick a vault, sign once.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <LinkButton
              href="/app"
              size="lg"
              className="!bg-white !text-ink-900 hover:!bg-paper-100"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Launch app
            </LinkButton>
            <LinkButton
              href="/docs"
              size="lg"
              className="!border-white/30 !text-white hover:!border-white hover:!bg-white/10"
              variant="outline"
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
