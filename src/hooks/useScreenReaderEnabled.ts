import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * VoiceOver (iOS) / TalkBack (Android) encendido. Arranca en `false`: lo que
 * depende de esto (que un reel no avance solo) se corrige apenas llega la
 * respuesta, antes de que termine la primera parte.
 */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (value) => {
        if (isCurrent) setEnabled(value);
      },
      () => undefined,
    );
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      isCurrent = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
