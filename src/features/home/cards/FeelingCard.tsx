import { StyleSheet, View } from "react-native";

import { tokens } from "../../../theme/tokens";
import { FEELING_SHORTCUTS, FEELING_WRITE_ROUTE, feelingRoute, HOME_ROUTES } from "../homeCards";
import { HomeCard, HomeChip, openFromHome } from "./HomeCard";

/**
 * Tarjeta ¿Cómo estás hoy? (U1b), compacta: tres sentimientos que se reparten
 * el ancho y un chip punteado de solo lápiz para escribirlo con tus palabras,
 * todo en una fila.
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
            fill
            key={feeling}
            label={feeling}
            onPress={() => openFromHome(feelingRoute(feeling))}
            testID={`home-feeling-${feeling}`}
          />
        ))}
        <HomeChip
          accessibilityHint="Abre Sentir para escribir cómo te sentís."
          accessibilityLabel="Escribilo con tus palabras"
          dashed
          icon="note"
          onPress={() => openFromHome(FEELING_WRITE_ROUTE)}
          testID="home-feeling-write"
        />
      </View>
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", gap: tokens.space.xs },
});
