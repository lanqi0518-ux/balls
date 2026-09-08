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
    <section className="py-20 border-y border-line bg-white">
      <Container>
        <div className="text-center text-[11px] uppercase tracking-[0.28em] text-ink-500 mb-12">
          Built on the Robinhood Chain stack
        </div>
        <Marquee speed={50}>
          {NAMES.map((n) => (
            <span
              key={n}
              className="text-ink-400 hover:text-ink-900 transition-colors text-2xl lg:text-3xl font-display whitespace-nowrap"
            >
              {n}
            </span>
          ))}
        </Marquee>
      </Container>
    </section>
  );
}
