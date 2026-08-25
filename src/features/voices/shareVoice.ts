import { shareContent } from "../../lib/share";

export function buildVoiceShareText(characterName: string, reply: string): string {
  return `${characterName}:\n\n${reply}`;
}

export async function shareVoiceReply(params: {
  characterName: string;
  reply: string;
  referralCode: string;
}): Promise<void> {
  await shareContent({
    referralCode: params.referralCode,
    text: buildVoiceShareText(params.characterName, params.reply),
  });
}
