// Límites free que comparten servidor y app. Viven aparte de `quotas.ts` (el
// único servicio de cuotas, regla dura #3) para que la app no cargue el backend
// solo por un número: `src/lib/convexClientImports.test.ts`.

export type QuotaModule = "qa" | "voices" | "feelings" | "stories";

export const QUOTA_LIMITS: Record<QuotaModule, number> = {
  qa: 5,
  voices: 5,
  feelings: 3,
  stories: 1,
};
