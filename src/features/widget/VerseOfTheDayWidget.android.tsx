import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { VerseWidgetProps, WidgetPalette, WidgetSize } from "./verseWidget";

/** Nombres registrados en app.json (plugin react-native-android-widget). */
export const ANDROID_WIDGET_SIZES: Record<string, WidgetSize> = {
  VersiculoChico: "small",
  VersiculoMediano: "medium",
};

// Archivos copiados por el plugin a android/app/src/main/assets/fonts.
const SERIF = "EBGaramond_400Regular";
const SANS = "DMSans_400Regular";

type HexColor = `#${string}`;

function Layout({ props, palette, size }: { props: VerseWidgetProps; palette: WidgetPalette; size: WidgetSize }) {
  const small = size === "small";
  return (
    <FlexWidget
      accessibilityLabel={`Versículo del día: ${props.verseRef}`}
      clickAction="OPEN_URI"
      clickActionData={{ uri: props.url }}
      style={{
        backgroundColor: palette.bg as HexColor,
        borderRadius: props.type.padding,
        flexDirection: "column",
        flexGap: props.type.gap,
        height: "match_parent",
        padding: props.type.padding,
        width: "match_parent",
      }}
    >
      <TextWidget
        maxLines={1}
        style={{ color: palette.accent as HexColor, fontFamily: SANS, fontSize: props.type.reference }}
        text={props.verseRef}
        truncate="END"
      />
      <FlexWidget style={{ flex: 1, width: "match_parent" }}>
        <TextWidget
          maxLines={small ? 4 : 3}
          style={{
            color: palette.ink as HexColor,
            fontFamily: SERIF,
            fontSize: small ? props.type.verse : props.type.verseMedium,
          }}
          text={small ? props.textSmall : props.textMedium}
          truncate="END"
        />
      </FlexWidget>
      <TextWidget
        maxLines={1}
        style={{ color: palette.inkMuted as HexColor, fontFamily: SANS, fontSize: props.type.brand }}
        text={small ? props.version : `${props.brand} · ${props.version}`}
      />
    </FlexWidget>
  );
}

/** Claro y oscuro: Android elige según el tema del sistema. */
export function renderVerseWidget(props: VerseWidgetProps, size: WidgetSize) {
  return {
    light: <Layout palette={props.palette.light} props={props} size={size} />,
    dark: <Layout palette={props.palette.dark} props={props} size={size} />,
  };
}
