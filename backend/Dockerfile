# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install OS dependencies needed by bcrypt native build
RUN apk add --no-cache python3 make g++ libc6-compat

# Copy package manifests first to leverage Docker layer cache
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy the rest of the source and build
COPY . .
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat

# Non-root user for the runtime
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public 2>/dev/null || true
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER appuser

EXPOSE 8000

# Health check — /health must respond within 60s of start
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8000/health || exit 1

CMD ["npm", "start"]
