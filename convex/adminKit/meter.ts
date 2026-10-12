// Medición de llamadas a proveedores de IA, del lado de la app. Sin Convex
// adentro: la app arma el `AiMeter` (que escribe en `aiCalls.record`) y los
// adaptadores de cada proveedor envuelven su `fetch` con `metered`.

export type AiUsage = { inputTokens: number; outputTokens: number };

export type AiCallReport = AiUsage & {
  provider: string;
  model: string;
  latencyMs: number;
  ok: boolean;
  errorKind?: string;
};

export type AiMeter = (report: AiCallReport) => Promise<void>;

/**
 * Error de un adaptador con un tipo corto para el dashboard ("http_429",
 * "invalid_json", …). El mensaje no se guarda: puede traer pedazos del prompt.
 */
export class AiCallError extends Error {
  constructor(
    readonly kind: string,
    message: string,
  ) {
    super(message);
    this.name = "AiCallError";
  }
}

export function httpErrorKind(status: number): string {
  return `http_${status}`;
}

/**
 * Corre `run` y registra la llamada, haya salido bien o mal. `note` se llama
 * apenas se conocen los tokens: una respuesta que después no valida igual se
 * pagó. Medir nunca rompe el pedido: si el `meter` falla, se loguea y sigue.
 */
export async function metered<T>(
  meter: AiMeter | undefined,
  call: { provider: string; model: string },
  run: (note: (usage: AiUsage) => void) => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  if (!meter) return run(() => {});
  const startedAt = now();
  let usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
  const note = (value: AiUsage) => {
    usage = value;
  };
  const report = async (ok: boolean, errorKind?: string) => {
    try {
      await meter({ ...call, ...usage, latencyMs: now() - startedAt, ok, ...(errorKind ? { errorKind } : {}) });
    } catch (error) {
      console.error("No se pudo registrar la llamada de IA", error);
    }
  };
  try {
    const value = await run(note);
    await report(true);
    return value;
  } catch (error) {
    await report(false, error instanceof AiCallError ? error.kind : "exception");
    throw error;
  }
}
