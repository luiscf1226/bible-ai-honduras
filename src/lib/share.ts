import type { ShareOrigin } from "../../convex/telemetry";

// Landing de GitHub Pages que ya se usa para privacidad (docs/store/privacy-policy.md,
// app/ajustes.tsx). El dominio bibleaihonduras.app nunca se registró y no resuelve
// (#103). La landing no tiene una ruta /r/<code>, así que el código de referido va
// como querystring sobre la raíz — esa sí responde 200 (verificado con curl -sI).
const SHARE_BASE_URL = "https://luiscf1226.github.io/bible-ai-honduras/";

export function buildReferralLink(referralCode: string): string {
  return `${SHARE_BASE_URL}?ref=${referralCode}`;
}

/**
 * Invitación a un grupo de lectura (#185): el mismo link del sitio, con el
 * token del grupo al lado del código de invitación. El sitio ofrece abrirlo en
 * la app (`bibleai://grupo?token=…`) o instalarla primero.
 */
export function buildGroupInviteLink(referralCode: string, groupInviteToken: string): string {
  return `${buildReferralLink(referralCode)}&grupo=${encodeURIComponent(groupInviteToken)}`;
}

export function buildShareMessage(text: string, referralCode: string, groupInviteToken?: string): string {
  const link = groupInviteToken ? buildGroupInviteLink(referralCode, groupInviteToken) : buildReferralLink(referralCode);
  return `${text}\n\n${link}`;
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

/** De dónde sale una imagen compartida, para el embudo. Solo "Dedicar" (#202) por ahora. */
export type { ShareOrigin };

// Embudo (convex/telemetry.ts): solo que se compartió (y, si importa, desde
// dónde), nunca qué. Import dinámico por lo mismo que `loadNative`, y nunca en
// tests: ahí se registra en `trackedShares` para poder verificarlo.
const trackedShares: (ShareOrigin | null)[] = [];

function trackShare(origin?: ShareOrigin): void {
  if (nativeOverride !== undefined) {
    trackedShares.push(origin ?? null);
    return;
  }
  void import("./telemetry")
    .then(({ track }) => track("share_completed", undefined, origin ? { origin } : undefined))
    .catch(() => undefined);
}

/** Solo para tests: los `share_completed` que se habrían mandado, con su origen. */
export function takeTrackedSharesForTests(): (ShareOrigin | null)[] {
  return trackedShares.splice(0);
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
export async function shareContent(params: {
  text: string;
  referralCode: string;
  /** Solo la invitación a un grupo (#185): agrega el token al link. */
  groupInviteToken?: string;
}): Promise<ShareResult> {
  try {
    const Share = await loadNative();
    const message = buildShareMessage(params.text, params.referralCode, params.groupInviteToken);
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
export async function shareImage(params: {
  fileUri: string;
  text: string;
  referralCode: string;
  /** "dedicated" = versículo dedicado (#202): el embudo lo distingue. */
  origin?: ShareOrigin;
}): Promise<ShareImageResult> {
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
      trackShare(params.origin);
      return { status: "shared", textCopied };
    }

    const result = await native.share({ message, url: params.fileUri });
    if (result.action === native.dismissedAction) {
      return { status: "dismissed" };
    }
    trackShare(params.origin);
    return { status: "shared", textCopied: false };
  } catch (error) {
    return { status: "error", error };
  }
}

/**
 * Exportar lo mío (#173): el texto va sin link de referido. Es lo personal de
 * la persona (guardados, notas), no una invitación, y no cuenta en el embudo
 * de compartir. Mismo share sheet y misma política de errores que `shareContent`.
 */
export async function sharePlainText(text: string): Promise<ShareResult> {
  try {
    const Share = await loadNative();
    const result = await Share.share({ message: text });
    return result.action === Share.dismissedAction ? { status: "dismissed" } : { status: "shared" };
  } catch (error) {
    return { status: "error", error };
  }
}

export type ShareFileNative = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (url: string, options?: { mimeType?: string; UTI?: string; dialogTitle?: string }) => Promise<void>;
};

let fileOverride: ShareFileNative | undefined;

/** Solo para tests. */
export function setShareFileNativeForTests(native: ShareFileNative | undefined): void {
  fileOverride = native;
}

async function loadFileNative(): Promise<ShareFileNative> {
  if (fileOverride !== undefined) return fileOverride;
  return await import("expo-sharing");
}

/**
 * Comparte un archivo del teléfono (el PDF de "Exportar lo mío") con la hoja
 * del sistema. `expo-sharing` no distingue cancelar de compartir, así que solo
 * hay `shared` o `error`. Nunca lanza.
 */
export async function shareFile(params: {
  uri: string;
  mimeType: string;
  uti?: string;
  dialogTitle: string;
}): Promise<ShareResult> {
  try {
    const Sharing = await loadFileNative();
    if (!(await Sharing.isAvailableAsync())) {
      return { status: "error", error: new Error("sharing_unavailable") };
    }
    await Sharing.shareAsync(params.uri, { mimeType: params.mimeType, UTI: params.uti, dialogTitle: params.dialogTitle });
    return { status: "shared" };
  } catch (error) {
    return { status: "error", error };
  }
}
