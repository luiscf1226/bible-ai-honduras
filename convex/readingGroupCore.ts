/**
 * Plan en grupo cerrado (#185, cierra #162). Lógica pura, sin funciones de
 * Convex: la importan el backend (`readingGroups.ts`), la app y los tests —
 * mismo patrón que `referralCode.ts`.
 *
 * El recorte que hace posible esto sin moderación (PRD §9c.3,
 * docs/spikes/moderacion-contenido-usuarios.md): **nadie escribe nada.** El
 * nombre del grupo sale de una lista fija más el nombre del plan, y lo único
 * que se ve de cada miembro es su nombre de cuenta y cuántos días del plan
 * lleva leídos. Sin chat, sin publicaciones, sin peticiones, sin ranking.
 */

/** Tope de personas por grupo, contando a quien lo creó (issue #185). */
export const GROUP_MAX_MEMBERS = 15;

/**
 * Tope de grupos por persona. No es una regla de producto, es un techo para que
 * "mis grupos" sea una consulta acotada: una familia y una o dos células.
 */
export const MAX_GROUPS_PER_USER = 5;

/**
 * Tipos de grupo: el nombre del grupo se elige de esta lista, nunca se escribe.
 * Un nombre libre ("Los de la célula de Ana") sería contenido de usuario que
 * ven otras personas, y eso pediría moderación.
 */
export const GROUP_KINDS = [
  { id: "familia", label: "Familia" },
  { id: "celula", label: "Célula" },
  { id: "escuela-dominical", label: "Escuela dominical" },
  { id: "jovenes", label: "Jóvenes" },
  { id: "amigos", label: "Amigos" },
] as const;

export type GroupKind = (typeof GROUP_KINDS)[number]["id"];

export function isGroupKind(value: string): value is GroupKind {
  return GROUP_KINDS.some((kind) => kind.id === value);
}

export function groupKindLabel(kind: GroupKind): string {
  return GROUP_KINDS.find((entry) => entry.id === kind)?.label ?? "Grupo";
}

/** "Célula · Ansiedad: siete días con Dios". Derivado, nunca escrito. */
export function groupDisplayName(kind: GroupKind, planName: string): string {
  return `${groupKindLabel(kind)} · ${planName}`;
}

// ── Token de invitación ──────────────────────────────────

/**
 * 16 caracteres de un alfabeto sin ambiguos (sin 0/O, 1/l/I): no se dicta, pero
 * si alguien lo copia a mano desde una captura, no se confunde. 16 × log2(54)
 * ≈ 92 bits: no se adivina.
 */
const TOKEN_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
export const INVITE_TOKEN_LENGTH = 16;
const TOKEN_PATTERN = new RegExp(`^[${TOKEN_ALPHABET}]{${INVITE_TOKEN_LENGTH}}$`);

/** `random` devuelve bytes aleatorios; en Convex es `crypto.getRandomValues`. */
export function makeInviteToken(random: (length: number) => Uint8Array): string {
  const bytes = random(INVITE_TOKEN_LENGTH);
  let token = "";
  for (let i = 0; i < INVITE_TOKEN_LENGTH; i += 1) {
    token += TOKEN_ALPHABET[(bytes[i] ?? 0) % TOKEN_ALPHABET.length];
  }
  return token;
}

export function parseInviteToken(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  return TOKEN_PATTERN.test(token) ? token : null;
}

/**
 * El `token` de un link de la app (`bibleai://grupo?token=…`) o del sitio
 * (`…/?ref=BAH-…&grupo=…`). Cualquier otra cosa → null.
 */
export function inviteTokenFromUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string" || !url.includes("?")) return null;
  const query = url.slice(url.indexOf("?") + 1);
  for (const part of query.split(/[&#]/)) {
    const [key, value = ""] = part.split("=");
    if (key === "token" || key === "grupo") {
      try {
        return parseInviteToken(decodeURIComponent(value));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** El link que abre la invitación dentro de la app. */
export function groupInviteAppLink(token: string): string {
  return `bibleai://grupo?token=${token}`;
}

// ── Lo que se ve de cada miembro ─────────────────────────

/**
 * Nombre que ven los demás: el primer nombre de la cuenta (Clerk). Sin nombre
 * no se cae al email — eso sería mostrar un dato que la persona nunca eligió
 * compartir.
 */
export function memberDisplayName(name: string | undefined | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length > 0 ? first : "Sin nombre";
}

export type MemberProgress = {
  name: string;
  isMe: boolean;
  /** null = todavía no empezó el plan (o lo borró). */
  completedCount: number | null;
  todayCompleted: boolean;
  totalDays: number;
};

/**
 * Orden alfabético, nunca por avance: no hay ranking (issue #162, "sin ranking
 * ni presión"). Empates de nombre → quien sos vos primero, para encontrarte.
 */
export function sortMembers<T extends { name: string; isMe: boolean }>(members: readonly T[]): T[] {
  return [...members].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.isMe === b.isMe ? 0 : a.isMe ? -1 : 1;
  });
}

/**
 * Línea de avance de un miembro. Cuenta lo leído, nunca lo atrasado: "le faltan
 * 9 días" frente a toda la célula sería exactamente la presión que el issue
 * pide evitar (mismo criterio que "Seguí desde donde estés" en el plan, #114).
 */
export function memberProgressLabel(member: Pick<MemberProgress, "completedCount" | "todayCompleted" | "totalDays">): string {
  if (member.completedCount === null) return "Todavía no empezó";
  if (member.completedCount >= member.totalDays) return "Terminó el plan";
  const days = `${member.completedCount} de ${member.totalDays} ${member.totalDays === 1 ? "día leído" : "días leídos"}`;
  return member.todayCompleted ? `${days} · leyó hoy` : days;
}

/** "3 de 15 personas". */
export function membersCountLabel(count: number): string {
  return `${count} de ${GROUP_MAX_MEMBERS} ${count === 1 ? "persona" : "personas"}`;
}

/**
 * Quién queda a cargo cuando sale quien creó el grupo: la persona que entró
 * primero. null = no queda nadie y el grupo se borra.
 */
export function nextOwner<T extends { joinedAt: number }>(remaining: readonly T[]): T | null {
  if (remaining.length === 0) return null;
  return [...remaining].sort((a, b) => a.joinedAt - b.joinedAt)[0] ?? null;
}

export type JoinStatus = "ok" | "already" | "not_found" | "full" | "too_many_groups";

/** Mensaje de la pantalla de invitación para cada respuesta de `join`. */
export function joinStatusCopy(status: Exclude<JoinStatus, "ok" | "already">): string {
  switch (status) {
    case "not_found":
      return "Esta invitación ya no sirve. Pedile a quien te invitó que te mande el link de nuevo.";
    case "full":
      return `Este grupo ya tiene ${GROUP_MAX_MEMBERS} personas, que es el máximo.`;
    case "too_many_groups":
      return `Ya estás en ${MAX_GROUPS_PER_USER} grupos. Salí de alguno para entrar a este.`;
  }
}

/** Texto que acompaña el link en WhatsApp. El link lo arma `src/lib/share.ts`. */
export function groupInviteMessage(groupName: string): string {
  return `Te invito a leer la Biblia en grupo: "${groupName}". Solo se ve cuántos días lleva leídos cada quien, nada más. Abrí el link para unirte:`;
}
