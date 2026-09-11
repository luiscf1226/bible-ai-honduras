import { shareContent, type ShareResult } from "../../lib/share";

export function buildVoiceShareText(characterName: string, reply: string): string {
  return `${characterName}:\n\n${reply}`;
}

// Devuelve el resultado en vez de tragárselo (#103) para que quien la invoque
// pueda distinguir cancelación de error real y mostrar un error suave.
export function shareVoiceReply(params: {
  characterName: string;
  reply: string;
  referralCode: string;
}): Promise<ShareResult> {
  return shareContent({
    referralCode: params.referralCode,
    text: buildVoiceShareText(params.characterName, params.reply),
  });
}
