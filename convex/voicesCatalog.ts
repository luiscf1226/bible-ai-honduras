export type VoiceCharacter = {
  slug: string;
  name: string;
  tag: string;
  gradientFrom: string;
  gradientTo: string;
};

// Solo personajes humanos (regla dura #2 de CLAUDE.md) — de Dios, Jesús y el
// Espíritu Santo se habla siempre en 3ra persona, nunca aparecen acá. Datos y
// gradientes tomados del prototipo (design/Bible AI Honduras.dc.html, pantalla
// "isVoices"), no inventados.
export const voiceCharacters: readonly VoiceCharacter[] = [
  { slug: "moises", name: "Moisés", tag: "Éxodo · el que dudó de sí mismo", gradientFrom: "#DCCBB4", gradientTo: "#B99A75" },
  { slug: "david", name: "David", tag: "Salmos · pastor, rey, y culpable", gradientFrom: "#CBD6CE", gradientTo: "#9BAF9E" },
  { slug: "ester", name: "Ester", tag: "Ester · valor en el lugar equivocado", gradientFrom: "#E3CFC6", gradientTo: "#C29E96" },
  { slug: "pablo", name: "Pablo", tag: "Cartas · cambió de bando", gradientFrom: "#D3CDBE", gradientTo: "#A89E88" },
  { slug: "rut", name: "Rut", tag: "Rut · extranjera que se quedó", gradientFrom: "#DFD3BC", gradientTo: "#BCA983" },
  { slug: "elias", name: "Elías", tag: "1 Reyes · agotado después del triunfo", gradientFrom: "#C9CFD8", gradientTo: "#98A3B0" },
];
