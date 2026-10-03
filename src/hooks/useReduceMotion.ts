import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * "Reducir movimiento" del sistema (iOS) / "Quitar animaciones" (Android).
 * Arranca en `true` hasta saber la respuesta: ante la duda, nada se mueve.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (isCurrent) setReduceMotion(enabled);
      },
      () => {
        if (isCurrent) setReduceMotion(false);
      },
    );
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      isCurrent = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
