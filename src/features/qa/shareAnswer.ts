import { shareContent, type ShareResult } from "../../lib/share";

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

// Devuelve el resultado en vez de tragárselo (#103) para que quien la invoque
// pueda distinguir cancelación de error real y mostrar un error suave.
export function shareQaAnswer(params: {
  question: string;
  citation: QaCitation;
  referralCode: string;
}): Promise<ShareResult> {
  return shareContent({
    referralCode: params.referralCode,
    text: buildQaShareText(params.question, params.citation),
  });
}
