import { shareContent } from "../../lib/share";

export type QaCitation = {
  book: string;
  chapter: number;
  verse: number;
  version: string;
  text: string;
};

function formatCitation(citation: QaCitation): string {
  return `${citation.book} ${citation.chapter}:${citation.verse} (${citation.version})`;
}

export function buildQaShareText(question: string, citation: QaCitation): string {
  return `Pregunta: ${question}\n\n"${citation.text}"\n— ${formatCitation(citation)}`;
}

export async function shareQaAnswer(params: {
  question: string;
  citation: QaCitation;
  referralCode: string;
}): Promise<void> {
  await shareContent({
    referralCode: params.referralCode,
    text: buildQaShareText(params.question, params.citation),
  });
}
