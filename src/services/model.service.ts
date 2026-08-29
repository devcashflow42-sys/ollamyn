import { modelRepository, type PublicModel } from '../repositories/model.repository';
import { notFound } from '../utils/errors';

export const modelService = {
  listForUser(): Promise<PublicModel[]> {
    return modelRepository.listEnabled();
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
