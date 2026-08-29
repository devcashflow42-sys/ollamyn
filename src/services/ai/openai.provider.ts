import { OpenAICompatibleProvider } from './openai-compatible.provider';
import { env } from '../../config/env';

/** Proveedor OpenAI (api.openai.com u otra base compatible). */
export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      name: 'openai',
      baseUrl: env.OPENAI_BASE_URL,
      apiKey: env.OPENAI_API_KEY,
      supportsStreamUsage: true,
    });
  }

  isConfigured(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  }
}
