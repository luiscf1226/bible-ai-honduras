import { parseBuildNumber } from "../../convex/appVersion";

// App Store Connect id (eas.json → submit.testflight.ios.ascAppId).
const ASC_APP_ID = "6807627270";
const ANDROID_PACKAGE = "com.bibleaihonduras.app";

export type UpdatePlatform = "ios" | "android";

/** "Versión 0.1.0 (build 12)". Sin datos nativos (web, Expo Go) queda solo lo que haya. */
export function versionLabel(version: string | null, build: string | null): string {
  const base = `Versión ${version ?? "desconocida"}`;
  return build ? `${base} (build ${build})` : base;
}

/**
 * Hay update cuando el servidor conoce un build más nuevo que el instalado.
 * Si falta cualquiera de los dos números no se avisa: un aviso falso que no se
 * puede resolver es peor que ninguno.
 */
export function isUpdateAvailable(installedBuild: string | null, latestBuild: number | null): boolean {
  const installed = parseBuildNumber(installedBuild);
  return installed !== null && latestBuild !== null && latestBuild > installed;
}

/**
 * El build instalado quedó debajo del piso que acepta el backend. Igual que el
 * aviso: sin alguno de los dos números no se bloquea. Bloquear por un dato que
 * falta dejaría a alguien sin app por un error nuestro.
 */
export function isUpdateRequired(installedBuild: string | null, minBuild: number | null): boolean {
  const installed = parseBuildNumber(installedBuild);
  return installed !== null && minBuild !== null && installed < minBuild;
}

/** Ficha pública de cada plataforma; nunca envía al usuario de tienda a TestFlight. */
export function updateUrls(platform: UpdatePlatform): string[] {
  return platform === "ios"
    ? [`itms-apps://apps.apple.com/app/id${ASC_APP_ID}`, `https://apps.apple.com/app/id${ASC_APP_ID}`]
    : [`market://details?id=${ANDROID_PACKAGE}`, `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`];
}

export function updateStoreName(platform: UpdatePlatform): string {
  return platform === "ios" ? "App Store" : "Google Play";
}
