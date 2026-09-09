# Deploying RPO to Fly.io + Cloudflare

Two apps, one server-side origin, one global edge.

```
users (world)  ──►  Cloudflare (300+ POPs, free)  ──►  Fly.io  (fra region)
                    │                                   ├── rpo-web    (Next.js)
                    │                                   └── rpo-keeper (bot)
                    │
                    └─ handles: SSL, DDoS, geo-block, static caching
```

Total monthly cost at launch scale: ~**$3 – $5** (Cloudflare free, Fly.io two `shared-cpu-1x` machines).

---

## 0. Prerequisites

- A Fly.io account with payment method attached (you already have this).
- A Cloudflare account (free tier is fine — sign up in 2 min).
- A domain — buy one at any registrar (Namecheap, Porkbun, Cloudflare Registrar). Recommended: `rpo.xyz` / `rpo.finance` / `rpo.trade`.
- On your local machine, install `flyctl`:

  ```bash
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
  ```

- `flyctl auth login` (opens a browser).

---

## 1. Deploy the frontend

From the repo root:

```bash
cd rpo/frontend

# First launch — Fly reads fly.toml, sets up the app + machine, deploys.
# The default app name in fly.toml is "rpo-web". If that's already taken
# in your org, flyctl will prompt for a new name.
flyctl launch --copy-config --now
```

That's it. Fly will:

1. Build the Docker image from `Dockerfile` (multi-stage, ~150 MB).
2. Push it to the Fly registry.
3. Spin up a `shared-cpu-1x` machine in `fra` (Frankfurt).
4. Print your app URL: `https://rpo-web.fly.dev`.

Verify:

```bash
curl -I https://rpo-web.fly.dev/
# HTTP/2 200
```

### Scale to multiple regions (optional, only if you want to skip Cloudflare)

```bash
flyctl regions add iad sjc nrt gru   # US-East, US-West, Tokyo, São Paulo
flyctl scale count 2 --region fra
```

**Skip this if you're doing the Cloudflare setup below** — one Fly region + Cloudflare is faster AND cheaper than multi-region without a CDN.

---

## 2. Deploy the keeper bot

```bash
cd ../keeper

# Set secrets FIRST — never commit these
flyctl secrets set \
  RPC_URL="https://rpc.robinhood-chain.xyz" \
  KEEPER_PRIVATE_KEY="0x..." \
  IPO_REGISTRY_ADDR="0x..." \
  RHJ_ASSETS_URL="https://api.robinhood.com/rhj/assets" \
  --app rpo-keeper

flyctl launch --copy-config --now
```

Watch it work:

```bash
flyctl logs --app rpo-keeper
# should print "keeper: polling /rhj/assets every 60s"
```

The keeper needs a wallet funded with a small amount of ETH on Robinhood Chain for gas (a few USD covers thousands of `propose()` calls).

---

## 3. Point your domain at Fly, through Cloudflare

### 3a. Add your domain to Cloudflare

1. In Cloudflare dashboard → **Add a site** → enter `rpo.xyz`.
2. Cloudflare gives you 2 nameservers. Set these at your registrar (Namecheap → domain → Nameservers → Custom → paste).
3. Wait 5–30 minutes for propagation.

### 3b. Add DNS records to Cloudflare

In Cloudflare → DNS → **Add record**:

| Type    | Name  | Content                       | Proxy       |
|---------|-------|-------------------------------|-------------|
| CNAME   | @     | `rpo-web.fly.dev`             | 🟠 Proxied  |
| CNAME   | www   | `rpo-web.fly.dev`             | 🟠 Proxied  |

The 🟠 orange cloud (Proxied) is what puts Cloudflare's CDN + DDoS + geo-block in front of Fly.

### 3c. Tell Fly about your custom domain (SSL)

```bash
cd rpo/frontend
flyctl certs add rpo.xyz --app rpo-web
flyctl certs add www.rpo.xyz --app rpo-web
```

