import { FEED_CARD_CAPTION, FEED_CARD_TITLE, HOME_ROUTES } from "../homeCards";
import { HomeCard, openFromHome } from "./HomeCard";

/**
 * Tarjeta del feed de versículos (design/oleada-ux.md §Feed de versículos):
 * una sola línea, sin contenido propio, para que el inicio siga entrando en
 * una pantalla. Abre `/versiculos` a pantalla completa.
 */
export function FeedCard() {
  return (
    <HomeCard
      accessibilityHint="Abre un feed de versículos a pantalla completa para deslizar."
      caption={FEED_CARD_CAPTION}
      icon="heart"
      onPress={() => openFromHome(HOME_ROUTES.feed)}
      testID="home-card-feed"
      title={FEED_CARD_TITLE}
    />
  );
}
