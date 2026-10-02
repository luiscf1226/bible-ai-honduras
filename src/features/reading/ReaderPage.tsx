import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextLayoutEventData,
  type TextStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens, type ThemeColor } from "../../theme/tokens";
import {
  charsInLines,
  chunkVerses,
  dropCapLines,
  estimateCharsForLines,
  runText,
  segmentBody,
  segmentNumber,
  splitRunAt,
  verseLineTops,
  type PageVerse,
  type ReaderRun,
} from "./readerPage";
import type { ReadingTypeStyle } from "./readingSettings";
import { charsInFirstLinesFromDom, childLineTopsFromDom } from "./webTextMeasure";

export type MarginMark = "saved" | "note";

type ReaderPageProps = {
  chapter: number;
  verses: readonly PageVerse[];
  typeStyle: ReadingTypeStyle;
  /** Factor del paso de letra: la capitular crece con el texto. */
  fontScale: number;
  /** Fondo por versículo: subrayado o versículo tocado. */
  fills: Readonly<Record<number, string>>;
  marks: Readonly<Record<number, MarginMark>>;
  separatorVerse: number | null;
  onPressVerse: (verse: number) => void;
  /** Altura (relativa a la página) del renglón donde empieza cada versículo. */
  onVerseTops?: (tops: Record<number, number>) => void;
  accessibilityHintFor?: (verse: number) => string | undefined;
  highlighted: ReadonlySet<number>;
};

const isWeb = Platform.OS === "web";

/**
 * Página "Biblia de papel" (#195, U3) con las marcas del margen (#196, U4).
 * Ver `readerPage.ts` para el porqué de los bloques y de la capitular.
 */
