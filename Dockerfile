# ============================================================================
# ollamyn API - Dockerfile multi-stage (Debian slim para compatibilidad Prisma)
# ============================================================================

# --- Stage 1: build ---
FROM node:22-slim AS builder
WORKDIR /app

# openssl es necesario para que Prisma genere/ejecute su motor de consultas
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias (incluidas devDependencies para compilar TypeScript)
COPY package.json package-lock.json* ./
RUN npm install

# Copiar el resto del código y compilar
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# --- Stage 2: runtime ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Solo dependencias de producción (incluye prisma CLI y tsx para migraciones/seed)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar artefactos compilados y cliente de Prisma generado
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Usuario sin privilegios
RUN groupadd -r ollamyn && useradd -r -g ollamyn ollamyn \
    && mkdir -p /app/uploads && chown -R ollamyn:ollamyn /app
USER ollamyn

EXPOSE 3000

# Las migraciones se ejecutan por separado (release_command en Fly, o el
# `command` de docker-compose). Aquí solo arranca el servidor.
CMD ["node", "dist/server.js"]
