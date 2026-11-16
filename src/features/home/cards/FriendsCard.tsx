import { HOME_ROUTES } from "../homeCards";
import { HomeCard, openFromHome } from "./HomeCard";

/**
 * Amigos (1.0.3): solo aparece con mensajes sin leer o solicitudes. Sin
 * notificaciones del servidor, es lo que avisa que alguien escribió.
 */
export function FriendsCard({ line }: { line: string }) {
  return (
    <HomeCard
      accessibilityHint="Abre Amigos."
      caption={line}
      icon="friends"
      onPress={() => openFromHome(HOME_ROUTES.friends)}
      testID="home-card-friends"
      title="Amigos"
    />
  );
}