export function ReaderPage({
  accessibilityHintFor,
  chapter,
  fills,
  fontScale,
  highlighted,
  marks,
  onPressVerse,
  onVerseTops,
  separatorVerse,
  typeStyle,
  verses,
}: ReaderPageProps) {
  const { color } = useTheme();
  const [pageWidth, setPageWidth] = useState(0);
  const [capWidth, setCapWidth] = useState(0);
  const [measuredLead, setMeasuredLead] = useState<{ key: string; chars: number } | null>(null);
  const [runHeights, setRunHeights] = useState<Record<string, number>>({});
  const [runTops, setRunTops] = useState<Record<string, Record<number, number>>>({});

  const capType = useMemo(
    () => ({ fontSize: tokens.type.dropCap.size * fontScale, lineHeight: tokens.type.dropCap.lineHeight * fontScale }),
    [fontScale],
  );
  const leadLines = dropCapLines(capType.lineHeight, typeStyle.lineHeight);
  const contentWidth = Math.max(0, pageWidth - tokens.readerPadding.horizontal * 2);
  const leadWidth = Math.max(0, contentWidth - capWidth - tokens.space.sm);
  const measureKey = `${chapter}-${leadWidth}-${typeStyle.fontSize}-${typeStyle.lineHeight}-${leadLines}`;

  const runs = useMemo(() => chunkVerses(verses), [verses]);
  const verseText = useMemo(() => new Map(verses.map((verse) => [verse.verse, verse.text])), [verses]);
  const leadChars =
    measuredLead?.key === measureKey
      ? measuredLead.chars
      : estimateCharsForLines(leadWidth, typeStyle.fontSize, leadLines);
  const split = useMemo(
    () => (runs[0] && leadChars > 0 ? splitRunAt(runs[0], leadChars) : null),
    [leadChars, runs],
  );
  const lead = split ? split[0] : runs[0];
  const pageRuns = useMemo(() => (split ? [split[1], ...runs.slice(1)] : runs.slice(1)), [runs, split]);

  const reportHeight = useCallback((key: string, height: number) => {
    setRunHeights((current) => (current[key] === height ? current : { ...current, [key]: height }));
  }, []);
  const reportTops = useCallback((key: string, tops: Record<number, number>) => {
    setRunTops((current) => ({ ...current, [key]: tops }));
  }, []);

  // Los bloques van uno debajo del otro sin espacio: la altura de cada uno sale
  // de sumar los de arriba. Se calcula así (y no con el `y` de `onLayout`)
  // porque en web el `onLayout` solo avisa cuando cambia el tamaño, no cuando
  // un bloque se corre porque el de arriba creció. Solo cuentan los bloques que
  // están en pantalla ahora: un corte de capitular viejo no deja medidas sueltas.
  const verseTops = useMemo(() => {
    const tops: Record<number, number> = {};
    let y = 0;
    for (const run of lead ? [lead, ...pageRuns] : pageRuns) {
      const height = runHeights[run.key];
      const relative = runTops[run.key];
      if (height === undefined) break;
      if (relative) for (const [verse, top] of Object.entries(relative)) tops[Number(verse)] = y + top;
      y += height;
    }
    return tops;
  }, [lead, pageRuns, runHeights, runTops]);

  useEffect(() => {
    onVerseTops?.(verseTops);
  }, [onVerseTops, verseTops]);

  const onMeasureLead = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const chars = charsInLines(event.nativeEvent.lines, leadLines);
    if (chars > 0) setMeasuredLead({ key: measureKey, chars });
  };
  const onMeasureLeadWeb = (event: LayoutChangeEvent) => {
    const chars = charsInFirstLinesFromDom((event.nativeEvent as { target?: unknown }).target, leadLines);
    if (chars !== null && chars > 0) setMeasuredLead({ key: measureKey, chars });
  };

  const runProps = {
    accessibilityHintFor,
    color,
    fills,
    highlighted,
    lineHeight: typeStyle.lineHeight,
    onPressVerse,
    reportTops,
    reportHeight,
    verseText,
  };
  // Estilos estables entre renders: `ReaderRunText` está memoizado por identidad.
  const bodyStyle = useMemo<StyleProp<TextStyle>>(
    () => [styles.body, { color: color.ink, fontSize: typeStyle.fontSize, lineHeight: typeStyle.lineHeight }],
    [color.ink, typeStyle.fontSize, typeStyle.lineHeight],
  );
  const leadHeight = leadLines * typeStyle.lineHeight;
  const leadStyle = useMemo<StyleProp<TextStyle>>(
    () => [bodyStyle, { marginLeft: capWidth + tokens.space.sm, minHeight: leadHeight }],
    [bodyStyle, capWidth, leadHeight],
  );
  const markTop = (verse: number, size: number) => verseTops[verse] + (typeStyle.lineHeight - size) / 2;

  return (
    <View
      onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
      style={styles.page}
      testID="reading-page"
    >
      {lead ? (
        <>
          <Text
            accessibilityLabel={`Capítulo ${chapter}`}
            onLayout={(event) => setCapWidth(event.nativeEvent.layout.width)}
            // El pie de la capitular se alinea con el pie del último renglón que abraza.
            style={[styles.dropCap, capType, { color: color.accent, top: leadHeight - capType.lineHeight }]}
            testID="reading-drop-cap"
          >
            {chapter}
          </Text>
          <ReaderRunText
            {...runProps}
            run={lead}
            style={leadStyle}
          />
        </>
      ) : null}
      {pageRuns.map((run) => (
        <ReaderRunText {...runProps} key={run.key} run={run} style={bodyStyle} />
      ))}

      {Object.entries(marks).map(([verse, mark]) => {
        const number = Number(verse);
        if (verseTops[number] === undefined) return null;
        return mark === "note" ? (
          <View
            key={`mark-${verse}`}
            pointerEvents="none"
            style={[styles.noteMark, { top: markTop(number, tokens.size.icon.sm) }]}
            testID={`reading-margin-note-${verse}`}
          >
            <Icon color={color.inkSoft} name="note" size="sm" />
          </View>
        ) : (
          <View
            key={`mark-${verse}`}
            pointerEvents="none"
            style={[styles.savedMark, { backgroundColor: color.accent, top: markTop(number, tokens.size.marginMark) }]}
            testID={`reading-margin-saved-${verse}`}
          />
        );
      })}

      {separatorVerse !== null && verseTops[separatorVerse] !== undefined ? (
        <View
          accessibilityLabel={`Tu separador está en el versículo ${separatorVerse}`}
          style={[styles.ribbon, { top: markTop(separatorVerse, tokens.size.ribbon.height) }]}
          testID="reading-separator-mark"
        >
          <Svg height={tokens.size.ribbon.height} width={tokens.size.ribbon.width}>
            <Path d={RIBBON_PATH} fill={color.accent} />
          </Svg>
        </View>
      ) : null}

      {/* Medidor invisible: cuánto texto entra al lado de la capitular. */}
      {runs[0] && leadWidth > 0 ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          key={measureKey}
          onLayout={isWeb ? onMeasureLeadWeb : undefined}
          onTextLayout={isWeb ? undefined : onMeasureLead}
          pointerEvents="none"
          style={[bodyStyle, styles.measurer, { width: leadWidth }]}
        >
          {runText(runs[0])}
        </Text>
      ) : null}
    </View>
  );
}

const { width: RIBBON_W, height: RIBBON_H } = tokens.size.ribbon;
/** Cinta con la punta en V, como la de una Biblia de papel. */
const RIBBON_PATH = `M0 0H${RIBBON_W}V${RIBBON_H}L${RIBBON_W / 2} ${RIBBON_H - RIBBON_W / 2}L0 ${RIBBON_H}Z`;

