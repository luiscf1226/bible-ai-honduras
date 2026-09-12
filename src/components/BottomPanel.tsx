import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type BottomPanelProps = PropsWithChildren<{
  /** Fila fija de arriba: resumen, contador de cuota. Nunca scrollea. */
  header?: ReactNode;
  /** Fila fija de abajo: campo libre, error, CTA. Nunca scrollea. */
  footer?: ReactNode;
  /**
   * Estilo del área scrolleable. Sirve para acotarla con `maxHeight` (y así
   * garantizar que el footer entra en pantalla) — siempre con un token.
   */
  bodyStyle?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/**
 * Panel anclado al borde inferior de la pantalla (issue #109).
 *
 * Nace compartido porque lo van a reusar el buscador de pasajes (#112) y el
 * selector de plan de lectura (#114): el patrón es siempre el mismo —una lista
 * larga que scrollea, con un resumen arriba y un CTA abajo que no se puede
 * perder de vista.
 *
 * Reparto de alturas: `header` y `footer` no se encogen nunca; el `children`
 * (el cuerpo scrolleable) sí. Por eso el panel entero lleva `flexShrink: 1` y
 * el cuerpo también: cuando entra el teclado y el contenedor se achica, lo que
 * cede es la lista, no el CTA.
 *
 * **Safe area:** el panel NO vuelve a sumar `insets.bottom`. Cuenta con que su
 * ancestro ya reservó el borde inferior —`AppScreen` monta un `SafeAreaView`
 * sin `edges`, o sea las cuatro—; sumarlo acá otra vez dejaría el CTA flotando
 * el doble de alto que la barra de gestos. Si algún día se usa fuera de un
 * `SafeAreaView`, hay que reservarlo en el contenedor, no acá.
 *
 * **Contrato visual:** cero valores nuevos. Fondo, borde superior, paddings y
 * tipografía salen de `design/tokens.json` vía `src/theme/tokens.ts`; el
 * tratamiento (borde de 1px arriba + `surface`) es el mismo del composer de
 * chat que sí está en el prototipo.
 */
export function BottomPanel({ bodyStyle, children, footer, header, testID }: BottomPanelProps) {
  const { color } = useTheme();

  return (
    <View
      style={[styles.panel, { backgroundColor: color.surface, borderTopColor: color.border }]}
      testID={testID}
    >
      {header ? <View style={styles.header}>{header}</View> : null}

      <ScrollView
        contentContainerStyle={styles.body}
        // Con el teclado abierto, el primer tap sobre un chip solo lo cerraría
        // en vez de seleccionarlo.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[styles.bodyScroll, bodyStyle]}
      >
        {children}
      </ScrollView>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: 1,
    // Cede alto antes que el resto de la pantalla cuando entra el teclado.
    flexShrink: 1,
    gap: tokens.space.md,
    paddingHorizontal: tokens.screenPadding.horizontal,
    paddingVertical: tokens.space.lg,
  },
  header: { flexShrink: 0, gap: tokens.space.xs },
  // `flexGrow: 0` para que la lista no estire el panel más allá de su contenido
  // en una pantalla grande; `flexShrink: 1` para que sea ella la que cede.
  bodyScroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: tokens.space.md },
  footer: { flexShrink: 0, gap: tokens.space.md },
});
