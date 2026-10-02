import { useQuery } from "convex/react";
import { router } from "expo-router";

import { api } from "../../../convex/_generated/api";
import { goToVoices } from "../../lib/goToVoices";
import { openPassage, openReadingPlan } from "../../lib/openPassage";
import { track } from "../../lib/telemetry";
import { useTheme } from "../../theme/ThemeProvider";
import { hondurasToday } from "../widget/verseWidget";
import { pickFeaturedCharacter, type FeaturedCharacter, type FeaturedShortcutId } from "./featuredCharacter";

/**
 * Personaje del mes (#200) con sus datos de Voces (nombre, degradado). Sale de
 * la temporada activa; sin temporada, de la rotación mensual. Mientras el
 * catálogo carga devuelve null.
 */
export function useFeaturedCharacter() {
  const { season } = useTheme();
  const characters = useQuery(api.voices.list);
  const featured = pickFeaturedCharacter(season, hondurasToday());
  const character = featured ? characters?.find((item) => item.slug === featured.slug) : undefined;
  return featured && character ? { ...featured, character } : null;
}

/**
 * A dónde lleva cada atajo de la tarjeta. "Conversar" entra al chat de Voces
 * de siempre: consume la misma cuota de Voces (regla dura #3) y el mismo
 * prompt; acá no hay nada aparte.
 */
export function openFeaturedShortcut(id: FeaturedShortcutId, featured: FeaturedCharacter) {
  track("featured_character_opened");
  const { content, slug } = featured;
  if (id === "historia" && content.storyId) {
    router.push({ pathname: "/historias/texto/[storyId]", params: { storyId: content.storyId } });
  } else if (id === "capitulos") {
    openPassage(content.chapter);
  } else if (id === "recorrido" && content.planId) {
    openReadingPlan(content.planId);
  } else {
    goToVoices(slug);
  }
}
