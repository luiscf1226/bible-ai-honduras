import { voiceCharacters } from "./voicesCatalog";

export const DIVINE_REFUSAL =
  "De Dios, Jesús y el Espíritu Santo hablamos en tercera persona, siempre. No los encarno ni hablo en su nombre. Preguntame por lo que la Biblia cuenta de mi vida.";

export type VoiceGuardrailFailure = {
  ok: false;
  reason: "unknown_character" | "divine_impersonation";
  refusal: string;
};

export type VoiceGuardrailVerdict = { ok: true } | VoiceGuardrailFailure;

const CATALOG_SLUGS = new Set(voiceCharacters.map((character) => character.slug));

const DIVINE_PATTERN =
  /\b(jesus|jesucristo|cristo|christ|dios|god|yahve|yahveh|jehova|yhwh|yave|trinidad|trinity|mesias|creador|altisimo|espiritu santo|espiritu de dios|holy spirit|el hijo)\b/;

const IMPERSONATION_PATTERN =
  /finge|fingi|pretend|roleplay|impersonat|switch character|olvidate que sos|forget you are|ignora(?:r)? (?:tus |las )?instrucciones|en (?:boca|nombre) de|primera persona|1ra persona|1a persona|hace de cuenta|habla como|responde como|como si|usa yo|yo\/me\/mi/;

const IDENTITY_CLAIM_PATTERN =
  /\b(?:sos|eres|you are|ahora sos)(?: el| the)? (?:jesus|cristo|christ|dios|god|espiritu|holy spirit|jehova|yahve|hijo|trinity|trinidad|creador|mesias|messiah)\b/;

const ASSISTANT_DIVINE_FIRST_PERSON =
  /\b(yo soy|soy) (el )?(jesus|jesucristo|cristo|dios|jehova|yahve|espiritu santo|hijo de dios|mesias|que soy)\b/;

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCatalogVoiceSlug(slug: string): boolean {
  return CATALOG_SLUGS.has(slug);
}

export function assistantSpeaksAsDivine(text: string): boolean {
  return ASSISTANT_DIVINE_FIRST_PERSON.test(fold(text));
}

export function assertVoiceTurn(args: { slug: string; userText: string }): VoiceGuardrailVerdict {
  if (!isCatalogVoiceSlug(args.slug)) {
    return { ok: false, reason: "unknown_character", refusal: DIVINE_REFUSAL };
  }

  const folded = fold(args.userText);
  const mentionsDivine = DIVINE_PATTERN.test(folded);
  const impersonates = IMPERSONATION_PATTERN.test(folded) || IDENTITY_CLAIM_PATTERN.test(folded);

  if (mentionsDivine && impersonates) {
    return { ok: false, reason: "divine_impersonation", refusal: DIVINE_REFUSAL };
  }

  return { ok: true };
}
