// Respuesta fija ante riesgo de autolesión o suicidio en los módulos con IA
// (Preguntar, Voces y Sentir). Cuando el texto lo indica no se consume cuota
// ni se llama a ningún proveedor: la persona recibe recursos de ayuda, no una
// respuesta generada. Solo detecta frases en primera persona, para que una
// pregunta bíblica sobre el tema ("¿qué dice la Biblia del suicidio?") siga
// el pipeline normal.

// Límites de palabra con Unicode: `\b` de JS no reconoce letras con tilde.
function phrase(source: string) {
  return new RegExp(`(?<!\\p{L})(?:${source})(?!\\p{L})`, "u");
}

const CRISIS_PATTERNS: RegExp[] = [
  "suicidarme",
  "pensamientos? suicidas?",
  // "Morir a mí mismo" / "morir al yo" es lenguaje de santificación, no riesgo.
  "(me )?quiero (morir(me)?(?! a m[ií] mism[oa]| al yo| a mi carne| al pecado)|matarme|suicidarme)",
  "me quiero matar",
  "(voy a|pienso|pensando en|ganas de) (matarme|quitarme la vida|morirme)",
  "quitarme la vida",
  "acabar con mi vida",
  "no quiero (vivir|seguir viviendo|seguir aquí|seguir aqui)",
  "no (le )?veo sentido a (mi )?vivir",
  "no vale la pena vivir",
  "mejor (estaría |estaria )?muert[oa]",
  "(hacerme|me hago|me estoy haciendo) daño",
  "(cortarme|me corto|me estoy cortando) (las venas|las muñecas|los brazos)",
].map(phrase);

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ");
}

export function detectCrisis(...texts: (string | undefined)[]): boolean {
  const joined = normalize(texts.filter(Boolean).join(" "));
  return CRISIS_PATTERNS.some((pattern) => pattern.test(joined));
}

export const CRISIS_REPLY = [
  "Gracias por contarlo. Lo que estás viviendo importa y no tenés que pasarlo sin compañía.",
  "Si estás pensando en hacerte daño o en quitarte la vida, buscá ayuda ahora: en Honduras llamá al 911 o andá a la emergencia más cercana.",
  "Hablá hoy con alguien de confianza: un familiar, un amigo o tu pastor.",
  "Esta app acompaña la lectura de la Biblia, pero no puede atender una crisis. Pedir ayuda es un paso valiente.",
].join("\n\n");
