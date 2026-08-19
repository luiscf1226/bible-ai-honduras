import { Image, StyleSheet, Text, View } from "react-native";

import { tokens } from "../theme/tokens";

type BrandProps = { size?: "large" | "medium" | "small"; withWordmark?: boolean };

export function Brand({ size = "small", withWordmark = false }: BrandProps) {
  const imageSize = size === "large"
    ? tokens.size.logoLarge
    : size === "medium"
      ? tokens.size.logoMedium
      : tokens.size.logoSmall;

  return (
    <View style={styles.container}>
      <Image
        accessibilityLabel="Logo de Bible AI"
        resizeMode="cover"
        source={require("../../design/logo.png")}
        style={{ borderRadius: tokens.radius.xl, height: imageSize, width: imageSize }}
      />
      {withWordmark ? (
        <View style={styles.wordmark}>
          <Text style={styles.bible}>Bible</Text>
          <Text style={styles.ai}>AI</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  wordmark: { flexDirection: "row", gap: tokens.space.sm, marginTop: tokens.space.xl },
  bible: { color: tokens.color.accentDeep, fontFamily: tokens.font.serif, fontSize: tokens.type.display.size, lineHeight: tokens.type.display.lineHeight },
  ai: { color: tokens.color.sage, fontFamily: tokens.font.serif, fontSize: tokens.type.display.size, lineHeight: tokens.type.display.lineHeight }
});
