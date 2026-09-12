# Acknowledgments

*To every scientist whose work made 0xBRAIN possible — what we built is nothing more than the careful assembly of decades of your discoveries.*

---

## 1. Opening

**0xBRAIN is not a "from-scratch" project. It is an assembly job — carrying, one at a time, the most beautiful insights that neuroscientists, cognitive scientists, machine-learning researchers, and philosophers have produced over the past 100 years, into working code, and letting the whole thing run.**

This is not modesty. This is fact. Anyone with a neuroscience background who opens [brainonchain.online](https://brainonchain.online) can see through it in one glance — every core line of every cortex module traces back to a specific, often Nobel-caliber, paper.

So before saying anything about "what we did," let us first say **whose work made it possible**.

---

## 2. Thanks, by module

### Visual cortex V1–V4

Thank you **David Hubel** and **Torsten Wiesel** (1962) — the orientation-selective receptive fields you discovered in the cat's primary visual cortex sixty years ago told us that **the brain decomposes the world hierarchically**, not by stuffing whole images into a monolithic layer. Thank you **Semir Zeki** (1978) for making "object-level visual encoding" a concrete concept in V4. Thank you **David Marr** (1982), whose *Vision* is the founding stone of computational vision. Deep learning exists today because you wrote the answers on paper forty years earlier.

### Thalamus

Thank you **S. Murray Sherman** and **R. W. Guillery** for insisting, again and again, that the thalamus is a **cortical gating hub**, not a "simple relay." That single sentence turned our `thalamus.py` from a data pipe into a genuine attention gate.

### Hippocampus · episodic memory · Complementary Learning Systems

Thank you **Timothy Bliss** and **Terje Lømo** (1973) for discovering LTP — turning "synaptic plasticity" from a hypothesis into a molecular mechanism.

Thank you **John O'Keefe** and **Lynn Nadel** (1978); *The Hippocampus as a Cognitive Map* redefined the hippocampus from a "memory box" into a "living map of the world," and our hippocampal module was written straight out of that book.

Thank you **Edward Tolman** (1948) for insisting on the phrase "cognitive map" in an era ruled by behaviorism.

Thank you **Matt Wilson** and **Bruce McNaughton** (1994) for the first recording of the hippocampus **replaying** its memories during sleep.

The deepest thanks in this section go to **James McClelland**, **Bruce McNaughton**, and **Randall O'Reilly** (1995) — your **Complementary Learning Systems** theory is the sole reason 0xBRAIN can **run forever without forgetting itself**. **Without CLS, our brain would have wiped out its own identity three days ago.**

Thank you **Dharshan Kumaran**, **Demis Hassabis**, and McClelland (2016) for restating CLS crisply in the deep-learning era.

Thank you **Susanne Diekelmann** and **Jan Born** (2010) for turning "sleep = memory consolidation" into a measurable neurobiological fact.

Thank you **James Kirkpatrick et al.** (2017) for EWC, which forced "catastrophic forgetting" onto the mainstream AI agenda for the first time.

### Amygdala

Thank you **Joseph LeDoux** (1996) — *The Emotional Brain* taught us that **emotion is not the opposite of reason; emotion is the gatekeeper of reason**. Thank you **Elizabeth Phelps** and LeDoux (2005) for the gold-standard review of emotional modulation of memory. The "once bitten, twice shy" logic in our `amygdala.py` is translated straight from your figures.

### Nucleus accumbens / VTA · dopamine · reinforcement learning

Thank you **Wolfram Schultz**, **Peter Dayan**, and **Read Montague** (1997) — your *A Neural Substrate of Prediction and Reward* is the most beautiful cross-disciplinary bridge of 20th-century neuroscience. **You proved that the signal fired by midbrain dopamine neurons literally equals the TD-error of reinforcement-learning theory**. That discovery is the beating heart of 0xBRAIN's learning loop.

Every time a chain trade settles and we compute

```
δ = r + γ · V(s') − V(s)
```

we are knocking on the door you opened twenty-seven years ago.

Thank you **Richard Sutton** and **Andrew Barto** (2018) — you made *Reinforcement Learning: An Introduction* **freely available**, so anyone in the world who wants to learn RL can. That act by itself is great.

### Prefrontal cortex

Thank you **Earl Miller** and **Jonathan Cohen** (2001) — *An integrative theory of prefrontal cortex function* is the Bible for our `prefrontal_cortex.py`. Thank you **Kenji Doya** (2000) for the cerebellum–basal-ganglia–cortex three-way learning division that tells us exactly where Actor and Critic belong.

### Motor cortex

Thank you **Apostolos Georgopoulos** (1986) — your **population-vector decoding** proved that "no single neuron encodes direction; direction is the vector sum of the population." Our `motor_cortex.py` compresses the Trader Cortex intent distribution into a single trade intent exactly this way.

### Default Mode Network

Thank you **Marcus Raichle** (2001) for the counter-intuitively delightful finding that **the brain is more active when "doing nothing."** Thank you **Randy Buckner**, **Jessica Andrews-Hanna**, and **Daniel Schacter** (2008) for tying the DMN to self-simulation. Our `default_mode.py`, which "dreams / replays / speculates" when the market is quiet, is a direct implementation of your theory.

### Ring attractor · central complex

Thank you **Rani Ben-Yishai**, **Ruth Bar-Or**, and **Haim Sompolinsky** (1995), and **Kechen Zhang** (1996), for the independent theoretical proofs that a ring-connected excitatory–inhibitory population forms a stable, movable bump.

Thank you **Johannes Seelig** and **Vivek Jayaraman** (2015) for **directly observing** that attractor in a living animal brain for the first time.

Thank you **Sung Soo Kim**, **Hervé Rouault**, **Shaul Druckmann**, and Jayaraman (2017) for characterizing its dynamics.

The rotating compass inside `central_complex.py` is essentially the same object as the fly ellipsoid body you saw.

### Imitation → reinforcement

Thank you **Jonathan Ho** and **Stefano Ermon** (2016) for GAIL, and **Stephane Ross**, **Geoffrey Gordon**, and **Drew Bagnell** (2011) for DAgger — you made the ancient learning paradigm of "watch first, then do" computationally viable. The Trader Cortex bootstrap walks that path.

### Spiking neural networks

Thank you **Emre Neftci**, **Hesham Mostafa**, and **Friedemann Zenke** (2019) — your surrogate-gradient work turned "backprop-training spiking neurons" from impossible into routine. Every LIF neuron inside 0xBRAIN thanks you.

### Embodied cognition · autopoiesis · integrated information

Thank you **Francisco Varela**, **Evan Thompson**, and **Eleanor Rosch** (1991); *The Embodied Mind* moved "cognition needs a body" from fringe philosophy into serious position.

Thank you **Humberto Maturana** and Varela (1980) for autopoiesis — you taught us that "being alive" is defined **not by parts, but by process**.

Thank you **Giulio Tononi** for IIT — the reminder that "a static wiring diagram has Φ = 0" says in one line why *connectome* is not *cognition*.

Thank you **J. A. Scott Kelso** (1995) for *Dynamic Patterns*, giving us the confidence to say "brains are dynamical systems, not circuit diagrams."

### Connectomics

Thank you **John White** and **Sydney Brenner** (1986) — the 302-neuron *C. elegans* wiring diagram you drew by hand forty years ago is the origin of this entire story.

Thank you **Sebastian Seung**, **Mala Murthy**, **Sven Dorkenwald**, and the whole **FlyWire Consortium** (2024) for the first complete adult animal brain (female fly).

Thank you **HHMI Janelia FlyEM**, **Google Research Connectomics**, University of Cambridge Zoology, and MRC LMB (2026) for the complete male fly CNS — 166,700 neurons, 125 million synapses. **This is scripture-tier work in the history of neuroscience.** Migrating specific subcircuits (for example, the full ring-attractor topology) from your data into our runtime is the most exciting item on 0xBRAIN's roadmap.

### OpenWorm

Thank you **Stephen Larson**, **Gopal Sarma**, and the entire OpenWorm community — for over a decade you have not yet made a virtual worm swim, but you have shown the world one thing very clearly: **a connectome alone is not enough**. Your "failure" is one of the reasons 0xBRAIN exists.

---

## 3. Closing

**We invented no new neuroscience.**

- Visual hierarchy — Hubel & Wiesel taught us.
- The two-memory-system solution — McClelland taught us.
- Dopamine = TD-error — Schultz, Dayan, Montague taught us.
- Ring attractor — Ben-Yishai / Zhang / Seelig / Jayaraman taught us.
- Brains need bodies — Varela taught us.
- Reinforcement learning — Sutton & Barto taught us.
- How to train spiking neurons — Neftci, Mostafa, Zenke taught us.

**All we did was wire your answers together, plug in the power, let it run, and turn a camera on so the world can watch.**

If 0xBRAIN ever turns out to be a meaningful step toward digital life, **the credit belongs to you**. We only performed the score you had already composed.

And all of this is possible only because every one of you chose to **publish openly**, **give away PDFs**, **open-source data**, and **place DOIs behind open access**. This is **open science** at its best. It lets an independent developer on a $2/month Fly.io VM stand on your shoulders and build something that is truly alive.

**This is why science is great.**

With our sincerest thanks.

— The 0xBRAIN team · September 2026 · [brainonchain.online](https://brainonchain.online)

---

## In memoriam

- **Francisco J. Varela** (1946–2001) — embodied mind, autopoiesis. This project is a small child of your program. If you could see 0xBRAIN running with real money in a real closed loop on-chain, we think you would recognize it as a direct implementation of the enactivist program.
- **Sydney Brenner** (1927–2019) — the *C. elegans* connectome you started in 1963 became, forty years later, the origin story of an entire field.

---

## References

The full annotated bibliography — with verified DOI / PMC / arXiv / publisher links for every paper cited above — lives at [`why-0xbrain-matters.en.md`](./why-0xbrain-matters.en.md) and [`why-a-living-brain-beats-a-dead-map.en.md`](./why-a-living-brain-beats-a-dead-map.en.md).
