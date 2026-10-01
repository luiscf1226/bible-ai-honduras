import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium, useFonts as useDMSans } from "@expo-google-fonts/dm-sans";
import { EBGaramond_400Regular, useFonts as useEBGaramond } from "@expo-google-fonts/eb-garamond";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useEffect } from "react";
import { StatusBar } from "react-native";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { FullScreenNotice } from "../src/components/FullScreenNotice";
import { useAppUpdate } from "../src/hooks/useAppUpdate";
import { clerkTokenCache } from "../src/lib/clerkTokenCache";
import { convexClient } from "../src/lib/convexClient";
import { configureDailyReminderNotifications } from "../src/lib/dailyReminder";
import { useRevenueCatLogin } from "../src/hooks/useRevenueCatLogin";
import { useSyncConvexUser } from "../src/hooks/useSyncConvexUser";
import { installGlobalErrorReporting, reportError, track } from "../src/lib/telemetry";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";

installGlobalErrorReporting();
track("app_opened");
configureDailyReminderNotifications();
SplashScreen.preventAutoHideAsync();

if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    "Falta EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Copiá .env.example a .env.local con las claves del dashboard de Clerk."
  );
}
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string;

function AppNavigator() {
  useSyncConvexUser();
  useRevenueCatLogin();
  const { dark } = useTheme();
  const appUpdate = useAppUpdate();

  useEffect(() => {
    if (appUpdate.updateRequired) track("update_required_shown");
  }, [appUpdate.updateRequired]);

  return (
    <>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      {/* Un build debajo de MIN_*_BUILD ya no funciona con el backend: en vez
          de fallar a medias pantalla por pantalla, se bloquea acá con un solo
          camino, que es actualizar. */}
      {appUpdate.updateRequired ? (
        <FullScreenNotice
          body={`Esta versión ya no funciona con lo nuevo de la app. Tus guardados, notas y planes siguen intactos: se actualiza en un minuto desde ${appUpdate.storeName ?? "la tienda"}.`}
          cta={`Abrir ${appUpdate.storeName ?? "la tienda"}`}
          mark="↻"
          onCta={() => void appUpdate.openStore()}
          testID="update-required"
          title="Actualizá la app para seguir"
        />
      ) : (
        <Stack screenOptions={{ animation: "fade", headerShown: false }} />
      )}
    </>
  );
}

/**
 * Último recurso si una pantalla revienta al renderizar: en vez de la pantalla
 * roja (dev) o una app en blanco (release), se reporta el error y se ofrece
 * reintentar. Vive fuera de los providers, así que usa el tema claro.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, true);
  }, [error]);

  return (
    <FullScreenNotice
      body="Algo se trabó en esta pantalla. Probá de nuevo; si sigue pasando, cerrá y abrí la app."
      cta="Intentar de nuevo"
      mark="!"
      onCta={() => void retry()}
      testID="error-boundary"
      title="Algo salió mal"
    />
  );
}

export default function RootLayout() {
  const [dmSansLoaded, dmSansError] = useDMSans({ DMSans_300Light, DMSans_400Regular, DMSans_500Medium });
  const [ebGaramondLoaded, ebGaramondError] = useEBGaramond({ EBGaramond_400Regular });
  const fontsReady = (dmSansLoaded || dmSansError != null) && (ebGaramondLoaded || ebGaramondError != null);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={clerkTokenCache}>
      <ClerkLoaded>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <ThemeProvider>
            <AppNavigator />
          </ThemeProvider>
        </ConvexProviderWithClerk>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
