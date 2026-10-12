import { HOME_ROUTES } from "../homeCards";
import { HomeCard, openFromHome } from "./HomeCard";

/**
 * Domingo: acceso rápido a una nota de prédica nueva (#232, Parte 2). Es la
 * `HomeCard` base con el ícono del cuaderno; un solo destino, el editor vacío
 * con la fecha de hoy. Las notas viven en Mi espacio → Notas de prédica.
 */
export function SermonSundayCard() {
  return (
    <HomeCard
      accessibilityHint="Abre una nota de prédica nueva con la fecha de hoy."
      caption="¿Vas al culto? Anotá la prédica con sus pasajes y no la perdés."
      icon="sermon"
      onPress={() => openFromHome(HOME_ROUTES.newSermonNote)}
      testID="home-card-sermon"
      title="Nueva nota de prédica"
    />
  );
}
