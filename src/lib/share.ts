// Landing de GitHub Pages que ya se usa para privacidad (docs/store/privacy-policy.md,
// app/ajustes.tsx). El dominio bibleaihonduras.app nunca se registró y no resuelve
// (#103). La landing no tiene una ruta /r/<code>, así que el código de referido va
// como querystring sobre la raíz — esa sí responde 200 (verificado con curl -sI).
const SHARE_BASE_URL = "https://luiscf1226.github.io/bible-ai-honduras/";

export function buildReferralLink(referralCode: string): string {
  return `${SHARE_BASE_URL}?ref=${referralCode}`;
}

export function buildShareMessage(text: string, referralCode: string): string {
  return `${text}\n\n${buildReferralLink(referralCode)}`;
}

/** `captureRef` devuelve una ruta suelta en iOS; el share sheet necesita `file://`. */
export function asFileUri(path: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : `file://${path}`;
}

export type ShareResult =
  | { status: "shared" }
  | { status: "dismissed" }
  | { status: "error"; error: unknown };

/**
 * Resultado de compartir una imagen. En Android el share sheet de archivos no
 * lleva texto: el mensaje con el link de referido se copia al portapapeles
 * (`textCopied`) para que la persona lo pegue como descripción del estado.
 */
export type ShareImageResult =
  | { status: "shared"; textCopied: boolean }
  | { status: "dismissed" }
  | { status: "error"; error: unknown };

export type ShareNative = {
  share: (content: { message: string; url?: string }) => Promise<{ action: string; activityType?: string | null }>;
  dismissedAction: string;
  /** `Platform.OS`. Sin él se asume el camino de iOS (`Share.share` con `url`). */
  os?: string;
  /** Share sheet de archivos (expo-sharing). Solo hace falta en Android. */
  shareFile?: (fileUri: string, options: { mimeType: string; dialogTitle?: string; UTI?: string }) => Promise<void>;
  /** Portapapeles, para el texto que Android no deja adjuntar a la imagen. */
  copyText?: (text: string) => void;
};

let nativeOverride: ShareNative | undefined;

/** Solo para tests: evita depender del runtime nativo de react-native. */
export function setShareNativeForTests(native: ShareNative): void {
  nativeOverride = native;
}

export function resetShareNativeForTests(): void {
  nativeOverride = undefined;
}

async function loadNative(): Promise<ShareNative> {
  if (nativeOverride !== undefined) {
    return nativeOverride;
  }
  const { Clipboard, Platform, Share } = await import("react-native");
  return {
    share: (content) => Share.share(content),
    dismissedAction: Share.dismissedAction,
    os: Platform.OS,
    shareFile: async (fileUri, options) => {
      const Sharing = await import("expo-sharing");
      await Sharing.shareAsync(fileUri, options);
    },
    copyText: (text) => Clipboard.setString(text),
  };
}

// Embudo (convex/telemetry.ts): solo que se compartió, nunca qué. Import
// dinámico por lo mismo que `loadNative`, y nunca en tests.
function trackShare(): void {
  if (nativeOverride !== undefined) return;
  void import("./telemetry").then(({ track }) => track("share_completed")).catch(() => undefined);
}

// Dueño único del share sheet nativo (regla dura #3 de CLAUDE.md) — todo módulo que
// necesite compartir por WhatsApp importa esta función, no reimplementa su propia
// variante. El import de react-native es dinámico (vía loadNative) para que
// buildReferralLink/buildShareMessage sean testeables sin el runtime nativo.
//
// Antes del fix, un rechazo de Share.share() (o del propio `await import`) se
// escapaba de esta función sin try/catch: como los 4 llamadores invocaban
// `shareContent` con `void`, la promesa rechazada nunca se manejaba y terminaba en
// un unhandled promise rejection — el mecanismo que en build de release mata el
// proceso (#103). Repro documentado en docs/test-plans/repro-103-share-crash.md.
//
// iOS resuelve con { action: 'dismissedAction' } cuando el usuario cancela.
// Android nunca reporta cancelación: siempre resuelve con { action: 'sharedAction' },
// así que en Android un cierre de share sheet se cuenta como "shared", no como error.
export async function shareContent(params: { text: string; referralCode: string }): Promise<ShareResult> {
  try {
    const Share = await loadNative();
    const message = buildShareMessage(params.text, params.referralCode);
    const result = await Share.share({ message });

    if (result.action === Share.dismissedAction) {
      return { status: "dismissed" };
    }
    trackShare();
    return { status: "shared" };
  } catch (error) {
    return { status: "error", error };
  }
}

/**
 * Comparte una imagen (la tarjeta 9:16 del versículo del día, #161) con el
 * mismo mensaje y link de referido que `shareContent`. Vive acá y no en la
 * pantalla por la regla dura #3: un solo dueño del share sheet.
 *
 * - **iOS:** `Share.share({ message, url })` manda la imagen y el texto juntos.
 *   Cancelar devuelve `dismissedAction` → `dismissed`, no es error.
 * - **Android:** `Share.share` de react-native no acepta archivos, así que la
 *   imagen va por expo-sharing, que no lleva texto. El mensaje se copia antes
 *   al portapapeles para no perder el `?ref=`. Android no avisa si se canceló:
 *   se cuenta como `shared`, igual que en `shareContent`.
 */
export async function shareImage(params: { fileUri: string; text: string; referralCode: string }): Promise<ShareImageResult> {
  try {
    const native = await loadNative();
    const message = buildShareMessage(params.text, params.referralCode);

    if (native.os === "android") {
      if (!native.shareFile) {
        throw new Error("No hay share sheet de archivos en este dispositivo.");
      }
      let textCopied = false;
      if (native.copyText) {
        try {
          native.copyText(message);
          textCopied = true;
        } catch {
          // Sin portapapeles la imagen igual se comparte, solo sin el texto.
        }
      }
      await native.shareFile(params.fileUri, { mimeType: "image/png", dialogTitle: "Compartir versículo" });
      trackShare();
      return { status: "shared", textCopied };
    }

    const result = await native.share({ message, url: params.fileUri });
    if (result.action === native.dismissedAction) {
      return { status: "dismissed" };
    }
    trackShare();
    return { status: "shared", textCopied: false };
  } catch (error) {
    return { status: "error", error };
  }
}
