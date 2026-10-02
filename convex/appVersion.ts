import { v } from "convex/values";

import { query } from "./_generated/server";

/**
 * Último build publicado por plataforma. Sirve para avisarle al tester que
 * está en un build viejo de TestFlight / Play: TestFlight no siempre actualiza
 * solo, y un build atrasado se ve como "en mi iPhone faltan opciones".
 *
 * El número vive en variables de entorno del deployment, no en código, para
 * poder subirlo sin redeploy después de que el build aparece en la tienda:
 *
 *   npx convex env set LATEST_IOS_BUILD 14
 *   npx convex env set LATEST_ANDROID_BUILD 9
 *
 * Sin la variable no hay aviso (es lo que pasa hoy en producción).
 *
 * `MIN_IOS_BUILD` / `MIN_ANDROID_BUILD` son el piso: un build menor ya no
 * funciona con este backend (por ejemplo, después de quitar un campo que ese
 * build todavía manda) y la app bloquea hasta que se actualice. Se sube solo
 * cuando hace falta, nunca por costumbre:
 *
 *   npx convex env set MIN_IOS_BUILD 12
 *
 * Solo lo respetan los builds que ya traen el bloqueo; los anteriores siguen
 * viendo, como mucho, el aviso suave.
 */
export function parseBuildNumber(raw: string | null | undefined): number | null {
  if (raw == null || !/^\d+$/.test(raw.trim())) {
    return null;
  }
  return Number(raw.trim());
}

export const latest = query({
  args: { platform: v.union(v.literal("ios"), v.literal("android")) },
  handler: async (_ctx, { platform }) => {
    const latest = platform === "ios" ? process.env.LATEST_IOS_BUILD : process.env.LATEST_ANDROID_BUILD;
    const min = platform === "ios" ? process.env.MIN_IOS_BUILD : process.env.MIN_ANDROID_BUILD;
    return { latestBuild: parseBuildNumber(latest), minBuild: parseBuildNumber(min) };
  },
});
