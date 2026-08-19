import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium, useFonts as useDMSans } from "@expo-google-fonts/dm-sans";
import { EBGaramond_400Regular, useFonts as useEBGaramond } from "@expo-google-fonts/eb-garamond";
import { StatusBar } from "react-native";
import { Stack } from "expo-router";

export default function RootLayout() {
  const [dmSansLoaded] = useDMSans({ DMSans_300Light, DMSans_400Regular, DMSans_500Medium });
  const [ebGaramondLoaded] = useEBGaramond({ EBGaramond_400Regular });

  if (!dmSansLoaded || !ebGaramondLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Stack screenOptions={{ animation: "fade", headerShown: false }} />
    </>
  );
}
