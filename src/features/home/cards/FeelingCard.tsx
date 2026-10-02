import { StyleSheet, View } from "react-native";

import { tokens } from "../../../theme/tokens";
import { FEELING_SHORTCUTS, FEELING_WRITE_ROUTE, feelingRoute, HOME_ROUTES } from "../homeCards";
import { HomeCard, HomeChip, openFromHome } from "./HomeCard";

/**
 * Tarjeta 3, ¿Cómo estás hoy? (U1), compacta: tres sentimientos y un chip
 * punteado para escribirlo con tus palabras. Nada más.
 */
export function FeelingCard() {
  return (
    <HomeCard
      accessibilityHint="Abre Sentir para preparar un devocional para cómo estás."
      icon="sunrise"
      onPress={() => openFromHome(HOME_ROUTES.feeling)}
      testID="home-card-feeling"
      title="¿Cómo estás hoy?"
    >
      <View style={styles.chips}>
        {FEELING_SHORTCUTS.map((feeling) => (
          <HomeChip
            accessibilityHint={`Prepara un devocional para ${feeling.toLowerCase()}.`}
            key={feeling}
            label={feeling}
            onPress={() => openFromHome(feelingRoute(feeling))}
            testID={`home-feeling-${feeling}`}
          />
        ))}
        <HomeChip
          accessibilityHint="Abre Sentir para escribir cómo te sentís."
          dashed
          label="Escribilo con tus palabras…"
          onPress={() => openFromHome(FEELING_WRITE_ROUTE)}
          testID="home-feeling-write"
        />
      </View>
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
});
