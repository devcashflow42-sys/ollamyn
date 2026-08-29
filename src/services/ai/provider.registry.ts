import type { AIProvider } from './provider.interface';
import { OpenAIProvider } from './openai.provider';
import { NvidiaProvider } from './nvidia.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GoogleProvider } from './google.provider';
import { LocalProvider } from './local.provider';
import { logger } from '../../config/logger';

/**
 * Registro central de proveedores. La clave es el valor del campo `provider`
 * en la tabla `ai_models`. Añadir un proveedor nuevo se reduce a registrarlo
 * aquí; ni controladores ni clientes necesitan cambios.
 */
const providers = new Map<string, AIProvider>();

function register(provider: AIProvider): void {
  providers.set(provider.name, provider);
}

register(new OpenAIProvider());
register(new NvidiaProvider());
register(new AnthropicProvider());
register(new GoogleProvider());
register(new LocalProvider());

export function getProvider(name: string): AIProvider | undefined {
  return providers.get(name);
}

export function listProviders(): AIProvider[] {
  return [...providers.values()];
}

/** Estado de configuración de cada proveedor (para el health check admin). */
export function providersStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  for (const p of providers.values()) {
    status[p.name] = p.isConfigured();
  }
  return status;
}

logger.info(
  { providers: [...providers.keys()] },
  'Proveedores de IA registrados',
);
