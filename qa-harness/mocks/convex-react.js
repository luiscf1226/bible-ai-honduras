// Mock de `convex/react` para el harness de QA.
// Devuelve datos deterministas por nombre de función Convex, sin backend.
import { useEffect, useState } from "react";
import { getFunctionName } from "convex/server";

import { voiceCharacters } from "../../convex/voicesCatalog";
import STORY_CATALOG from "./story-catalog.json";
import { atLimit, isDark, isEmpty, isError, isLoading, isPro } from "./scenario";

const IMG = "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=80";
const PANEL = "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80";

const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

const db = {
  darkMode: isDark(),
  bibleVersion: (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ver")) || "RVR1960",
  reminderHour: 6,
  qaThread: isEmpty()
    ? []
    : [
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
              version: "RVR1960",
              text: "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.",
            },
          ],
        },
      ],
  voiceThreads: {},
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
    version: "RVR1960",
    text: "Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.",
  },
};

const DEVOTIONAL = {
  date: "2026-08-25",
  catalogId: "qa-1",
  verseRef: "Salmos 46:1",
  reflection:
    "Hay días en que lo único que se sostiene es que Dios está. No que todo salga bien: que Él está. Ese versículo no promete que la tierra no tiemble — promete que hay dónde ampararse cuando tiembla.",
  imageUrl: IMG,
  imageAlt: "Amanecer cálido entre montañas",
  imageAttributionUrl: "https://unsplash.com/photos/1500534623283-312aade485b7",
};

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
    bibleVersion: db.bibleVersion,
    darkMode: db.darkMode,
    reminderHour: db.reminderHour,
  }),
  "users:updatePreferences": (args) => {
    if (args.darkMode !== undefined) db.darkMode = args.darkMode;
    if (args.bibleVersion) db.bibleVersion = args.bibleVersion;
    if (args.reminderHour !== undefined) db.reminderHour = args.reminderHour;
    notify();
    return null;
  },
  "devotional:today": () => DEVOTIONAL,
  "devotional:byDate": (args) => ({ ...DEVOTIONAL, date: args.date }),
  // Solo RVR1960 tiene corpus ingerido; con NVI el backend real devuelve
  // verse: null y [] — el harness reproduce ese comportamiento.
  "rag/verses:citedForUser": () => ({
    version: db.bibleVersion,
    verse: db.bibleVersion === "RVR1960" ? { book: "Salmos", chapter: 46, verse: 1, text: VERSES[0].text } : null,
  }),
  "rag/verses:listByChapter": (args) => (isEmpty() || args.version !== "RVR1960" ? [] : VERSES),
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
  "qa:thread": () => db.qaThread,
  "qa:ask": (args) => {
    if (atLimit()) return { status: "limit_reached" };
    db.qaThread = [
      ...db.qaThread,
      { _id: `q${db.qaThread.length}`, role: "user", text: args.question },
      {
        _id: `q${db.qaThread.length + 1}`,
        role: "assistant",
        text: "El texto no promete ausencia de tormenta, promete presencia. Mirá el versículo:",
        citations: [{ book: "Salmos", chapter: 46, verse: 1, version: db.bibleVersion, text: VERSES[0].text }],
      },
    ];
    notify();
    return { status: "ok" };
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

export function useConvex() {
  return new ConvexReactClient("qa");
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

export function useMutation(ref) {
  return (args) => Promise.resolve(run(ref, args));
}

export function useAction(ref) {
  return (args) => new Promise((resolve) => setTimeout(() => resolve(run(ref, args)), 400));
}
