import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium, useFonts as useDMSans } from "@expo-google-fonts/dm-sans";
import { EBGaramond_400Regular, useFonts as useEBGaramond } from "@expo-google-fonts/eb-garamond";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { StatusBar } from "react-native";
import { Stack } from "expo-router";

import { clerkTokenCache } from "../src/lib/clerkTokenCache";
import { convexClient } from "../src/lib/convexClient";
import { useSyncConvexUser } from "../src/hooks/useSyncConvexUser";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";

if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    "Falta EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Copiá .env.example a .env.local con las claves del dashboard de Clerk."
  );
}
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string;

function AppNavigator() {
  useSyncConvexUser();
  const { dark } = useTheme();
  return (
    <>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <Stack screenOptions={{ animation: "fade", headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  const [dmSansLoaded] = useDMSans({ DMSans_300Light, DMSans_400Regular, DMSans_500Medium });
  const [ebGaramondLoaded] = useEBGaramond({ EBGaramond_400Regular });

  if (!dmSansLoaded || !ebGaramondLoaded) {
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
