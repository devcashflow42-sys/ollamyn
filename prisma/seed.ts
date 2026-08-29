import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Semilla idempotente:
 *  - crea el usuario administrador inicial,
 *  - registra el catálogo público de modelos ollamyn-*, cada uno mapeado
 *    internamente a un proveedor real distinto (NVIDIA, OpenAI, Anthropic,
 *    Google) más un modelo local que funciona sin claves (modo demostración).
 *
 * El campo `provider`/`providerModel` es interno: el cliente solo ve el slug.
 * Para reasignar un modelo a otro proveedor basta con actualizar estos campos
 * en la base de datos, sin tocar las apps Android ni web.
 */
async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@ollamyn.com';
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin', status: 'active' },
    create: {
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      role: 'admin',
      status: 'active',
      plan: 'premium',
    },
  });
  console.log(`✔ Administrador listo: ${admin.email}`);

  const models = [
    {
      slug: 'ollamyn-fast',
      name: 'ollamyn Fast',
      provider: 'nvidia',
      providerModel: 'meta/llama-3.1-8b-instruct',
      description: 'Respuestas rápidas para tareas cotidianas.',
      contextWindow: 16_384,
      supportsStreaming: true,
    },
    {
      slug: 'ollamyn-pro',
      name: 'ollamyn Pro',
      provider: 'openai',
      providerModel: 'gpt-4o-mini',
      description: 'Modelo equilibrado de propósito general.',
      contextWindow: 128_000,
      supportsFiles: true,
      supportsStreaming: true,
    },
    {
      slug: 'ollamyn-reasoning',
      name: 'ollamyn Reasoning',
      provider: 'anthropic',
      providerModel: 'claude-3-5-sonnet-latest',
      description: 'Optimizado para razonamiento complejo y análisis.',
      contextWindow: 200_000,
      supportsFiles: true,
      supportsStreaming: true,
    },
    {
      slug: 'ollamyn-vision',
      name: 'ollamyn Vision',
      provider: 'google',
      providerModel: 'gemini-1.5-flash',
      description: 'Comprensión multimodal de texto e imágenes.',
      contextWindow: 1_000_000,
      supportsImages: true,
      supportsFiles: true,
      supportsStreaming: true,
    },
    {
      slug: 'ollamyn-local',
      name: 'ollamyn Local',
      provider: 'local',
      providerModel: 'llama3',
      description: 'Modelo local/self-hosted. Funciona sin claves (modo demo).',
      contextWindow: 8_192,
      supportsStreaming: true,
    },
  ];

  for (const m of models) {
    await prisma.aiModel.upsert({
      where: { slug: m.slug },
      update: {
        name: m.name,
        provider: m.provider,
        providerModel: m.providerModel,
        description: m.description,
        contextWindow: m.contextWindow,
        supportsImages: m.supportsImages ?? false,
        supportsFiles: m.supportsFiles ?? false,
        supportsStreaming: m.supportsStreaming ?? true,
        enabled: true,
      },
      create: {
        slug: m.slug,
        name: m.name,
        provider: m.provider,
        providerModel: m.providerModel,
        description: m.description,
        contextWindow: m.contextWindow,
        supportsImages: m.supportsImages ?? false,
        supportsFiles: m.supportsFiles ?? false,
        supportsStreaming: m.supportsStreaming ?? true,
        enabled: true,
      },
    });
    console.log(`✔ Modelo listo: ${m.slug} → ${m.provider}`);
  }

  console.log('\nSemilla completada. Inicia sesión como admin y prueba "ollamyn-local".');
}

main()
  .catch((err) => {
    console.error('Error en la semilla:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
