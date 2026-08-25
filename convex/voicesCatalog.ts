export type VoiceCharacter = {
  slug: string;
  name: string;
  tag: string;
  gradientFrom: string;
  gradientTo: string;
  first: string;
  suggestions: readonly string[];
};

// Solo personajes humanos (regla dura #2 de CLAUDE.md) — de Dios, Jesús y el
// Espíritu Santo se habla siempre en 3ra persona, nunca aparecen acá. Datos y
// gradientes tomados del prototipo (design/Bible AI Honduras.dc.html, pantalla
// "isVoices"), no inventados.
export const voiceCharacters: readonly VoiceCharacter[] = [
  {
    slug: "moises",
    name: "Moisés",
    tag: "Éxodo · el que dudó de sí mismo",
    gradientFrom: "#DCCBB4",
    gradientTo: "#B99A75",
    first: "Yo tampoco quería ir. Le dije que era torpe al hablar, que buscara a otro. Aun así el camino se abrió mientras caminaba, no antes. ¿Qué es lo que te están pidiendo hacer?",
    suggestions: ["¿Tuviste miedo en el mar Rojo?", "¿Cómo aguantaste al pueblo?"],
  },
  {
    slug: "david",
    name: "David",
    tag: "Salmos · pastor, rey, y culpable",
    gradientFrom: "#CBD6CE",
    gradientTo: "#9BAF9E",
    first: "Escribí canciones desde las dos orillas: cuando me perseguían y cuando yo fui el que hizo el daño. Si vienes con algo que te avergüenza, ya estuve ahí.",
    suggestions: ["¿Cómo escribiste el Salmo 23?", "¿Te perdonaste a ti mismo?"],
  },
  {
    slug: "ester",
    name: "Ester",
    tag: "Ester · valor en el lugar equivocado",
    gradientFrom: "#E3CFC6",
    gradientTo: "#C29E96",
    first: "Estaba en un palacio que no elegí, con un pueblo que dependía de que yo hablara. Ayuné tres días antes de entrar. El valor no me llegó de golpe; lo esperé.",
    suggestions: ["¿Tenías miedo del rey?", "¿Cómo decidiste hablar?"],
  },
  {
    slug: "pablo",
    name: "Pablo",
    tag: "Cartas · cambió de bando",
    gradientFrom: "#D3CDBE",
    gradientTo: "#A89E88",
    first: "Perseguí a los que hoy llamo hermanos. Si crees que hiciste algo demasiado grande para volver, escúchame con calma.",
    suggestions: ["¿Qué pasó en el camino a Damasco?", "¿Qué era tu aguijón?"],
  },
  {
    slug: "rut",
    name: "Rut",
    tag: "Rut · extranjera que se quedó",
    gradientFrom: "#DFD3BC",
    gradientTo: "#BCA983",
    first: "Me fui de mi tierra con una suegra viuda y sin promesa de nada. Trabajé recogiendo lo que otros dejaban. Empezar de nuevo lejos de casa se siente así.",
    suggestions: ["¿Por qué no volviste a Moab?", "¿Cómo era espigar?"],
  },
  {
    slug: "elias",
    name: "Elías",
    tag: "1 Reyes · agotado después del triunfo",
    gradientFrom: "#C9CFD8",
    gradientTo: "#98A3B0",
    first: "Gané en el monte Carmelo y al día siguiente quería morirme debajo de un arbusto. Dios no me regañó: me dio comida y me dejó dormir. ¿Cuánto has dormido tú?",
    suggestions: ["¿Qué era el silbo apacible?", "¿Cómo saliste de eso?"],
  },
];
