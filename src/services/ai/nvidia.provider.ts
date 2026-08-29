import { OpenAICompatibleProvider } from './openai-compatible.provider';
import { env } from '../../config/env';

/**
 * Proveedor NVIDIA NIM (integrate.api.nvidia.com).
 * Expone modelos como meta/llama-*, nvidia/*, mistralai/* con API compatible
 * con OpenAI. Punto de entrada para futuros modelos propios sobre GPU NVIDIA.
 */
export class NvidiaProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      name: 'nvidia',
      baseUrl: env.NVIDIA_BASE_URL,
      apiKey: env.NVIDIA_API_KEY,
      supportsStreamUsage: true,
    });
  }

  isConfigured(): boolean {
    return Boolean(env.NVIDIA_API_KEY);
  }
}
