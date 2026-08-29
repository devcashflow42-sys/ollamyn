import type { ChatMessage } from '../types';

/**
 * Estimación aproximada de tokens (~4 caracteres por token).
 * Se usa únicamente cuando el proveedor no devuelve el consumo real,
 * para no dejar el registro de uso a cero.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, m) => total + estimateTokens(m.content) + 4, 0);
}
