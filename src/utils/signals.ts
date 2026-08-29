/**
 * Combina la señal de cancelación del cliente con un tiempo máximo (timeout),
 * de forma que la petición se aborte si el cliente cancela **o** si se supera
 * el tiempo límite. Se usa en las llamadas NO en streaming a los proveedores.
 */
export function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
