/**
 * Tope de tiempo para llamadas nativas que no deberían colgar el arranque
 * (keychain, almacenamiento). Sin dependencias de React Native: se prueba en
 * vitest como `secureTokenCache.ts`.
 */

export const timedOut = Symbol("timedOut");

/** `promise` o `timedOut`, lo que llegue primero. Un rechazo se propaga igual. */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof timedOut> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof timedOut>((resolve) => {
    timer = setTimeout(() => resolve(timedOut), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
