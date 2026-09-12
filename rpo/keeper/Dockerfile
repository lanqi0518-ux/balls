# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

# tsx runs .ts directly — no build step needed, and gives us clean logs
# on Fly. Add `RUN npm run build && node dist/index.js` if you prefer.
CMD ["npx", "tsx", "src/index.ts"]
