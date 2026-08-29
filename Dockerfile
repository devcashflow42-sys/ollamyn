# ============================================================================
# ollamyn API - Dockerfile multi-stage
# ============================================================================

# --- Stage 1: build ---
FROM node:22-alpine AS builder
WORKDIR /app

# Instalar dependencias (incluidas devDependencies para compilar)
COPY package.json package-lock.json* ./
RUN npm install

# Copiar el resto del código y compilar
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# --- Stage 2: runtime ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Solo dependencias de producción
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar artefactos compilados y cliente de Prisma generado
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Usuario sin privilegios
RUN addgroup -S ollamyn && adduser -S ollamyn -G ollamyn \
    && mkdir -p /app/uploads && chown -R ollamyn:ollamyn /app
USER ollamyn

EXPOSE 3000

# Aplica migraciones pendientes y arranca el servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
