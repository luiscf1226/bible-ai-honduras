// Contrato v1 entre cada app y el dashboard multi-app (luiscf1226/lcf-admin#1).
// El dashboard no sabe nada de ninguna app: pinta lo que describe el manifiesto.

export const CONTRACT_VERSION = 1;

export type MetricFormat = "number" | "currency" | "percent" | "duration";
export type MetricChart = "kpi" | "series" | "bars" | "topN";

export type MetricDescriptor = {
  label: string;
  format: MetricFormat;
  chart: MetricChart;
  /** Qué representa la dimensión, si la métrica la tiene ("Módulo", "Libro"…). */
  dimLabel?: string;
};

export type Manifest = {
  contractVersion: typeof CONTRACT_VERSION;
  app: { id: string; name: string };
  sections: Array<{ title: string; metrics: string[] }>;
  metrics: Record<string, MetricDescriptor>;
};

/** Una fila de la foto diaria. Sin `dim` = total del día. */
export type MetricRow = { day: string; key: string; dim?: string; value: number };

export type AdminError = { message: string; stack?: string; fatal: boolean; platform: string; build?: string; at: number };

/** Métricas que el kit calcula solo, iguales en todas las apps. */
export const STANDARD_METRICS: Record<string, MetricDescriptor> = {
  "std.active_1d": { label: "Teléfonos activos (día)", format: "number", chart: "series" },
  "std.active_7d": { label: "Teléfonos activos (7 días)", format: "number", chart: "kpi" },
  "std.active_30d": { label: "Teléfonos activos (30 días)", format: "number", chart: "kpi" },
  "std.funnel": { label: "Embudo (teléfonos por evento)", format: "number", chart: "bars", dimLabel: "Evento" },
  "std.ai_calls": { label: "Llamadas a la IA", format: "number", chart: "series", dimLabel: "Función" },
  "std.ai_tokens": { label: "Tokens de IA", format: "number", chart: "series", dimLabel: "Función" },
  "std.ai_cost_usd": { label: "Costo de IA (estimado)", format: "currency", chart: "series", dimLabel: "Función" },
  "std.ai_errors": { label: "Errores de IA", format: "number", chart: "series", dimLabel: "Función" },
  "std.ai_latency_p50_ms": { label: "Latencia IA p50", format: "duration", chart: "series" },
  "std.ai_latency_p95_ms": { label: "Latencia IA p95", format: "duration", chart: "series" },
  "std.ai_outcomes": { label: "Resultados de la IA", format: "number", chart: "bars", dimLabel: "Resultado" },
  "std.errors": { label: "Errores de la app", format: "number", chart: "series", dimLabel: "Plataforma" },
  "std.errors_fatal": { label: "Errores fatales", format: "number", chart: "series" },
};
