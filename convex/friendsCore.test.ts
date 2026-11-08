import { describe, expect, it } from "vitest";

import {
  cleanMessageText,
  friendCodeFromUrl,
  friendDisplayName,
  friendInitial,
  DAILY_STATS_SHARDS,
  hondurasDay,
  MAX_VERSE_SPAN,
  MESSAGES_PER_MINUTE,
  messagePreview,
  orderedPair,
  otherSide,
  PREVIEW_MAX_LENGTH,
  previewSnippet,
  RATE_WINDOW_MS,
  readField,
  REPORT_REASONS,
  reportCountsForSuspension,
  requestStatusCopy,
  sendStatusCopy,
  statsShard,
  takeRateToken,
  unreadField,
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
    for (const status of [
      "sent",
      "accepted",
      "already_friends",
      "already_sent",
      "not_found",
      "self",
      "too_many",
      "daily_limit",
      "try_later",
      "rules_required",
      "suspended",
    ] as const) {
      expect(requestStatusCopy(status).length).toBeGreaterThan(0);
    }
    expect(new Set(REPORT_REASONS.map((reason) => reason.id)).size).toBe(REPORT_REASONS.length);
  });

  it("vista previa guardada en la amistad: una línea, recortada, o la cita", () => {
    expect(previewSnippet({ kind: "text", text: "hola\n\n  chao " })).toBe("hola chao");
    const long = previewSnippet({ kind: "text", text: "palabra ".repeat(50) });
    expect(long.length).toBeLessThanOrEqual(PREVIEW_MAX_LENGTH);
    expect(long.endsWith("…")).toBe(true);
    expect(previewSnippet({ kind: "verse", verse: { book: "Juan", chapter: 3, verse: 16 } })).toBe("Juan 3:16");
    // La cita guardada se muestra igual que la del versículo.
    expect(messagePreview({ kind: "verse", text: "Juan 3:16", fromMe: true })).toBe("Vos: Versículo · Juan 3:16");
    expect(readField({ userA: "a", userB: "b" }, "b")).toBe("readAtB");
    expect(unreadField({ userA: "a", userB: "b" }, "a")).toBe("unreadA");
  });

  it("un reporte cuenta para la suspensión solo con amistad aceptada y algún mensaje de la persona", () => {
    expect(reportCountsForSuspension({ friendshipAccepted: true, evidenceCount: 1 })).toBe(true);
    expect(reportCountsForSuspension({ friendshipAccepted: true, evidenceCount: 0 })).toBe(false);
    expect(reportCountsForSuspension({ friendshipAccepted: false, evidenceCount: 3 })).toBe(false);
  });

  it("límite de ritmo: balde lleno al empezar, se vacía y se rellena con el tiempo", () => {
    let bucket: { tokens: number; updatedAt: number } | null = null;
    for (let index = 0; index < MESSAGES_PER_MINUTE; index += 1) {
      const next = takeRateToken(bucket, 1_000);
      expect(next.allowed).toBe(true);
      bucket = next;
    }
    expect(takeRateToken(bucket, 1_000).allowed).toBe(false);
    const oneToken = RATE_WINDOW_MS / MESSAGES_PER_MINUTE;
    expect(takeRateToken(bucket, 1_000 + oneToken - 1).allowed).toBe(false);
    expect(takeRateToken(bucket, 1_000 + oneToken).allowed).toBe(true);
    // Nunca junta más que un minuto de fichas.
    expect(takeRateToken(bucket, 1_000 + 10 * RATE_WINDOW_MS).tokens).toBe(MESSAGES_PER_MINUTE - 1);
  });

  it("día de Honduras y fila del contador diario", () => {
    expect(hondurasDay(Date.parse("2026-11-01T05:59:59Z"))).toBe("2026-10-31");
    expect(hondurasDay(Date.parse("2026-11-01T06:00:00Z"))).toBe("2026-11-01");
    const shard = statsShard("k57abc123");
    expect(shard).toBe(statsShard("k57abc123"));
    expect(shard).toBeGreaterThanOrEqual(0);
    expect(shard).toBeLessThan(DAILY_STATS_SHARDS);
  });
});
