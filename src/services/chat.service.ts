import { chatRepository } from '../repositories/chat.repository';
import { messageRepository } from '../repositories/message.repository';
import { modelRepository } from '../repositories/model.repository';
import { notFound, badRequest } from '../utils/errors';

export const chatService = {
  async create(userId: string, input: { title?: string; model?: string }) {
    let modelId: string | null = null;
    if (input.model) {
      const model = await modelRepository.findBySlug(input.model);
      if (!model || !model.enabled) {
        throw notFound('El modelo solicitado no existe', 'MODEL_NOT_FOUND');
      }
      modelId = model.id;
    }
    return chatRepository.create({
      userId,
      title: input.title?.trim() || 'Nuevo chat',
      modelId,
    });
  },

  async list(userId: string, params: { page: number; pageSize: number; includeArchived: boolean }) {
    const { items, total } = await chatRepository.listByUser({
      userId,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      includeArchived: params.includeArchived,
    });
    return { items, total };
  },

  async getOwnedOrThrow(id: string, userId: string) {
    const chat = await chatRepository.findOwned(id, userId);
    if (!chat) throw notFound('Chat no encontrado', 'CHAT_NOT_FOUND');
    return chat;
  },

  async getWithMessages(id: string, userId: string) {
    const chat = await this.getOwnedOrThrow(id, userId);
    const messages = await messageRepository.listByChat(id);
    return { ...chat, messages };
  },

  async update(
    id: string,
    userId: string,
    input: { title?: string; model?: string; archived?: boolean },
  ) {
    await this.getOwnedOrThrow(id, userId);
    const data: { title?: string; modelId?: string | null; archived?: boolean } = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.archived !== undefined) data.archived = input.archived;
    if (input.model !== undefined) {
      const model = await modelRepository.findBySlug(input.model);
      if (!model || !model.enabled) {
        throw notFound('El modelo solicitado no existe', 'MODEL_NOT_FOUND');
      }
      data.modelId = model.id;
    }
    if (Object.keys(data).length === 0) {
      throw badRequest('No se proporcionaron campos para actualizar');
    }
    return chatRepository.update(id, data);
  },

  async remove(id: string, userId: string) {
    await this.getOwnedOrThrow(id, userId);
    await chatRepository.delete(id);
  },
};
