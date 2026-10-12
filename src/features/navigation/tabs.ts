import type { IconName } from "../../components/Icon";

/**
 * Barra de pestañas (#232, Fase 1). Lógica pura: qué pestañas hay, qué rutas
 * de `app/(tabs)/` pinta cada una y a dónde va al tocarla. El dibujo está en
 * `src/components/TabBar.tsx`; el layout, en `app/(tabs)/_layout.tsx`.
 *
 * Todo lo que no es de primer nivel (lector, chat con un personaje, una
 * historia, Ajustes, …) vive afuera de `(tabs)` y se apila encima, sin barra.
 */

/** Las tres formas de conversar que comparten pestaña, con un selector arriba. */
export const CONVERSATION_ROUTES = ["preguntar", "sentir", "voces"] as const;
export type ConversationRoute = (typeof CONVERSATION_ROUTES)[number];

export type TabId = "inicio" | "biblia" | "conversar" | "historias" | "mi-espacio";

export type TabSpec = {
  id: TabId;
  label: string;
  icon: IconName;
  /** Nombres de ruta de `(tabs)` que encienden esta pestaña. */
  routes: readonly string[];
  /** Ruta a la que va al tocarla (Conversar recuerda la última). */
  href: string;
};

export const TABS: readonly TabSpec[] = [
  { id: "inicio", label: "Inicio", icon: "home", routes: ["home"], href: "/home" },
  { id: "biblia", label: "Biblia", icon: "book", routes: ["leer/index"], href: "/leer" },
  { id: "conversar", label: "Conversar", icon: "chat", routes: CONVERSATION_ROUTES, href: "/preguntar" },
  { id: "historias", label: "Historias", icon: "image", routes: ["historias"], href: "/historias" },
  { id: "mi-espacio", label: "Mi espacio", icon: "person", routes: ["mi-espacio"], href: "/mi-espacio" },
];

/** La pestaña encendida para una ruta de `(tabs)`; si no es de ninguna, Inicio. */
export function tabForRoute(routeName: string): TabId {
  return TABS.find((tab) => tab.routes.includes(routeName))?.id ?? "inicio";
}

export function isConversationRoute(routeName: string): routeName is ConversationRoute {
  return (CONVERSATION_ROUTES as readonly string[]).includes(routeName);
}

/** A dónde va una pestaña: Conversar vuelve a la última de las tres que se usó. */
export function tabHref(tab: TabSpec, lastConversation: ConversationRoute | null): string {
  if (tab.id === "conversar" && lastConversation) return `/${lastConversation}`;
  return tab.href;
}

/** Selector de arriba de Conversar. "Personajes" es Voces (así se llama en el inicio). */
export const CONVERSATION_OPTIONS: ReadonlyArray<{ id: ConversationRoute; label: string }> = [
  { id: "preguntar", label: "Preguntar" },
  { id: "sentir", label: "Sentir" },
  { id: "voces", label: "Personajes" },
];
