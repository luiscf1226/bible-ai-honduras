import { StyleSheet } from "react-native";

import { tokens } from "../../theme/tokens";

/**
 * Estilos de las pantallas de grupo (#185) y de la guía (#188). Ninguna de las
 * dos está en el prototipo de Claude Design: se armaron **solo** con piezas que
 * ya existen en la app, para que ratificarlas sea mirar, no rediseñar:
 *
 * - tarjeta + renglón con divisor: `app/mi-espacio.tsx` y `app/ajustes.tsx`
 * - overline + título serif + descripción: la tarjeta del plan (`leer/plan.tsx`)
 * - cita (fondo `surfaceSunk`, versículo en serif itálica): la burbuja de
 *   Preguntar (`preguntar/chat.tsx`)
 *
 * Cero hex, cero tamaños, radios o paddings literales: todo sale de
 * `src/theme/tokens.ts`.
 */
export const groupStyles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  pressed: { opacity: tokens.opacity.pressed },
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  cardBody: {
    gap: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  subtitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  body: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  bodySm: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  caption: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  rowDivider: { borderTopWidth: 1 },
  rowText: { flex: 1, gap: tokens.space.xs, paddingRight: tokens.space.md },
  rowLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  rowAction: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  section: { gap: tokens.space.sm },
  // Cita: misma caja que en Preguntar.
  citation: { borderRadius: tokens.radius.md, gap: tokens.space.xs, padding: tokens.space.lg },
  citationQuote: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.bodySm.size,
    fontStyle: "italic",
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  citationRef: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  disclaimer: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.disclaimer.size, lineHeight: tokens.type.caption.lineHeight },
});
