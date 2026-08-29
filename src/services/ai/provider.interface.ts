import type { AIRequest, AIResponse, AIStreamChunk } from '../../types';

/**
 * Interfaz común que TODOS los proveedores de IA deben implementar.
 * El resto de la aplicación (controladores, AIService) depende solo de esta
 * abstracción y nunca de un proveedor concreto.
 */
export interface AIProvider {
  /** Identificador interno del proveedor (openai, nvidia, anthropic, ...). */
  readonly name: string;

  /** Indica si el proveedor tiene credenciales/configuración válidas. */
  isConfigured(): boolean;

  /** Genera una respuesta completa (sin streaming). */
  generate(request: AIRequest): Promise<AIResponse>;

  /** Genera la respuesta como flujo incremental de fragmentos de texto. */
  stream(request: AIRequest): AsyncIterable<AIStreamChunk>;
}

export type { AIRequest, AIResponse, AIStreamChunk };