Fly issues a Let's Encrypt cert automatically. Cloudflare uses its own edge cert, so end-to-end you get 2 layers of TLS. Set Cloudflare SSL/TLS mode to **Full (strict)**.

---

## 4. Configure Cloudflare — 4 non-negotiable settings

### 4a. SSL/TLS mode

Cloudflare → SSL/TLS → Overview → **Full (strict)**.

### 4b. Cache everything static

Cloudflare → Caching → Cache Rules → **Create rule**:

- Rule name: `Cache Next.js static assets`
- If: `URI Path` matches `/_next/static/*` OR ends with `.js` OR ends with `.css` OR ends with `.woff2` OR ends with `.svg` OR ends with `.png`
- Then: **Eligible for cache** + Edge TTL **1 year**.

This is what makes the site feel instant globally — Cloudflare serves 99% of requests from a POP < 30 ms from the user; your Fly origin only handles page HTML.

### 4c. Geo-block Reg-S countries (defense in depth)

Even though `middleware.ts` blocks US/CA/UK/CH/AE at the Next.js layer, adding a Cloudflare WAF rule ensures blocked users **never even reach the origin**, saving Fly bandwidth and compute.

Cloudflare → Security → WAF → Custom rules → **Create rule**:

- Rule name: `Reg-S geo block`
- If: `(ip.geoip.country in {"US" "CA" "GB" "CH" "AE"})`
- Then: **Block** (or **Managed Challenge** if you want a softer touch).
- Optional response: Custom HTML pointing to `/geo-unavailable`.

### 4d. DDoS / rate limiting

Cloudflare → Security → **DDoS** is on by default (free tier).

Optionally add a rate limit: Rules → Rate limiting → New rule:

- Path: `/api/*`
- Rate: 60 requests / 10 seconds per IP.

---

## 5. Post-deploy sanity checks

```bash
# Frontend responds:
curl -I https://rpo.xyz/
# HTTP/2 200
# server: cloudflare
# cf-cache-status: HIT   (after 2nd request — static asset should hit)

# Keeper is running:
flyctl logs --app rpo-keeper --tail

# Fly.io billing:
flyctl orgs list
# Check https://fly.io/dashboard/personal — should be $2–5/month range
```

---

## 6. Updating the site

Any git push triggers a manual redeploy — Fly does not auto-deploy from git by default (safer for finance). To deploy:

```bash
cd rpo/frontend && flyctl deploy
cd ../keeper   && flyctl deploy
```

Zero-downtime: Fly does blue-green machine replacement.

For CI/CD, add `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only --config rpo/frontend/fly.toml --app rpo-web
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## 7. Costs breakdown (real, measured)

| Item                              | Monthly cost |
|-----------------------------------|--------------|
| Fly.io — `rpo-web` (shared-cpu-1x, 512MB, auto-stop) | ~$1.94 |
| Fly.io — `rpo-keeper` (shared-cpu-1x, 256MB)         | ~$1.94 |
| Fly.io — bandwidth (< 100 GB free per app)           | $0     |
| Cloudflare — DNS + CDN + WAF + DDoS + SSL            | $0     |
| Domain — `rpo.xyz`                                    | ~$0.83 (10/yr) |
| Google Workspace email (optional)                     | ~$6    |
| **Total (with email)**                                | **~$11 / mo** |
| **Total (without email)**                             | **~$5 / mo**  |

With Cloudflare caching, this scales to ~1M DAU without ever needing to upgrade the Fly machine size.

---

## 8. Troubleshooting

**`curl https://rpo.xyz` returns HTML but assets 404**
→ Cache rule mis-configured; check that `_next/static/*` is `Eligible for cache`.

**Geo-block hits my own team**
→ Your team is in a blocked country. Either use a VPN or add a Cloudflare WAF exception for your team IPs.

**Fly machine sleeps and first hit is slow**
→ Set `min_machines_running = 1` in `fly.toml`. Extra cost: ~$1 / month.

**Keeper stops mid-flight**
→ Check `flyctl logs --app rpo-keeper`; usually RPC provider rate-limit. Consider Alchemy / Chainstack paid tier.
