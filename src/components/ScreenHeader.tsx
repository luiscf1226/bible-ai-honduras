import { router } from "expo-router";
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

export type ScreenHeaderProps = {
  /** Optional title shown to the right of the back button (design: QA pick / Ajustes). */
  title?: string;
  /**
   * `page` — large screen title (Ajustes, Historial).
   * `pick` — compact picker title (Preguntar book/chapter).
   */
  titleSize?: "page" | "pick";
  titleStyle?: StyleProp<TextStyle>;
  onBack?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Stack back when possible; otherwise land on Home (dead-end / cold start). */
export function goBackOrHome() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/home");
}

/**
 * Shared screen chrome: circular ‹ back (design 34px / `tokens.size.backButton`)
 * plus optional title. Matches Claude Design headers on Sentir / Preguntar / Voces chat.
 */
export function ScreenHeader({
  title,
  titleSize = "page",
  titleStyle,
  onBack = goBackOrHome,
  accessibilityLabel = "Volver",
  testID,
  style,
}: ScreenHeaderProps) {
  const { color } = useTheme();
  const titleType = titleSize === "pick" ? tokens.type.qaPickTitle : tokens.type.title;

  return (
    <View style={[styles.header, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onBack}
        style={[styles.backButton, { borderColor: color.border }]}
        testID={testID}
      >
        <Text style={[styles.backIcon, { color: color.ink }]}>‹</Text>
      </Pressable>
      {title ? (
        <Text style={[styles.title, { color: color.ink, fontSize: titleType.size, lineHeight: titleType.lineHeight }, titleStyle]}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.md,
  },
  backButton: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  backIcon: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.subtitle.size,
  },
  title: {
    flex: 1,
    fontFamily: tokens.font.serif,
  },
});
