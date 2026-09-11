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

export type ShareResult =
  | { status: "shared" }
  | { status: "dismissed" }
  | { status: "error"; error: unknown };

export type ShareNative = {
  share: (content: { message: string }) => Promise<{ action: string; activityType?: string | null }>;
  dismissedAction: string;
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
  const { Share } = await import("react-native");
  return Share;
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
    return { status: "shared" };
  } catch (error) {
    return { status: "error", error };
  }
}
