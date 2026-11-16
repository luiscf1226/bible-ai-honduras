// Versión vigente del consentimiento de IA. La compara `users.ts` en el
// servidor y la manda la app al aceptar; vive aparte para que la app no cargue
// `users.ts` (y con él medio backend): `src/lib/convexClientImports.test.ts`.
export const AI_CONSENT_VERSION = "2026-08-25";
