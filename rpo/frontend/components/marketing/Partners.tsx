import { Container } from "@/components/ui/Container";
import { Marquee } from "@/components/ui/Marquee";

const NAMES = [
  "Robinhood Chain",
  "Rialto",
  "Chainlink",
  "Morpho Blue",
  "Uniswap V4",
  "Pons",
  "LiFi",
  "Privy",
  "OpenZeppelin",
];

export function Partners() {
  return (
    <section className="py-16 border-y border-line bg-ink-900">
      <Container>
        <div className="text-center text-xs uppercase tracking-[0.2em] text-fg-dim mb-10">
          Built on the Robinhood Chain stack
        </div>
        <Marquee speed={45}>
          {NAMES.map((n) => (
            <span
              key={n}
              className="text-fg-muted hover:text-fg transition-colors text-xl lg:text-2xl font-display whitespace-nowrap"
            >
              {n}
            </span>
          ))}
        </Marquee>
      </Container>
    </section>
  );
}
