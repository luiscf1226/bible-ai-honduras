import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type SideDrawerProps = PropsWithChildren<{
  /** Overline de arriba del panel ("LOS DE ANTES"). */
  title: string;
  visible: boolean;
  onClose: () => void;
  testID?: string;
}>;

// El panel deja ver una franja de la pantalla de atrás: así se lee que es un
// cajón encima de la pantalla y que tocar afuera lo cierra.
const DRAWER_WIDTH_RATIO = 0.84;
const SLIDE_MS = 220;

/**
 * Cajón lateral que entra desde la izquierda. Nace para el historial de Sentir
 * ("Los de antes"): pedido de la beta — el historial arriba de la pantalla
 * empujaba los sentimientos hacia abajo; en un cajón a la izquierda queda a
 * mano sin ocupar lugar.
 *
 * **Contrato visual:** cero valores nuevos. Fondo `surface`, borde `border`,
 * overline y paddings de tokens — es el mismo tratamiento del `BottomPanel`,
 * girado al costado. El velo de atrás reusa `ink` (sin color nuevo) con una
 * opacidad derivada de `tokens.opacity.pressed`.
 */
export function SideDrawer({ children, onClose, testID, title, visible }: SideDrawerProps) {
  const { color } = useTheme();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.round(width * DRAWER_WIDTH_RATIO);
  const offset = useRef(new Animated.Value(-drawerWidth)).current;
  // El Modal se queda montado hasta que termina la animación de salida.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      offset.setValue(-drawerWidth);
      Animated.timing(offset, { duration: SLIDE_MS, toValue: 0, useNativeDriver: true }).start();
      return;
    }
    // Solo se desmonta si la salida terminó. Si la interrumpe una apertura (p.
    // ej. `?historial=1`, que abre el cajón apenas monta la pantalla), el
    // callback llega con `finished: false` y desmontar ahí cerraba el cajón.
    Animated.timing(offset, { duration: SLIDE_MS, toValue: -drawerWidth, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setMounted(false);
      },
    );
  }, [drawerWidth, offset, visible]);

  if (!mounted) {
    return null;
  }

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible>
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: color.surface,
              borderRightColor: color.border,
              transform: [{ translateX: offset }],
              width: drawerWidth,
            },
          ]}
          testID={testID}
        >
          <SafeAreaView edges={["top", "bottom", "left"]} style={styles.safe}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: color.inkSoft }]}>{title}</Text>
              <Pressable
                accessibilityLabel="Cerrar"
                accessibilityRole="button"
                hitSlop={tokens.space.md}
                onPress={onClose}
                style={[styles.close, { borderColor: color.border }]}
                testID={testID ? `${testID}-close` : undefined}
              >
                <Text style={[styles.closeLabel, { color: color.ink }]}>‹</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
        <Pressable
          accessibilityLabel="Cerrar el historial"
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.scrim, { backgroundColor: color.ink }]}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  panel: { borderRightWidth: 1, height: "100%", zIndex: 1 },
  safe: { flex: 1 },
  // Velo de `ink` al 30 %: tres veces el 10 % que se apaga un elemento presionado.
  scrim: { flex: 1, opacity: (1 - tokens.opacity.pressed) * 3 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.screenPadding.horizontal,
    paddingVertical: tokens.space.lg,
  },
  title: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  close: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  closeLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  body: { gap: tokens.space.sm, paddingBottom: tokens.space.xl, paddingHorizontal: tokens.screenPadding.horizontal },
});
