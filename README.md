# 0xBRAIN — Digital Human Brain

**A live, always-learning digital cortex running on a public blockchain.**
Zero LLM. Zero pretrained weights. Zero external inference API.
**20 hand-written brain regions** (19 PyTorch modules + 1 real LIF spiking central complex) learning online from a REINFORCE gradient.

**Live**: <https://balls-lanqi.fly.dev>

---

## Prove it yourself — no AI, no wrapper

Run this in any terminal:

```bash
git clone https://github.com/lanqi0518-ux/brain
cd brain
grep -riE "openai|anthropic|claude|gpt|llama|mistral|cohere|huggingface|transformers|langchain" .
```

**→ zero matches.** Not a single call to an LLM. Not a single pretrained weight.

---

## The 20 brain regions

Every region is a small PyTorch module (or a hand-written spiking net), grounded in real neuroscience, learning online. Click through and read the code — most files are under 100 lines.

📁 [**All 20 regions in one folder**](https://github.com/lanqi0518-ux/brain/tree/main/digital-brain/backend/brain/regions)

| # | Region | What it does |
|---|---|---|
| 1 | [Visual cortex](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/visual_cortex.py) | 52-line CNN, pixels → 32-D features. No ImageNet. |
| 2 | [Thalamus](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/thalamus.py) | Attention gating scaled by fear + engagement |
| 3 | [Hippocampus](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/hippocampus.py) | Episodic memory + knowledge recall |
| 4 | [Amygdala](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/amygdala.py) | Pavlovian conditioning via cosine similarity |
| 5 | [Nucleus accumbens](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/nucleus_accumbens.py) | Reward prediction error |
| 6 | [Prefrontal cortex](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/prefrontal_cortex.py) | 92-line MLP actor-critic |
| 7 | [Motor cortex](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/motor_cortex.py) | Categorical policy sampling |
| 8 | [Default mode](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/default_mode.py) | Idle replay of hippocampal memories |
| 9 | [Trader cortex](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/trader_cortex.py) | Separate policy head for token decisions |
| 10 | [Central complex](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/central_complex.py) | Real spiking LIF ring-attractor (fly-inspired) |
| 11 🆕 | [Cerebellum](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/cerebellum.py) | Forward-model calibration (Wolpert-Miall-Kawato 1998) |
| 12 🆕 | [Basal ganglia](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/basal_ganglia.py) | Go/NoGo action gating (Frank 2005) |
| 13 🆕 | [Insular cortex](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/insular_cortex.py) | Interoception, risk-as-feeling (Craig 2009; Damasio) |
| 14 | [Locus coeruleus](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/locus_coeruleus.py) | Noradrenergic gain (Aston-Jones & Cohen 2005) |
| 15 🆕 | [Anterior cingulate](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/anterior_cingulate.py) | Conflict monitoring · entropy × RPE (Botvinick 2001; Carter 1998) |
| 16 🆕 | [Ventral tegmental area](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/ventral_tegmental.py) | Dopamine burst source, plasticity gain (Schultz 1997) |
| 17 🆕 | [Hypothalamus](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/hypothalamus.py) | Homeostatic drives · energy · arousal (Sternson 2013) |
| 18 🆕 | [Entorhinal cortex](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/entorhinal_cortex.py) | 6-module hexagonal grid-cell code (Moser 2008, Nobel 2014) |
| 19 🆕 | [Posterior parietal](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/posterior_parietal.py) | Evidence accumulator · drift-diffusion (Shadlen 2001) |
| 20 🆕 | [Raphe nuclei](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/regions/raphe_nuclei.py) | Serotonin · patience · delay discounting (Doya 2002) |

---

## The whole brain in one file

- [`backend/brain/brain.py`](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/backend/brain/brain.py) — the perception → memory → emotion → decision → action loop. Every line is torch tensors and stdlib. No API calls.

## Dependencies

- [`requirements.txt`](https://github.com/lanqi0518-ux/brain/blob/main/digital-brain/requirements.txt) — `fastapi`, `torch`, `numpy`, `playwright`, `solders`, `httpx`, `eth-account`. Nothing else. Nothing that talks to an LLM.

## Persistence — the brain never resets

- Every weight, every hippocampal episode, every reward baseline persists across restarts. Same lifetime counter, same wallet, same identity — forever.

---

## Live now

Watch the cortex think in real time: **<https://balls-lanqi.fly.dev>**

Every fee flows back into training the brain and buying back the token.

Not a wrapper. Not a prompt. A real brain — on-chain.
