import { describe, expect, it } from "vitest";

import { tokens } from "../../theme/tokens";
import {
  buildExportDocument,
  buildExportHtml,
  buildExportText,
  escapeHtml,
  exportDate,
  exportPreview,
  exportSummary,
  type ExportBookmark,
  type ExportHighlight,
} from "./exportMine";

// 2 de octubre de 2026, 10:00 en Honduras (UTC-6).
const NOW = Date.UTC(2026, 9, 2, 16, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const bookmark = (overrides: Partial<ExportBookmark>): ExportBookmark => ({
  book: "Juan",
  chapter: 3,
  verse: 16,
  createdAt: NOW - DAY,
  version: "RV1909",
  text: "Porque de tal manera amó Dios al mundo…",
  note: null,
  ...overrides,
});

const highlight = (overrides: Partial<ExportHighlight>): ExportHighlight => ({
  book: "Salmos",
  chapter: 46,
  verse: 1,
  color: "amber",
  updatedAt: NOW - 2 * DAY,
  version: "RV1909",
  text: "Dios es nuestro amparo y fortaleza…",
  ...overrides,
});

const sample = () =>
  buildExportDocument({
    bookmarks: [
      bookmark({}),
      bookmark({ book: "Génesis", chapter: 1, verse: 1, text: "En el principio…", note: "  Mi primer guardado  " }),
      bookmark({ book: "Salmos", chapter: 46, verse: 1, text: "Dios es nuestro amparo y fortaleza…" }),
      bookmark({ book: "Juan", chapter: 1, verse: 1, text: "En el principio era el Verbo…" }),
    ],
    highlights: [highlight({}), highlight({ book: "Juan", chapter: 3, verse: 2, color: "sage", text: null })],
    generatedAt: NOW,
  });

describe("buildExportDocument", () => {
  it("ordena por libro (canon), capítulo y versículo", () => {
    const doc = sample();
    expect(doc.books.map((group) => group.book)).toEqual(["Génesis", "Salmos", "Juan"]);
    expect(doc.books[2].entries.map((entry) => entry.reference)).toEqual(["Juan 1:1", "Juan 3:2", "Juan 3:16"]);
  });

  it("un versículo guardado y subrayado sale una sola vez, con las dos marcas", () => {
    const salmo = sample().books[1].entries;
    expect(salmo).toHaveLength(1);
    expect(salmo[0].savedAt).not.toBeNull();
    expect(salmo[0].highlight?.color).toBe("amber");
  });

  it("cuenta guardados, notas y subrayados; la nota va con su guardado", () => {
    const doc = sample();
    expect(doc.counts).toEqual({ saved: 4, notes: 1, highlights: 2, prayers: 0 });
    expect(doc.total).toBe(6);
    expect(doc.books[0].entries[0].note).toBe("Mi primer guardado");
  });

  it("con 0 elementos, total es 0 (el botón se deshabilita)", () => {
    const doc = buildExportDocument({ bookmarks: [], highlights: [], generatedAt: NOW });
    expect(doc.total).toBe(0);
    expect(doc.books).toEqual([]);
    expect(exportSummary(doc.counts)).toBe("Nada todavía");
  });

  it("una nota en blanco no cuenta como nota", () => {
    const doc = buildExportDocument({ bookmarks: [bookmark({ note: "   " })], highlights: [], generatedAt: NOW });
    expect(doc.counts.notes).toBe(0);
    expect(doc.books[0].entries[0].note).toBeNull();
  });

  it("deja listo el lugar de las peticiones (#159), en orden de fecha", () => {
    const doc = buildExportDocument({
      bookmarks: [],
      highlights: [],
      prayers: [
        { text: "Por el trabajo de mi papá", createdAt: NOW - DAY },
        { text: "Por mi abuela", createdAt: NOW - 3 * DAY, answeredAt: NOW },
      ],
      generatedAt: NOW,
    });
    expect(doc.total).toBe(2);
    expect(doc.prayers.map((prayer) => prayer.text)).toEqual(["Por mi abuela", "Por el trabajo de mi papá"]);
    expect(buildExportText(doc)).toContain("PETICIONES");
    expect(buildExportText(doc)).toContain("Respondida el 2 de octubre de 2026");
  });

  it("un libro desconocido va al final", () => {
    const doc = buildExportDocument({
      bookmarks: [bookmark({ book: "Libro raro" }), bookmark({ book: "Apocalipsis", chapter: 22, verse: 21 })],
      highlights: [],
      generatedAt: NOW,
    });
    expect(doc.books.map((group) => group.book)).toEqual(["Apocalipsis", "Libro raro"]);
  });
});

describe("exportPreview", () => {
  it("muestra los primeros en el mismo orden y cuántos más hay", () => {
    const preview = exportPreview(sample(), 3);
    expect(preview.entries.map((entry) => entry.reference)).toEqual(["Génesis 1:1", "Salmos 46:1", "Juan 1:1"]);
    expect(preview.more).toBe(2);
  });
});

describe("buildExportText", () => {
  const text = buildExportText(sample());

  it("trae referencia, versión (RV1909) y fecha", () => {
    expect(text).toContain("Juan 3:16 (RV1909)");
    expect(text).toContain("Guardado el 1 de octubre de 2026");
    expect(text).toContain("Subrayado en ámbar el 30 de septiembre de 2026");
    expect(text).toContain("Exportado el 2 de octubre de 2026");
    expect(text).toContain("Versión de la Biblia: RV1909");
  });

  it("incluye las notas", () => {
    expect(text).toContain("Mi nota: Mi primer guardado");
  });

  it("no inventa texto si el versículo no está en el corpus", () => {
    expect(text).toContain("Juan 3:2 (RV1909)\n(El texto de este versículo no está disponible en esta versión.)");
  });

  it("los libros van en orden, en mayúsculas", () => {
    expect(text.indexOf("GÉNESIS")).toBeLessThan(text.indexOf("SALMOS"));
    expect(text.indexOf("SALMOS")).toBeLessThan(text.indexOf("JUAN"));
  });
});

describe("buildExportHtml", () => {
  it("escapa lo que escribió la persona", () => {
    const doc = buildExportDocument({
      bookmarks: [bookmark({ note: '<img src=x onerror="alert(1)">' })],
      highlights: [],
      generatedAt: NOW,
    });
    const html = buildExportHtml(doc);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("toma colores, fuentes y tamaños de los tokens", () => {
    const html = buildExportHtml(sample());
    expect(html).toContain(tokens.color.ink);
    expect(html).toContain(tokens.color.surface);
    expect(html).toContain(tokens.color.highlightAmber);
    expect(html).toContain("'EB Garamond', serif");
    expect(html).toContain("'DM Sans', sans-serif");
    expect(html).toContain(`${tokens.type.subtitle.size}px`);
  });

  it("no mete hex que no esté en la paleta", () => {
    const html = buildExportHtml(sample());
    const palette = new Set<string>(Object.values(tokens.color));
    const hexes = html.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
    expect(hexes.length).toBeGreaterThan(0);
    for (const hex of hexes) expect(palette.has(hex)).toBe(true);
  });

  it("trae las mismas referencias que el texto", () => {
    const html = buildExportHtml(sample());
    for (const reference of ["Génesis 1:1", "Salmos 46:1", "Juan 1:1", "Juan 3:2", "Juan 3:16"]) {
      expect(html).toContain(reference);
    }
    expect(html).toContain("RV1909");
  });
});

describe("helpers", () => {
  it("escapeHtml", () => {
    expect(escapeHtml(`a & b < c > "d" 'e'`)).toBe("a &amp; b &lt; c &gt; &quot;d&quot; &#39;e&#39;");
  });

  it("exportDate usa la hora de Honduras", () => {
    // 3 de octubre 03:00 UTC = 2 de octubre 21:00 en Honduras.
    expect(exportDate(Date.UTC(2026, 9, 3, 3, 0, 0))).toBe("2 de octubre de 2026");
  });

  it("exportSummary en singular y plural", () => {
    expect(exportSummary({ saved: 1, notes: 0, highlights: 2, prayers: 0 })).toBe("1 guardado · 2 subrayados");
  });
});
