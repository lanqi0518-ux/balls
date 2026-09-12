# The Digital Human Brain

**A live digital human brain — ten anatomical regions, nine deep-learning cortices plus one real LIF spiking ring-attractor, cooperating in real time. No LLM used, ever.**

**Live demo**: <https://brainonchain.online> (deployed on Fly.io, `sjc`, `performance-16x` + 10 GB volume, 24/7)

> The default configuration is **Einstein mode**: a wider prefrontal cortex (192-wide), longer hippocampus (400 slots), more active default-mode network, plus **60 semantic seeds** injected at boot — 30+ crypto concepts (BTC / ETH / SOL / DOGE / PEPE / WIF / HODL / rug pull / gas ...) and 20+ Einstein concepts (special & general relativity / E=mc² / speed of light / gravitational waves / tensors / field equations / thought experiments / "God does not play dice" ...). It will spontaneously associate to one of these while thinking; you can watch the currently-recalled concept light up in the UI.
>
> **New**: there is now a **Trader Cortex** that tracks Solana on-chain wallet behavior, behaviour-clones their buy/sell decisions, and executes **real on-chain trades** via Jupiter (Solana) and Uniswap V3 (Robinhood Chain L2, chainId 4663). Live-trading is guarded by hard per-trade / per-hour / per-day SOL and ETH limits and can be halted with a single env var. See the [Trader Cortex](#trader-cortex) section below.

---

## What it is

A digital brain lives inside a 9×9 virtual environment. It has to find food (reward +1) and avoid danger (penalty −1), using nothing but experience it accumulated itself.

Its "brain" is composed of ten modules, **each a functional stand-in for a real anatomical brain region**:

| Region | Implementation | Role |
|---|---|---|
| Visual cortex (V1–V4)  | Convolutional neural network (PyTorch)             | Turn environment frames into feature vectors |
| Thalamus               | Gated relay + gain control                          | Sensory filtering / top-down attention |
| Hippocampus            | Hopfield-style episodic memory                      | Store & recall past episodes |
| Prefrontal cortex      | Actor–critic policy head (REINFORCE + value)        | Deliberate decisions |
| Nucleus accumbens      | TD-error / dopamine channel                         | Reward prediction & drive |
| Amygdala               | Fear conditioning / Pavlovian associator            | Emotional weighting of stimuli |
| Motor cortex           | Categorical action head + world/trader intents      | Body & world commands |
| Default-mode network   | Off-task idling / replay                            | Consolidation while resting |
| Central complex        | **Real LIF spiking ring attractor** (no shortcuts)  | Heading/orientation (fly-brain-style) |
| Trader cortex          | Behaviour cloning + on-chain execution              | Live meme trading on SOL + RBH |

Everything runs on CPU. The whole thing is under 300 MB of dependencies.

---

## Why this is unusual

- **Not an LLM.** No transformer, no attention over tokens, no pre-trained language weights. Nothing here was trained on the internet.
- **Not one big model.** Ten separate modules, each with its own state, learning rule, and update cadence. They exchange vectors through explicit named channels the way real cortical areas exchange spikes through named tracts.
- **Always on.** The brain never resets. Weights, memories, tokens, and positions persist across deploys via a mounted Fly volume.
- **Live embodiment.** The trader cortex has real SOL and real ETH; a Solana keypair signs Jupiter swaps; an EVM keypair signs Uniswap V3 swaps on Robinhood Chain. The brain buys memes on its own.
- **Transparent.** The site is a live craniotomy: every region is on screen, every activation is a real number streamed from the backend, every decision is followed by a rendered thought.

---

## Trader Cortex

The trader cortex is a small, well-scoped extension:

1. **Discovery** — pulls fresh tokens/pools from DexScreener, hood.fun, pump.fun, and other launchpads.
2. **Wallet mirroring** — subscribes to a curated set of profitable Solana wallets, extracts their trade features (velocity, size, hold time).
3. **Behaviour cloning** — a small MLP learns `wallet-features → buy/skip` on their labeled outcomes.
4. **Actor-critic overlay** — the prefrontal cortex adds a value baseline on top of the BC prior and can override it.
5. **Execution** — hits Jupiter v6 (Solana) or Uniswap V3 SwapRouter02 (Robinhood Chain) with strict guard rails.

### Hard limits (enforced in code, not just UI)

| | Solana | Robinhood Chain |
|---|---|---|
| Max per trade         | 0.005 SOL   | 0.0005 ETH  |
| Max per hour          | 0.02  SOL   | 0.002  ETH  |
| Max per day           | 0.06  SOL   | 0.006  ETH  |
| Max concurrent positions | 2         | 2           |
| Min pool liquidity    | $40k        | $40k        |
| Max slippage          | 5%          | 5%          |
| Min model confidence  | 0.75        | 0.75        |

### Kill switches (env vars)

- `LIVE_TRADING_HALT=1` — halt all Solana live trading.
- `LIVE_TRADING_DRY_RUN=1` — sign nothing, log everything.
- `LIVE_HOOD_ENABLED=0` — disable Robinhood Chain executor entirely.

---

## Deploying it yourself

The repo ships with a `Dockerfile` and `fly.toml` (region `sjc`, CPU-only PyTorch image ~255 MB, bound to `brainonchain.online`).

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Launch (uses fly.toml)
fly launch --copy-config --no-deploy

# 3. Add secrets
fly secrets set BRAIN_SOL_PRIVKEY=<solana_secret_key_hex_or_base58>
fly secrets set BRAIN_HOOD_PRIVKEY=<evm_secret_key_hex>    # optional; overrides derivation
fly secrets set CANONICAL_HOST=brainonchain.online

# 4. Deploy
fly deploy --remote-only
```

The volume mount at `/data` persists brain state (weights, hippocampus slots, wallet ledgers, positions) across restarts.

---

## Tech stack

- **Backend**: Python 3.12, FastAPI, uvicorn, WebSockets, PyTorch (CPU wheels), Playwright (headless Chromium for web-embodiment)
- **Frontend**: vanilla ES modules, THREE.js for the 3D brain, Canvas 2D for waveforms and environment
- **Execution**: `solders` + `solana-py` (Jupiter v6 / lite-api.jup.ag), `eth-account` + raw JSON-RPC (Uniswap V3 SwapRouter02)
- **Infra**: Fly.io Machines, mounted volume, always-on (`auto_stop_machines = off`)

---

## License

MIT. Do whatever you want. The interesting part of this project is not the code — it's the fact that it works.
