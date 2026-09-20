import { modelRepository, type PublicModel } from '../repositories/model.repository';
import { providersStatus } from './ai/provider.registry';
import { notFound } from '../utils/errors';

/** Etiqueta de motor mostrada al usuario (qué IA real hay detrás). */
const ENGINE_LABEL: Record<string, string> = {
  openai: 'GPT',
  anthropic: 'Claude',
  google: 'Gemini',
  nvidia: 'Llama',
  local: 'Local',
};

function engineOf(provider: string): string {
  return ENGINE_LABEL[provider] ?? provider;
}

function availableOf(provider: string, status: Record<string, boolean>): boolean {
  return provider === 'local' ? true : !!status[provider];
}

export const modelService = {
  /** Modelos habilitados con su motor (engine) y si están disponibles. */
  async listForUser() {
    const rows = await modelRepository.listEnabledWithProvider();
    const status = providersStatus();
    return rows.map((row) => {
      const { provider, ...model } = row;
      return { ...model, engine: engineOf(provider), available: availableOf(provider, status) };
    });
  },

  async getBySlug(slug: string): Promise<PublicModel> {
    const model = await modelRepository.findPublicBySlug(slug);
    if (!model || !model.enabled) {
      throw notFound('El modelo solicitado no existe', 'MODEL_NOT_FOUND');
    }
    return model;
  },

  /** Devuelve el registro interno (con proveedor) validando que esté habilitado. */
  async getEnabledInternal(slug: string) {
    const model = await modelRepository.findBySlug(slug);
    if (!model || !model.enabled) {
      throw notFound('El modelo solicitado no existe o no está disponible', 'MODEL_NOT_FOUND');
    }
    return model;
  },
};
