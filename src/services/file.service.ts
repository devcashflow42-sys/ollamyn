import fs from 'node:fs/promises';
import path from 'node:path';
import { fileRepository } from '../repositories/file.repository';
import { chatRepository } from '../repositories/chat.repository';
import { env } from '../config/env';
import { forbidden, notFound } from '../utils/errors';

async function assertChatOwnership(chatId: string, userId: string): Promise<void> {
  const chat = await chatRepository.findOwned(chatId, userId);
  if (!chat) throw forbidden('El chat indicado no te pertenece');
}

export const fileService = {
  /** Registra un archivo ya subido a disco (adaptador de storage local). */
  async registerUploaded(
    userId: string,
    file: { originalname: string; filename: string; mimetype: string; size: number },
    chatId?: string,
  ) {
    if (chatId) await assertChatOwnership(chatId, userId);
    const url = `${env.PUBLIC_API_URL}/uploads/${file.filename}`;
    return fileRepository.create({
      userId,
      chatId: chatId ?? null,
      name: file.originalname,
      url,
      mimeType: file.mimetype,
      size: file.size,
    });
  },

  list(userId: string, chatId?: string) {
    return fileRepository.listByUser(userId, chatId);
  },

  async get(id: string, userId: string) {
    const file = await fileRepository.findOwned(id, userId);
    if (!file) throw notFound('Archivo no encontrado', 'FILE_NOT_FOUND');
    return file;
  },

  async remove(id: string, userId: string): Promise<void> {
    const file = await this.get(id, userId);
    await fileRepository.delete(id);
    // Intentar borrar del disco local si vive en el storage propio.
    const filename = file.url.split('/uploads/')[1];
    if (filename) {
      const filePath = path.join(env.fileStorageDir, path.basename(filename));
      await fs.unlink(filePath).catch(() => undefined);
    }
  },
};
