// Mock de `convex/react` para el harness de QA.
// Devuelve datos deterministas por nombre de función Convex, sin backend.
import { useEffect, useState } from "react";
import { getFunctionName } from "convex/server";

import { voiceCharacters } from "../../convex/voicesCatalog";
import {
  findTextStoryById,
  summarizeTextStory,
  TEXT_STORY_CATALOG,
} from "../../convex/textStoriesCatalog";
import STORY_CATALOG from "./story-catalog.json";
import { JOURNEY_READING_PLANS, SUPPORTED_READING_PLANS as ALL_PLANS } from "../../convex/readingPlanCatalog";
import { atLimit, isDark, isEmpty, isError, isLoading, isPro } from "./scenario";

const IMG = "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=80";
const PANEL = "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80";

const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

const db = {
  darkMode: isDark(),
  bibleVersion: (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ver")) || "RV1909",
  reminderHour: 6,
  // Preguntar: una conversación por tema (#191). `qa-seed` es la de ejemplo.
  qaThreads: isEmpty()
    ? {}
    : { "qa-seed": [
        { _id: "m1", role: "user", text: "¿Qué quiere decir que Dios es nuestro refugio?" },
        {
          _id: "m2",
          role: "assistant",
          text: "Refugio aquí es un lugar al que corrés cuando algo te persigue. El salmista no dice que no habrá tormenta: dice que hay dónde meterse mientras pasa.",
          citations: [
            {
              book: "Salmos",
              chapter: 46,
              verse: 1,
              version: "RV1909",
              text: "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.",
            },
          ],
        },
      ] },
  voiceThreads: {},
  // Lectura (#112–#115 y separador): fixtures para ver el módulo en el harness.
  separator: isEmpty() ? null : { book: "Salmos", chapter: 46, verse: 1, updatedAt: Date.now() },
  readingProgress: isEmpty() ? null : { book: "Juan", chapter: 3, updatedAt: Date.now() },
  // Guardados (#166) y notas (#167): cinco, para que Leer muestre 3 y "Ver todos (5)".
  bookmarks: isEmpty()
    ? []
    : [
        { book: "Salmos", chapter: 46, verse: 1, createdAt: Date.now() - 3600e3, note: "Lo predicó el pastor el domingo." },
        { book: "Juan", chapter: 3, verse: 16, createdAt: Date.now() - 26 * 3600e3 },
        { book: "Romanos", chapter: 8, verse: 28, createdAt: Date.now() - 3 * 24 * 3600e3 },
        { book: "Filipenses", chapter: 4, verse: 13, createdAt: Date.now() - 9 * 24 * 3600e3 },
        { book: "1 Pedro", chapter: 5, verse: 7, createdAt: Date.now() - 20 * 24 * 3600e3, note: "Me lo dijo mi mamá." },
      ],
  // Subrayados (#168): cuatro, en tres colores, para ver "Ver todos (4)" y el
  // filtro por color de la pantalla Subrayados.
  highlights: isEmpty()
    ? []
    : [
        { book: "Salmos", chapter: 46, verse: 1, color: "amber", updatedAt: Date.now() - 3600e3 },
        { book: "Juan", chapter: 3, verse: 16, color: "sage", updatedAt: Date.now() - 2 * 3600e3 },
        { book: "Romanos", chapter: 8, verse: 28, color: "amber", updatedAt: Date.now() - 3 * 24 * 3600e3 },
        { book: "Filipenses", chapter: 4, verse: 13, color: "clay", updatedAt: Date.now() - 9 * 24 * 3600e3 },
      ],
  history: isEmpty()
    ? []
    : [
        { id: "c1", module: "voices", characterId: "moises", createdAt: Date.now() - 3600e3, title: "Moisés", initial: "M", preview: "Yo tampoco me sentía capaz cuando me mandaron." },
        { id: "c2", module: "qa", characterId: undefined, createdAt: Date.now() - 26 * 3600e3, title: "Pregunta al texto", initial: "P", preview: "Refugio aquí es un lugar al que corrés…" },
        { id: "c3", module: "feelings", characterId: undefined, createdAt: Date.now() - 5 * 24 * 3600e3, title: "Sentimiento", initial: "S", preview: "Una oración corta para el cansancio." },
      ],
};

const FEELING_DEVOTIONAL = {
  title: "Para el cansancio",
  reflection:
    "Cansarse no es fallarle a Dios. Elías se durmió debajo de un enebro y lo primero que recibió no fue un sermón, fue comida y descanso. Hoy no tenés que resolver todo: tenés que descansar.",
  prayer: "Señor, estoy cansado. No te pido que me quites todo de encima hoy, te pido fuerzas para lo de hoy. Amén.",
  citation: {
    book: "Mateo",
    chapter: 11,
    verse: 28,
    version: "RV1909",
    text: "Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.",
  },
};

const DEVOTIONAL = {
  date: "2026-08-25",
  catalogId: "qa-1",
  verseRef: "Salmos 46:1",
  reflection:
    "Hay días en que lo único que se sostiene es que Dios está. No que todo salga bien: que Él está. Ese versículo no promete que la tierra no tiemble — promete que hay dónde ampararse cuando tiembla.",
  // Devocional por secciones (PR aparte): `/hoy` las muestra solo si vienen.
  // Con `?qa=empty` no vienen, para ver la pantalla como antes de ese cambio.
  ...(isEmpty()
    ? {}
    : {
        openingPrayer: "Señor, antes de empezar el día, quiero quedarme un momento con vos.",
        intro:
          "El salmo 46 se cantaba en tiempos de guerra y de terremotos. No nace de una vida tranquila, sino de gente que vio temblar todo lo que tenía.",
        closingPrayer: "Gracias porque sos mi amparo hoy, pase lo que pase. Ayudame a correr hacia vos y no lejos. Amén.",
      }),
  imageUrl: IMG,
  imageAlt: "Amanecer cálido entre montañas",
  imageAttributionUrl: "https://unsplash.com/photos/1500534623283-312aade485b7",
};

const SAVED_TEXT = {
  "Salmos 46:1": "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.",
  "Juan 3:16": "Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.",
  "Romanos 8:28": "Y sabemos que á los que á Dios aman, todas las cosas les ayudan á bien, es á saber, á los que conforme al propósito son llamados.",
  "Filipenses 4:13": "Todo lo puedo en Cristo que me fortalece.",
  "1 Pedro 5:7": "Echando toda vuestra solicitud en él, porque él tiene cuidado de vosotros.",
};

function findBookmark(args) {
  return db.bookmarks.findIndex((b) => b.book === args.book && b.chapter === args.chapter && b.verse === args.verse);
}

const VERSES = [
  { verse: 1, text: "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones." },
  { verse: 2, text: "Por tanto, no temeremos, aunque la tierra sea removida, y se traspasen los montes al corazón del mar;" },
  { verse: 3, text: "Aunque bramen y se turben sus aguas, y tiemblen los montes a causa de su braveza." },
  { verse: 4, text: "Del río sus corrientes alegran la ciudad de Dios, el santuario de las moradas del Altísimo." },
];

function quota(module) {
  const limits = { qa: 5, voices: 5, feelings: 3, stories: 1 };
  const limit = limits[module] ?? 5;
  if (isPro()) return { used: 0, limit, remaining: limit, isPro: true };
  if (atLimit()) return { used: limit, limit, remaining: 0, isPro: false };
  return { used: 1, limit, remaining: limit - 1, isPro: false };
}

const handlers = {
  "users:current": () => ({
    _id: "u1",
    clerkId: "user_qa",
    referralCode: "HN4QA7",
    // Cuenta de hace 3 días: Ajustes muestra "¿Te invitó alguien?".
    _creationTime: Date.now() - 3 * 24 * 3600e3,
    referredBy: db.referredBy,
    bibleVersion: db.bibleVersion,
    darkMode: db.darkMode,
    reminderHour: db.reminderHour,
  }),
  // Invitaciones: BAH-QA00001 existe; el resto no.
  "referrals:claim": (args) => {
    if (db.referredBy) return { status: "already" };
    const code = String(args.code).trim().toUpperCase();
    if (!/^BAH-?[0-9A-Z]{7}$/.test(code)) return { status: "invalid" };
    if (code.replace("BAH", "BAH-").replace("--", "-") !== "BAH-QA00001") return { status: "not_found" };
    db.referredBy = "BAH-QA00001";
    notify();
    return { status: "ok" };
  },
  "users:updatePreferences": (args) => {
    if (args.darkMode !== undefined) db.darkMode = args.darkMode;
    if (args.bibleVersion) db.bibleVersion = args.bibleVersion;
    if (args.reminderHour !== undefined) db.reminderHour = args.reminderHour;
    notify();
    return null;
  },
  "devotional:today": () => DEVOTIONAL,
  "devotional:byDate": (args) => ({ ...DEVOTIONAL, date: args.date }),
  // Solo RV1909 tiene corpus ingerido (convex/bibleVersions.ts); con NVI el backend real devuelve
  // verse: null y [] — el harness reproduce ese comportamiento.
  "rag/verses:citedForUser": () => ({
    version: db.bibleVersion,
    verse: db.bibleVersion === "RV1909" ? { book: "Salmos", chapter: 46, verse: 1, text: VERSES[0].text } : null,
  }),
  "rag/verses:listByChapter": (args) =>
    isEmpty() || args.version !== "RV1909"
      ? []
      : VERSES.map((v) => ({ ...v, book: args.book, chapter: args.chapter, version: args.version })),
  "reading:progress": () => db.readingProgress,
  "reading:recents": () => (isEmpty() ? [] : [{ book: "Juan", chapter: 3, openedAt: Date.now() }]),
  "reading:bookmarks": (args) => {
    const sorted = [...db.bookmarks].sort((a, b) => b.createdAt - a.createdAt);
    const items = sorted.slice(0, args?.limit ?? sorted.length).map((b) => ({
      ...b,
      version: db.bibleVersion,
      text: db.bibleVersion === "RV1909" ? SAVED_TEXT[`${b.book} ${b.chapter}:${b.verse}`] ?? null : null,
      note: b.note ?? null,
    }));
    return { total: sorted.length, items };
  },
  "reading:chapterBookmarks": (args) =>
    db.bookmarks
      .filter((b) => b.book === args.book && b.chapter === args.chapter)
      .map((b) => ({ verse: b.verse, note: b.note ?? null })),
  "reading:highlights": () => [...db.highlights].sort((a, b) => b.updatedAt - a.updatedAt),
  "reading:highlightsForChapter": (args) =>
    db.highlights
      .filter((h) => h.book === args.book && h.chapter === args.chapter)
      .map((h) => ({ verse: h.verse, color: h.color })),
  "reading:highlightsWithText": (args) => {
    const sorted = [...db.highlights].sort((a, b) => b.updatedAt - a.updatedAt);
    const items = sorted.slice(0, args?.limit ?? sorted.length).map((h) => ({
      ...h,
      version: db.bibleVersion,
      text: db.bibleVersion === "RV1909" ? SAVED_TEXT[`${h.book} ${h.chapter}:${h.verse}`] ?? null : null,
    }));
    return { total: sorted.length, items };
  },
  "reading:setHighlight": (args) => {
    const index = db.highlights.findIndex((h) => h.book === args.book && h.chapter === args.chapter && h.verse === args.verse);
    if (index >= 0) db.highlights[index] = { ...db.highlights[index], color: args.color, updatedAt: Date.now() };
    else db.highlights.push({ ...args, updatedAt: Date.now() });
    notify();
    return "h1";
  },
  "reading:clearHighlight": (args) => {
    db.highlights = db.highlights.filter((h) => !(h.book === args.book && h.chapter === args.chapter && h.verse === args.verse));
    notify();
    return null;
  },
  // Diagnóstico: en el harness no se manda nada.
  "telemetry:track": () => null,
  "telemetry:reportError": () => null,
  "reading:separator": () => db.separator,
  "reading:setSeparator": (args) => {
    db.separator = { ...args, updatedAt: Date.now() };
    notify();
    return "sep1";
  },
  "reading:clearSeparator": () => {
    db.separator = null;
    notify();
    return null;
  },
  "reading:saveProgress": () => null,
  "reading:recordRecent": () => null,
  "reading:toggleBookmark": (args) => {
    const index = findBookmark(args);
    if (index >= 0) db.bookmarks.splice(index, 1);
    else db.bookmarks.push({ ...args, createdAt: Date.now() });
    notify();
    return { saved: index < 0 };
  },
  "reading:removeBookmark": (args) => {
    const index = findBookmark(args);
    if (index >= 0) db.bookmarks.splice(index, 1);
    notify();
    return { removed: index >= 0 };
  },
  "reading:setBookmarkNote": (args) => {
    const note = args.note.trim();
    const index = findBookmark(args);
    if (index >= 0) db.bookmarks[index] = { ...db.bookmarks[index], note: note || undefined };
    else if (note) db.bookmarks.push({ book: args.book, chapter: args.chapter, verse: args.verse, createdAt: Date.now(), note });
    notify();
    return { saved: index >= 0 || Boolean(note), note: note || null };
  },
  "readingPlans:catalog": (args) => {
    const plan = ALL_PLANS.find((p) => p.id === (args.planId ?? "canonico"));
    return plan ? { id: plan.id, name: plan.name, description: plan.description, totalDays: plan.totalDays } : null;
  },
  "readingPlans:journeys": () => JOURNEY_READING_PLANS.map((p) => ({ id: p.id, name: p.name, description: p.description, totalDays: p.totalDays })),
  "readingPlans:myProgress": () => null,
  "readingPlans:myPlans": () => [],
  "voices:list": () => voiceCharacters,
  "voices:thread": (args) => db.voiceThreads[args.slug] ?? [],
  "voices:sendMessage": (args) => {
    if (atLimit()) return { status: "limit_reached" };
    const character = voiceCharacters.find((c) => c.slug === args.slug);
    const thread = db.voiceThreads[args.slug] ?? [{ _id: `${args.slug}-0`, role: "assistant", text: character?.first ?? "" }];
    db.voiceThreads[args.slug] = [
      ...thread,
      { _id: `${args.slug}-${thread.length}`, role: "user", text: args.text },
      {
        _id: `${args.slug}-${thread.length + 1}`,
        role: "assistant",
        text: "Yo también dudé de mí. Cuando me mandaron, lo primero que dije fue que no sabía hablar. No cambió mi lengua: cambió con quién iba.",
      },
    ];
    notify();
    return { status: "ok" };
  },
  "qa:thread": (args) => {
    if (args?.conversationId) return db.qaThreads[args.conversationId] ?? [];
    const ids = Object.keys(db.qaThreads);
    return ids.length ? db.qaThreads[ids[ids.length - 1]] : [];
  },
  "qa:conversations": () =>
    Object.entries(db.qaThreads)
      .reverse()
      .map(([id, messages]) => ({
        _id: id,
        title: messages[0]?.text.slice(0, 40) ?? "",
        passage: null,
        updatedAt: Date.now(),
        lastQuestion: [...messages].reverse().find((m) => m.role === "user")?.text ?? null,
      })),
  "qa:ask": (args) => {
    if (atLimit()) return { status: "limit_reached", conversationId: args.conversationId ?? null };
    const conversationId = args.conversationId ?? `qa-${Object.keys(db.qaThreads).length + 1}`;
    const thread = db.qaThreads[conversationId] ?? [];
    db.qaThreads = {
      ...db.qaThreads,
      [conversationId]: [
        ...thread,
        { _id: `${conversationId}-${thread.length}`, role: "user", text: args.question },
        {
          _id: `${conversationId}-${thread.length + 1}`,
          role: "assistant",
          text: "El texto no promete ausencia de tormenta, promete presencia. Mirá el versículo:",
          citations: [{ book: "Salmos", chapter: 46, verse: 1, version: db.bibleVersion, text: VERSES[0].text }],
        },
      ],
    };
    notify();
    return { status: "ok", conversationId };
  },
  "quotas:remaining": (args) => quota(args.module),
  "entitlements:mine": () => ({ isPro: isPro(), expiresAt: isPro() ? Date.now() + 30 * 24 * 3600e3 : null }),
  "history:list": () => db.history,
  "history:getById": () => ({
    module: "feelings",
    messages: [
      { role: "user", text: "Cansancio" },
      { role: "assistant", text: FEELING_DEVOTIONAL.reflection, devotional: FEELING_DEVOTIONAL },
    ],
  }),
  "history:deleteAll": () => {
    db.history = [];
    notify();
    return null;
  },
  "feelings:generate": () => (atLimit() ? { allowed: false, reason: "limit_reached", module: "feelings" } : { allowed: true, conversationId: "c9", devotional: FEELING_DEVOTIONAL }),
  // Historias en texto (#145): catálogo real del repo, misma proyección que
  // `textStories:list` en Convex — la lista no carga el cuerpo de las páginas.
  "textStories:list": () => TEXT_STORY_CATALOG.map(summarizeTextStory),
  "textStories:getById": (args) => findTextStoryById(args.storyId),
  "stories:list": () => STORY_CATALOG,
  "stories:getById": (args) => STORY_CATALOG.find((s) => s.id === args.storyId) ?? null,
  "stories:create": (args) => (atLimit() ? { allowed: false, reason: "limit_reached", module: "stories" } : { allowed: true, storyId: args.storyId }),
  "stories:latestForViewer": (args) => {
    const story = STORY_CATALOG.find((s) => s.id === args.storyId);
    if (!story) return null;
    return {
      scenes: story.scenes.map((scene, index) => ({
        id: scene.id,
        status: index === 0 || index === 3 ? "ready" : index === 1 ? "generating" : "failed",
        uri: index === 0 || index === 3 ? PANEL : null,
      })),
    };
  },
};

function nameOf(ref) {
  try {
    return getFunctionName(ref);
  } catch {
    return String(ref);
  }
}

function run(ref, args) {
  const name = nameOf(ref);
  const handler = handlers[name];
  if (!handler) {
    // eslint-disable-next-line no-console
    console.warn("[qa-harness] sin fixture para", name);
    return null;
  }
  return handler(args ?? {});
}

export class ConvexReactClient {
  constructor(url) {
    this.url = url;
  }
  query(ref, args) {
    return isError() ? Promise.reject(new Error("qa-harness: error simulado")) : Promise.resolve(run(ref, args));
  }
  mutation(ref, args) {
    return Promise.resolve(run(ref, args));
  }
  action(ref, args) {
    return Promise.resolve(run(ref, args));
  }
  setAuth() {}
  clearAuth() {}
  close() {}
}

export function ConvexProvider({ children }) {
  return children;
}

// Una sola instancia: el cliente real es estable entre renders, y una nueva
// en cada render disparaba un loop en los efectos que dependen de él (home).
const qaClient = new ConvexReactClient("qa");
export function useConvex() {
  return qaClient;
}

export function useConvexAuth() {
  return { isAuthenticated: true, isLoading: false };
}

function useTick() {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
}

export function useQuery(ref, args) {
  useTick();
  if (args === "skip") return undefined;
  if (isLoading()) return undefined;
  return run(ref, args);
}

// El buscador de pasajes (#112) pagina resultados; en el harness la búsqueda
// no tiene corpus, así que siempre devuelve una página vacía y agotada.
export function usePaginatedQuery(ref, args) {
  useTick();
  if (args === "skip") return { results: [], status: "LoadingFirstPage", isLoading: true, loadMore() {} };
  return { results: [], status: "Exhausted", isLoading: false, loadMore() {} };
}

export function useMutation(ref) {
  return (args) => Promise.resolve(run(ref, args));
}

export function useAction(ref) {
  return (args) => new Promise((resolve) => setTimeout(() => resolve(run(ref, args)), 400));
}
