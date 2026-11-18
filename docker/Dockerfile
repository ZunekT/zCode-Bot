# ── build ──
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN npx prisma generate
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ── runtime ──
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
COPY assets ./assets
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# Migracje przy każdym starcie (idempotentne), potem bot.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
