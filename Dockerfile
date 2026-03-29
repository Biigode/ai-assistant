FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json tsconfig.build.json ./
RUN npm ci

COPY src/ src/

RUN npx tsc -p tsconfig.build.json

# ── Production ────────────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

RUN apk add --no-cache libc6-compat
RUN npm rebuild

COPY --from=builder /app/dist/ dist/

CMD ["node", "dist/index.js"]
