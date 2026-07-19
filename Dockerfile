# ================================
# Stage 1: Install dependencies
# ================================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci

# ================================
# Stage 2: Build application
# ================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# ================================
# Stage 3: Production runtime
# ================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# 1. Installation globale de Prisma pour éviter tout conflit avec le mode standalone
RUN npm install -g prisma@6.9.0

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000

# 2. Utilisation de la commande globale prisma (sans npx) pour lancer la migration
CMD ["sh", "-c", "prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"]