type ReaderRunTextProps = {
  run: ReaderRun;
  style: StyleProp<TextStyle>;
  color: ThemeColor;
  fills: Readonly<Record<number, string>>;
  highlighted: ReadonlySet<number>;
  lineHeight: number;
  verseText: ReadonlyMap<number, string>;
  onPressVerse: (verse: number) => void;
  accessibilityHintFor?: (verse: number) => string | undefined;
  reportHeight: (key: string, height: number) => void;
  reportTops: (key: string, tops: Record<number, number>) => void;
};

/**
 * Un bloque de texto corrido: un `<Text>` con un `<Text>` anidado por
 * versículo, tocable y con el subrayado por renglón. Memoizado por versículo:
 * subrayar el 105 de Salmos 119 no vuelve a pintar los otros 8 bloques.
 */
const ReaderRunText = memo(
  function ReaderRunText({
    accessibilityHintFor,
    color,
    fills,
    highlighted,
    lineHeight,
    onPressVerse,
    reportTops,
    reportHeight,
    run,
    style,
    verseText,
  }: ReaderRunTextProps) {
    const onLayout = (event: LayoutChangeEvent) => {
      reportHeight(run.key, event.nativeEvent.layout.height);
      if (!isWeb) return;
      const tops = childLineTopsFromDom((event.nativeEvent as { target?: unknown }).target, lineHeight);
      if (!tops) return;
      const byVerse: Record<number, number> = {};
      run.segments.forEach((segment, index) => {
        if (segment.showNumber && tops[index] !== undefined) byVerse[segment.verse] = tops[index];
      });
      reportTops(run.key, byVerse);
    };
    const onTextLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      reportTops(run.key, verseLineTops(run, event.nativeEvent.lines));
    };

    return (
      <Text onLayout={onLayout} onTextLayout={isWeb ? undefined : onTextLayout} style={style}>
        {run.segments.map((segment, index) => {
          const fill = fills[segment.verse];
          return (
            <Text
              accessibilityHint={accessibilityHintFor?.(segment.verse)}
              accessibilityLabel={`Versículo ${segment.verse}. ${verseText.get(segment.verse) ?? ""}`}
              // En web, el rol "button" vuelve el `<span>` un `<button>` en
              // bloque y rompe la prosa corrida; web es solo el harness de QA.
              accessibilityRole={isWeb ? undefined : "button"}
              key={`${segment.verse}-${index}`}
              onPress={() => onPressVerse(segment.verse)}
              style={fill ? { backgroundColor: fill } : undefined}
              testID={
                segment.showNumber && highlighted.has(segment.verse) ? `reading-highlighted-verse-${segment.verse}` : undefined
              }
            >
              {segment.showNumber ? <Text style={{ color: color.accent }}>{segmentNumber(segment)}</Text> : null}
              {segmentBody(segment)}
            </Text>
          );
        })}
      </Text>
    );
  },
  (previous, next) =>
    previous.run === next.run &&
    previous.style === next.style &&
    previous.color === next.color &&
    previous.lineHeight === next.lineHeight &&
    previous.verseText === next.verseText &&
    previous.onPressVerse === next.onPressVerse &&
    previous.accessibilityHintFor === next.accessibilityHintFor &&
    previous.run.segments.every(
      (segment) =>
        previous.fills[segment.verse] === next.fills[segment.verse] &&
        previous.highlighted.has(segment.verse) === next.highlighted.has(segment.verse),
    ),
);

const styles = StyleSheet.create({
  page: { paddingHorizontal: tokens.readerPadding.horizontal },
  body: { fontFamily: tokens.font.serif },
  dropCap: {
    fontFamily: tokens.font.serif,
    left: tokens.readerPadding.horizontal,
    position: "absolute",
  },
  measurer: { left: 0, opacity: 0, position: "absolute", top: 0 },
  // Marcas en el margen izquierdo, centradas en el margen de la página.
  savedMark: {
    borderRadius: tokens.radius.pill,
    height: tokens.size.marginMark,
    left: (tokens.readerPadding.horizontal - tokens.size.marginMark) / 2,
    position: "absolute",
    width: tokens.size.marginMark,
  },
  noteMark: { left: (tokens.readerPadding.horizontal - tokens.size.icon.sm) / 2, position: "absolute" },
  // La cinta va en el margen derecho: nunca se monta sobre el texto, ni en el
  // paso de letra más grande.
  ribbon: { position: "absolute", right: (tokens.readerPadding.horizontal - tokens.size.ribbon.width) / 2 },
});
