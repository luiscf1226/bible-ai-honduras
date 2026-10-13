/**
 * Lógica pura del perfil de Mi espacio (cabecera tipo Instagram). El dibujo
 * está en `ProfileHeader.tsx`.
 */

export type ProfileStat = { id: "guardados" | "subrayados" | "notas"; label: string; count: number };

/** La letra de la foto: el nombre si hay, si no el correo; sin ninguno, "·". */
export function profileInitial(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "";
  const first = Array.from(source)[0];
  return first ? first.toLocaleUpperCase("es") : "·";
}

/** Los tres números de al lado de la foto, como publicaciones/seguidores/seguidos. */
export function profileStats(counts: { bookmarks: number; highlights: number; sermonNotes: number }): ProfileStat[] {
  return [
    { id: "guardados", label: "Guardados", count: counts.bookmarks },
    { id: "subrayados", label: "Subrayados", count: counts.highlights },
    { id: "notas", label: "Notas", count: counts.sermonNotes },
  ];
}
