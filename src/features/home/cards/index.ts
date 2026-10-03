import type { ComponentType } from "react";

import { HOME_CARD_ORDER, type HomeCardId } from "../homeCards";
import { AskCard } from "./AskCard";
import { CharactersCard } from "./CharactersCard";
import { FeelingCard } from "./FeelingCard";
import { PersonalDateCard } from "./PersonalDateCard";
import { ReadCard } from "./ReadCard";
import { SeasonStrip } from "./SeasonStrip";
import { StoriesCard } from "./StoriesCard";
import { VerseCard } from "./VerseCard";

/** Lo que una tarjeta puede mirar para decidir si se muestra. */
export type HomeCardContext = {
  dateKey: string;
  /** Temporada activa (#199), o null fuera de temporada. */
  season: { slug: string } | null;
};

export type HomeCardEntry = {
  id: HomeCardId;
  Component: ComponentType;
  visible?: (context: HomeCardContext) => boolean;
};

const COMPONENTS: Record<HomeCardId, Omit<HomeCardEntry, "id">> = {
  dates: { Component: PersonalDateCard },
  season: { Component: SeasonStrip, visible: ({ season }) => season !== null },
  verse: { Component: VerseCard },
  read: { Component: ReadCard },
  feeling: { Component: FeelingCard },
  ask: { Component: AskCard },
  characters: { Component: CharactersCard },
  stories: { Component: StoriesCard },
};

/**
 * Registro de tarjetas del inicio (#193). Para sumar una (temporada,
 * personaje del mes, …): un archivo nuevo en esta carpeta, su id en
 * `HOME_CARD_ORDER` (homeCards.ts, con test del orden) y una línea acá.
 * `home.tsx` no cambia.
 */
export const HOME_CARDS: readonly HomeCardEntry[] = HOME_CARD_ORDER.map((id) => ({ id, ...COMPONENTS[id] }));

export function visibleHomeCards(context: HomeCardContext): readonly HomeCardEntry[] {
  return HOME_CARDS.filter((card) => card.visible?.(context) ?? true);
}
