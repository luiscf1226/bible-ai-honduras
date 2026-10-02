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

import type { ReadingWidgetProps } from "./readingWidget";

/**
 * Widget "Tu lectura de hoy" (#184): chico y mediano en la pantalla de inicio,
 * rectangular y en línea en la pantalla bloqueada. Igual que el del versículo
 * (#170), la función se serializa con la directiva 'widget' y corre fuera del
 * bundle: colores, tamaños y textos llegan por props desde `readingWidget.ts`.
 *
 * En la pantalla bloqueada iOS pinta en modo "vibrant" y tiñe todo con el
 * color del sistema: ahí no van los colores de la marca sino los semánticos
 * de SwiftUI (primary/secondary) y fondo transparente.
 */
const ReadingToday = (props: ReadingWidgetProps, environment: WidgetEnvironment) => {
  "widget";

  const family = environment.widgetFamily;

  // Antes de que la app le pase datos (recién instalado, sin sesión).
  if (!props?.palette) {
    return (
      <VStack modifiers={[containerBackground("clear", "widget")]}>
        <Text modifiers={[lineLimit(3)]}>Abrí la app para ver tu lectura de hoy.</Text>
      </VStack>
    );
  }

  if (family === "accessoryInline") {
    return (
      <Text modifiers={[lineLimit(1), widgetURL(props.url), containerBackground("clear", "widget")]}>{props.inline}</Text>
    );
  }

  if (family === "accessoryRectangular") {
    return (
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
          containerBackground("clear", "widget"),
          widgetURL(props.url),
        ]}
      >
        <Text modifiers={[font({ size: props.type.reference, weight: "semibold" }), foregroundStyle("secondary"), lineLimit(1)]}>
          {props.title}
        </Text>
        <Text modifiers={[font({ size: props.type.verseMedium }), foregroundStyle("primary"), lineLimit(2)]}>
          {props.headline}
        </Text>
        <Text modifiers={[font({ size: props.type.reference }), foregroundStyle("secondary"), lineLimit(1)]}>
          {props.hasReading ? props.footer : ""}
        </Text>
      </VStack>
    );
  }

  const palette = environment.colorScheme === "dark" ? props.palette.dark : props.palette.light;
  const small = family === "systemSmall";

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
        {props.title}
      </Text>
      <Text
        modifiers={[
          font(
            props.hasReading
              ? { design: "serif", size: small ? props.type.verse : props.type.verseMedium }
              : { size: props.type.verse },
          ),
          foregroundStyle(palette.ink),
          lineLimit(small ? 3 : 2),
        ]}
      >
        {props.headline}
      </Text>
      {props.detail ? (
        <Text modifiers={[font({ size: props.type.reference }), foregroundStyle(palette.inkMuted), lineLimit(1)]}>
          {props.detail}
        </Text>
      ) : null}
      <Spacer />
      <Text modifiers={[font({ size: props.type.brand }), foregroundStyle(palette.accent), lineLimit(1)]}>
        {props.footer}
      </Text>
    </VStack>
  );
};

export const ReadingTodayWidget = createWidget("LecturaDeHoy", ReadingToday);
