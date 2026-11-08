import { describe, expect, it } from "vitest";

import {
  cleanMessageText,
  friendCodeFromUrl,
  friendDisplayName,
  friendInitial,
  MAX_VERSE_SPAN,
  messagePreview,
  orderedPair,
  otherSide,
  readField,
  REPORT_REASONS,
  requestStatusCopy,
  sendStatusCopy,
  unreadLabel,
  verseLabel,
  verseRangeEnd,
} from "./friendsCore";

describe("friendsCore", () => {
  it("el par queda ordenado sin importar quién pide", () => {
    expect(orderedPair("b", "a")).toEqual({ userA: "a", userB: "b" });
    expect(orderedPair("a", "b")).toEqual({ userA: "a", userB: "b" });
    expect(otherSide({ userA: "a", userB: "b" }, "a")).toBe("b");
    expect(otherSide({ userA: "a", userB: "b" }, "b")).toBe("a");
    expect(otherSide({ userA: "a", userB: "b" }, "c")).toBeNull();
    expect(readField({ userA: "a", userB: "b" }, "b")).toBe("readAtB");
  });

  it("nombre visible: primer nombre e inicial, nunca el correo", () => {
    expect(friendDisplayName("Ana María López")).toBe("Ana M.");
    expect(friendDisplayName("  beto  ")).toBe("beto");
    expect(friendDisplayName("Carlos lópez")).toBe("Carlos L.");
    expect(friendDisplayName(undefined)).toBe("Sin nombre");
    expect(friendInitial("ana M.")).toBe("A");
  });

  it("lee el código del link de la app y del sitio", () => {
    expect(friendCodeFromUrl("bibleai://amigo?code=BAH-1234ABC")).toBe("BAH-1234ABC");
    expect(friendCodeFromUrl("bibleai://amigo?code=bah1234abc")).toBe("BAH-1234ABC");
    expect(friendCodeFromUrl("https://luiscf1226.github.io/bible-ai-honduras/?ref=BAH-1234ABC&amigo=1")).toBe("BAH-1234ABC");
    // Un link de invitación común (sin `amigo`) no es una solicitud de amistad.
    expect(friendCodeFromUrl("https://luiscf1226.github.io/bible-ai-honduras/?ref=BAH-1234ABC")).toBeNull();
    expect(friendCodeFromUrl("bibleai://grupo?token=abc")).toBeNull();
    expect(friendCodeFromUrl("bibleai://amigo?code=nada")).toBeNull();
    expect(friendCodeFromUrl(null)).toBeNull();
  });

  it("limpia el texto sin tocar el contenido", () => {
    expect(cleanMessageText("  hola\r\n\r\n\r\n\r\nchao  ")).toBe("hola\n\nchao");
  });

  it("citas y rangos", () => {
    expect(verseLabel({ book: "Juan", chapter: 3, verse: 16 })).toBe("Juan 3:16");
    expect(verseLabel({ book: "Salmos", chapter: 23, verse: 1, verseEnd: 4 })).toBe("Salmos 23:1-4");
    expect(verseRangeEnd({ book: "Salmos", chapter: 23, verse: 1 })).toBe(1);
    expect(verseRangeEnd({ book: "Salmos", chapter: 23, verse: 1, verseEnd: 50 })).toBe(MAX_VERSE_SPAN);
    expect(verseRangeEnd({ book: "Salmos", chapter: 23, verse: 0 })).toBeNull();
    expect(verseRangeEnd({ book: "Salmos", chapter: 1.5, verse: 1 })).toBeNull();
  });

  it("vista previa y contador", () => {
    expect(messagePreview(null)).toBe("Todavía no se han escrito");
    expect(messagePreview({ kind: "text", text: "hola\n\nchao", fromMe: false })).toBe("hola chao");
    expect(messagePreview({ kind: "text", text: "hola", fromMe: true })).toBe("Vos: hola");
    expect(messagePreview({ kind: "verse", verse: { book: "Juan", chapter: 3, verse: 16 }, fromMe: false })).toBe(
      "Versículo · Juan 3:16",
    );
    expect(unreadLabel(3)).toBe("3");
    expect(unreadLabel(100)).toBe("99+");
  });

  it("cada respuesta tiene su aviso y los motivos de reporte no se repiten", () => {
    for (const status of ["empty", "too_long", "offensive", "rate_limited", "not_friends", "rules_required", "suspended", "verse_not_found"] as const) {
      expect(sendStatusCopy(status).length).toBeGreaterThan(0);
    }
    for (const status of ["sent", "accepted", "already_friends", "already_sent", "not_found", "self", "too_many", "rules_required", "suspended"] as const) {
      expect(requestStatusCopy(status).length).toBeGreaterThan(0);
    }
    expect(new Set(REPORT_REASONS.map((reason) => reason.id)).size).toBe(REPORT_REASONS.length);
  });
});
