import { Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

import type { VerseWidgetProps } from "./verseWidget";

/**
 * Widget de iOS (#170), chico y mediano. La función se serializa con la
 * directiva 'widget' y corre fuera del bundle de la app: todo lo que usa
 * (colores, tamaños, textos) llega por props desde `verseWidget.ts`.
 *
 * EB Garamond no viaja a la extensión del widget; el versículo usa la serif
 * del sistema, que es lo más cercano sin empaquetar la fuente.
 */
const VerseOfTheDay = (props: VerseWidgetProps, environment: WidgetEnvironment) => {
  "widget";

  const palette = environment.colorScheme === "dark" ? props.palette.dark : props.palette.light;
  const small = environment.widgetFamily === "systemSmall";

  return (
    <VStack
      alignment="leading"
      spacing={props.type.gap}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
        padding({ all: props.type.padding }),
        containerBackground(palette.bg, "widget"),
        widgetURL(props.url),
      ]}
    >
      <Text modifiers={[font({ size: props.type.reference }), foregroundStyle(palette.accent), lineLimit(1)]}>
        {props.verseRef}
      </Text>
      <Text
        modifiers={[
          font({ design: "serif", size: small ? props.type.verse : props.type.verseMedium }),
          foregroundStyle(palette.ink),
          lineLimit(small ? 4 : 3),
        ]}
      >
        {small ? props.textSmall : props.textMedium}
      </Text>
      <Spacer />
      <Text modifiers={[font({ size: props.type.brand }), foregroundStyle(palette.inkMuted), lineLimit(1)]}>
        {small ? props.version : `${props.brand} · ${props.version}`}
      </Text>
    </VStack>
  );
};

export const VerseOfTheDayWidget = createWidget("VersiculoDelDia", VerseOfTheDay);
