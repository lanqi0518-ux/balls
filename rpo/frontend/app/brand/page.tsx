import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";

export const metadata = {
  title: "Brand kit",
  description:
    "Logos, colors, typography, and usage guidelines for the RPO brand.",
};

const PALETTE = [
  { name: "Ink", hex: "#0A0A0A", role: "Primary text, buttons, wordmark" },
  { name: "Paper", hex: "#FFFFFF", role: "Primary background" },
  { name: "Ivory", hex: "#FAF9F5", role: "Secondary surfaces" },
  { name: "Forest 500", hex: "#0B4D3E", role: "Institutional accent" },
  { name: "Forest 300", hex: "#6EAF83", role: "Progress, success" },
  { name: "Peach 500", hex: "#FF6A3D", role: "Warm accent, 3D orbs" },
  { name: "Peach 200", hex: "#FFC6A9", role: "Highlights" },
  { name: "Cream", hex: "#FBF6E9", role: "Editorial cards" },
];

export default function BrandPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Brand"
        title="Assets, colors, and don'ts."
        description="Everything you need to write about, embed, or link to RPO. Use freely for editorial and educational purposes; commercial use requires written permission."
      />

      <section className="section">
        <div className="container-wide grid lg:grid-cols-3 gap-6">
          <div className="card p-10 flex flex-col items-center justify-center gap-8 aspect-square">
            <LogoMark size={140} />
            <div className="text-center">
              <div className="text-sm font-semibold text-ink-900">
                Aperture mark
              </div>
              <div className="text-xs text-ink-500 mt-1">
                Primary. Use on white or ivory.
              </div>
            </div>
          </div>

          <div className="card-dark p-10 flex flex-col items-center justify-center gap-8 aspect-square">
            <LogoMark size={140} variant="inverse" />
            <div className="text-center">
              <div className="text-sm font-semibold text-white">
                Inverse mark
              </div>
              <div className="text-xs text-white/70 mt-1">
                For dark backgrounds only. No colored dot.
              </div>
            </div>
          </div>

          <div className="card p-10 flex flex-col items-center justify-center gap-8 aspect-square">
            <Wordmark className="text-8xl" />
            <div className="text-center">
              <div className="text-sm font-semibold text-ink-900">
                Wordmark
              </div>
              <div className="text-xs text-ink-500 mt-1">
                Fraunces Italic. Use for editorial hero moments.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="eyebrow mb-3">Downloads</div>
              <h2 className="font-display text-3xl text-ink-900">
                Ready-to-use asset pack.
              </h2>
            </div>
            <a
              href="/brand/rpo-brand-kit.zip"
              className="btn-primary text-sm"
            >
              Download brand kit (12 MB)
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                label: "Logo — SVG",
                items: ["aperture-color.svg", "aperture-mono.svg", "aperture-inverse.svg"],
              },
              {
                label: "Wordmark — SVG",
                items: ["wordmark-black.svg", "wordmark-white.svg", "combined-lockup.svg"],
              },
              {
                label: "PNG @ 1024",
                items: ["logo-1024-color.png", "logo-1024-mono.png", "og-image-1200x630.png"],
              },
            ].map((g) => (
              <div key={g.label} className="card p-6">
                <div className="text-xs uppercase tracking-[0.14em] text-ink-500 font-mono mb-3">
                  {g.label}
                </div>
                <ul className="space-y-2 text-sm">
                  {g.items.map((f) => (
                    <li
                      key={f}
                      className="flex items-center justify-between text-ink-500"
                    >
                      <span className="font-mono">{f}</span>
                      <span className="text-forest-500 hover:underline cursor-pointer">
                        ↓
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <div className="eyebrow mb-4">Palette</div>
          <h2 className="font-display text-3xl text-ink-900 mb-8">
            Ink, paper, forest, peach.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PALETTE.map((c) => (
              <div key={c.name} className="card overflow-hidden">
                <div
                  className="aspect-video border-b border-line"
                  style={{ background: c.hex }}
                />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-ink-900 text-sm">
                      {c.name}
                    </div>
                    <div className="font-mono text-xs text-ink-500">
                      {c.hex}
                    </div>
                  </div>
                  <div className="text-xs text-ink-500 mt-1 leading-relaxed">
                    {c.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide grid md:grid-cols-3 gap-4">
          <div className="card p-6">
            <Badge variant="dark">Typography</Badge>
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-ink-500">Display</div>
                <div className="font-display text-3xl text-ink-900 italic mt-1">
                  Fraunces
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-500">Body</div>
                <div className="text-2xl text-ink-900 mt-1" style={{ fontFamily: "var(--font-sans)" }}>
                  Inter
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-500">Mono</div>
                <div className="font-mono text-xl text-ink-900 mt-1">
                  JetBrains Mono
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <Badge variant="forest">Do</Badge>
            <ul className="mt-4 space-y-2 text-sm text-ink-500">
              <li>· Use the color mark on white/ivory only.</li>
              <li>· Keep clear space = 1× the mark height.</li>
              <li>· Pair with Fraunces italic for hero text.</li>
              <li>· Use forest-500 as the primary accent.</li>
            </ul>
          </div>

          <div className="card p-6">
            <Badge variant="peach">Don&apos;t</Badge>
            <ul className="mt-4 space-y-2 text-sm text-ink-500">
              <li>· Rotate, stretch, or recolor the mark.</li>
              <li>· Add drop shadows or outlines.</li>
              <li>· Combine with other logos in a lockup.</li>
              <li>· Use on busy photographic backgrounds.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="container-wide max-w-3xl">
          <Prose>
            <H2 id="voice">Voice &amp; tone</H2>
            <p>
              RPO writes like a professional trade publication that
              happens to know its way around Solidity. We favour short,
              declarative sentences and specific numbers over adjectives.
              We do not use hype words (&quot;revolutionary&quot;,
              &quot;disruptive&quot;) or emoji in product copy.
            </p>
            <p>
              We say <em>subscribe</em>, not <em>ape into</em>. We say{" "}
              <em>protocol</em>, not <em>DeFi platform</em>. We say{" "}
              <em>Stock Tokens</em>, not <em>tokenized stonks</em>. When
              in doubt, imagine Bloomberg&apos;s copydesk.
            </p>

            <H2 id="press">Press use</H2>
            <p>
              Editorial and educational use of the marks and copy is
              welcomed without prior permission. Please:
            </p>
            <ul>
              <li>
                Link back to <code>rpo.xyz</code> or the relevant page.
              </li>
              <li>
                Use the primary aperture mark; do not create your own
                mark variations.
              </li>
              <li>
                Refer to the project as &quot;RPO&quot; (all-caps, no
                periods) or &quot;RPO Protocol&quot;.
              </li>
            </ul>
            <p>
              For press inquiries email{" "}
              <a href="mailto:press@rpo.xyz">press@rpo.xyz</a>.
            </p>
          </Prose>
        </div>
      </section>
    </MarketingShell>
  );
}
