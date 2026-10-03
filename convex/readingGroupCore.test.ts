import { describe, expect, it } from "vitest";

import {
  GROUP_KINDS,
  GROUP_MAX_MEMBERS,
  groupDisplayName,
  groupInviteAppLink,
  groupInviteMessage,
  INVITE_TOKEN_LENGTH,
  inviteTokenFromUrl,
  isGroupKind,
  joinStatusCopy,
  makeInviteToken,
  memberDisplayName,
  memberProgressLabel,
  membersCountLabel,
  nextOwner,
  parseInviteToken,
  sortMembers,
} from "./readingGroupCore";

const bytes = (values: number[]) => () => new Uint8Array(values);
const sequence = () => (length: number) => new Uint8Array(Array.from({ length }, (_, i) => i * 7));

describe("token de invitación", () => {
  it("tiene 16 caracteres sin ambiguos y se reconoce a sí mismo", () => {
    const token = makeInviteToken(sequence());
    expect(token).toHaveLength(INVITE_TOKEN_LENGTH);
    expect(token).not.toMatch(/[01lIO]/);
    expect(parseInviteToken(token)).toBe(token);
    expect(parseInviteToken(`  ${token} `)).toBe(token);
  });

  it("dos fuentes aleatorias distintas dan tokens distintos", () => {
    expect(makeInviteToken(bytes(Array(16).fill(3)))).not.toBe(makeInviteToken(bytes(Array(16).fill(4))));
  });

  it("rechaza lo que no es un token", () => {
    expect(parseInviteToken(null)).toBeNull();
    expect(parseInviteToken("")).toBeNull();
    expect(parseInviteToken("corto")).toBeNull();
    expect(parseInviteToken("<img src=x>aaaaaaa")).toBeNull();
    expect(parseInviteToken("0000000000000000")).toBeNull();
  });

  it("lee el token del link de la app y del sitio", () => {
    const token = makeInviteToken(sequence());
    expect(inviteTokenFromUrl(groupInviteAppLink(token))).toBe(token);
    expect(inviteTokenFromUrl(`https://luiscf1226.github.io/bible-ai-honduras/?ref=BAH-12AB34C&grupo=${token}`)).toBe(token);
    expect(inviteTokenFromUrl("bibleai://home?ref=BAH-12AB34C")).toBeNull();
    expect(inviteTokenFromUrl("bibleai://grupo?token=basura")).toBeNull();
    expect(inviteTokenFromUrl("bibleai://grupo?token=%E0%A4%A")).toBeNull();
    expect(inviteTokenFromUrl(undefined)).toBeNull();
  });
});

describe("nombre del grupo", () => {
  it("sale de la lista fija y del plan, nunca de texto libre", () => {
    expect(groupDisplayName("celula", "Ansiedad")).toBe("Célula · Ansiedad");
    expect(isGroupKind("familia")).toBe(true);
    expect(isGroupKind("Los de Ana")).toBe(false);
    expect(GROUP_KINDS.map((kind) => kind.id)).toEqual(["familia", "celula", "escuela-dominical", "jovenes", "amigos"]);
  });

  it("el mensaje de WhatsApp aclara qué se comparte", () => {
    expect(groupInviteMessage("Familia · Duelo")).toContain("Solo se ve cuántos días lleva leídos cada quien");
  });
});

describe("miembros", () => {
  it("muestra solo el primer nombre y nunca cae al email", () => {
    expect(memberDisplayName("Ana María López")).toBe("Ana");
    expect(memberDisplayName("  ")).toBe("Sin nombre");
    expect(memberDisplayName(undefined)).toBe("Sin nombre");
  });

  it("ordena alfabéticamente, no por avance", () => {
    const sorted = sortMembers([
      { name: "Óscar", isMe: false, completedCount: 30 },
      { name: "ana", isMe: false, completedCount: 1 },
      { name: "Beto", isMe: false, completedCount: 90 },
      { name: "Ana", isMe: true, completedCount: 0 },
    ]);
    expect(sorted.map((m) => `${m.name}${m.isMe ? "*" : ""}`)).toEqual(["Ana*", "ana", "Beto", "Óscar"]);
  });

  it("la línea de avance cuenta lo leído, nunca lo atrasado", () => {
    expect(memberProgressLabel({ completedCount: null, todayCompleted: false, totalDays: 7 })).toBe("Todavía no empezó");
    expect(memberProgressLabel({ completedCount: 3, todayCompleted: false, totalDays: 7 })).toBe("3 de 7 días leídos");
    expect(memberProgressLabel({ completedCount: 4, todayCompleted: true, totalDays: 7 })).toBe("4 de 7 días leídos · leyó hoy");
    expect(memberProgressLabel({ completedCount: 7, todayCompleted: true, totalDays: 7 })).toBe("Terminó el plan");
    expect(memberProgressLabel({ completedCount: 0, todayCompleted: false, totalDays: 1 })).toBe("0 de 1 día leído");
  });

  it("cuenta personas contra el máximo", () => {
    expect(membersCountLabel(1)).toBe(`1 de ${GROUP_MAX_MEMBERS} persona`);
    expect(membersCountLabel(3)).toBe(`3 de ${GROUP_MAX_MEMBERS} personas`);
  });

  it("queda a cargo quien entró primero; sin nadie, null", () => {
    expect(nextOwner([{ id: "c", joinedAt: 30 }, { id: "b", joinedAt: 20 }])?.id).toBe("b");
    expect(nextOwner([])).toBeNull();
  });

  it("tiene un mensaje para cada rechazo de join", () => {
    expect(joinStatusCopy("not_found")).toMatch(/ya no sirve/);
    expect(joinStatusCopy("full")).toContain(String(GROUP_MAX_MEMBERS));
    expect(joinStatusCopy("too_many_groups")).toMatch(/Salí de alguno/);
  });
});
