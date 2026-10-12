import { StyleSheet, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";

import { tokens } from "./tokens";

const styles = StyleSheet.create({ pressed: { opacity: tokens.opacity.pressed } });

/** El estado presionado de toda la app (`opacity.pressed`). */
export const pressedOpacity = styles.pressed;

/**
 * `style` de un `Pressable` con el estado presionado ya puesto (#232). Antes
 * cada archivo tenía su `pressed: { opacity }`:
 *
 *   <Pressable style={withPressed(styles.row, { borderColor })} />
 */
export function withPressed(...base: StyleProp<ViewStyle>[]) {
  return ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [...base, pressed && styles.pressed];
}
