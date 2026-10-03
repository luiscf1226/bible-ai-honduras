import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { ReadingWidgetProps } from "./readingWidget";
import type { WidgetPalette } from "./verseWidget";

/** Nombre registrado en app.json (plugin react-native-android-widget). Android no tiene widgets de pantalla bloqueada. */
export const READING_WIDGET_NAME = "LecturaDeHoy";

// Archivos copiados por el plugin a android/app/src/main/assets/fonts (los mismos que #170).
const SERIF = "EBGaramond_400Regular";
const SANS = "DMSans_400Regular";

type HexColor = `#${string}`;

function Layout({ props, palette }: { props: ReadingWidgetProps; palette: WidgetPalette }) {
  return (
    <FlexWidget
      accessibilityLabel={`${props.title}: ${props.headline}`}
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
        text={props.title}
        truncate="END"
      />
      <FlexWidget style={{ flex: 1, flexDirection: "column", flexGap: props.type.gap, width: "match_parent" }}>
        <TextWidget
          maxLines={2}
          style={{
            color: palette.ink as HexColor,
            fontFamily: props.hasReading ? SERIF : SANS,
            fontSize: props.hasReading ? props.type.verseMedium : props.type.verse,
          }}
          text={props.headline}
          truncate="END"
        />
        {props.detail ? (
          <TextWidget
            maxLines={1}
            style={{ color: palette.inkMuted as HexColor, fontFamily: SANS, fontSize: props.type.reference }}
            text={props.detail}
            truncate="END"
          />
        ) : null}
      </FlexWidget>
      <TextWidget
        maxLines={1}
        style={{ color: palette.accent as HexColor, fontFamily: SANS, fontSize: props.type.brand }}
        text={props.footer}
      />
    </FlexWidget>
  );
}

/** Claro y oscuro: Android elige según el tema del sistema. */
export function renderReadingWidget(props: ReadingWidgetProps) {
  return {
    light: <Layout palette={props.palette.light} props={props} />,
    dark: <Layout palette={props.palette.dark} props={props} />,
  };
}
