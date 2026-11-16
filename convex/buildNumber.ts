// Lo comparten `appVersion.ts` (servidor) y `src/lib/appVersion.ts` (app). Vive
// aparte para que la app no cargue `_generated/server`:
// `src/lib/convexClientImports.test.ts`.

/** "14" → 14; cualquier cosa que no sea un entero sin signo → null. */
export function parseBuildNumber(raw: string | null | undefined): number | null {
  if (raw == null || !/^\d+$/.test(raw.trim())) {
    return null;
  }
  return Number(raw.trim());
}
