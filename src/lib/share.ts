const SHARE_BASE_URL = "https://bibleaihonduras.app";

export function buildReferralLink(referralCode: string): string {
  return `${SHARE_BASE_URL}/r/${referralCode}`;
}

export function buildShareMessage(text: string, referralCode: string): string {
  return `${text}\n\n${buildReferralLink(referralCode)}`;
}

// Dueño único del share sheet nativo (regla dura #3 de CLAUDE.md) — todo módulo que
// necesite compartir por WhatsApp importa esta función, no reimplementa su propia
// variante. El import de react-native es dinámico para que buildReferralLink/
// buildShareMessage sean testeables sin el runtime nativo.
export async function shareContent(params: { text: string; referralCode: string }): Promise<void> {
  const { Share } = await import("react-native");
  const message = buildShareMessage(params.text, params.referralCode);
  await Share.share({ message });
}
