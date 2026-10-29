import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium, useFonts as useDMSans } from "@expo-google-fonts/dm-sans";
import { EBGaramond_400Regular, useFonts as useEBGaramond } from "@expo-google-fonts/eb-garamond";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useEffect, useState, type PropsWithChildren } from "react";
import { StatusBar } from "react-native";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { FullScreenNotice } from "../src/components/FullScreenNotice";
import { StartupLoading } from "../src/components/StartupLoading";
import { FONTS_TIMEOUT_MS, fontsReady as areFontsReady } from "../src/features/auth/startupGate";
import { OfflineSyncProvider } from "../src/features/offline/OfflineSyncProvider";
import { useAppUpdate } from "../src/hooks/useAppUpdate";
import { useGroupInvite } from "../src/hooks/useGroupInvite";
import { clerkTokenCache } from "../src/lib/clerkTokenCache";
import { convexClient } from "../src/lib/convexClient";
import { configureDailyReminderNotifications } from "../src/lib/dailyReminder";
import { useReferralAttribution } from "../src/hooks/useReferralAttribution";
import { useRevenueCatLogin } from "../src/hooks/useRevenueCatLogin";
import { useSyncConvexUser } from "../src/hooks/useSyncConvexUser";
import { useVerseWidgetSync } from "../src/features/widget/useVerseWidgetSync";
import { installGlobalErrorReporting, reportError, track } from "../src/lib/telemetry";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";

installGlobalErrorReporting();
track("app_opened");
configureDailyReminderNotifications();
SplashScreen.preventAutoHideAsync().catch(() => undefined);

if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    "Falta EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Copiá .env.example a .env.local con las claves del dashboard de Clerk."
  );
}
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string;

function AppNavigator() {
  useSyncConvexUser();
  useRevenueCatLogin();
  useVerseWidgetSync();
  useReferralAttribution();
  useGroupInvite();
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

/**
 * Reemplaza a `<ClerkLoaded>`, que no pinta nada mientras Clerk carga: si Clerk
 * nunca terminaba, la app quedaba en blanco para siempre (rechazo 2.1(a) de la
 * 1.0.2). Acá se ve el logo y, pasado `CLERK_LOAD_RETRY_MS`, un "Reintentar"
 * que recarga la app.
 */
function ClerkStartupGate({ children }: PropsWithChildren) {
  const { isLoaded } = useAuth();
  if (isLoaded) {
    return children;
  }
  return <StartupLoading retry testID="startup-clerk" />;
}

export default function RootLayout() {
  const [dmSansLoaded, dmSansError] = useDMSans({ DMSans_300Light, DMSans_400Regular, DMSans_500Medium });
  const [ebGaramondLoaded, ebGaramondError] = useEBGaramond({ EBGaramond_400Regular });
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const fontsReady = areFontsReady({
    loaded: [dmSansLoaded, ebGaramondLoaded],
    errors: [dmSansError, ebGaramondError],
    timedOut: fontsTimedOut,
  });

  useEffect(() => {
    if (fontsReady) {
      return;
    }
    const timer = setTimeout(() => setFontsTimedOut(true), FONTS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsReady]);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    // Sin componentes nativos de Clerk (AuthView, UserButton) no hace falta
    // sincronizar el cliente nativo: es un camino nativo menos en el arranque.
    <ClerkProvider __experimental_disableNativeClientSync publishableKey={clerkPublishableKey} tokenCache={clerkTokenCache}>
      <ClerkStartupGate>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <ThemeProvider>
            {/* Cola sin conexión del lector (#182): necesita Convex y la sesión. */}
            <OfflineSyncProvider>
              <AppNavigator />
            </OfflineSyncProvider>
          </ThemeProvider>
        </ConvexProviderWithClerk>
      </ClerkStartupGate>
    </ClerkProvider>
  );
}
