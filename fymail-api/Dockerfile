FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

# ── Dependencies ───────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ── Build ──────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm build

# ── Production image ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

EXPOSE 3001

CMD ["node", "dist/index.js"]
