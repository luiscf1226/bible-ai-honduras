import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BottomPanel } from "../../components/BottomPanel";
import { ChapterGrid } from "../../components/ChapterGrid";
import { Icon } from "../../components/Icon";
import { PassageSearch } from "../../components/PassageSearch";
import { keyboardBehaviorFor } from "../../lib/keyboardAvoidance";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import type { PassageQuery } from "../reading/bookSearch";

type PassageSheetProps = {
  visible: boolean;
  version: string;
  onClose: () => void;
  onSelect: (passage: PassageQuery) => void;
};

// La hoja deja ver la conversación arriba (se lee que es algo encima, que se
// cierra tocando afuera) y no cambia de alto mientras se teclea en el buscador.
const SHEET_MIN_RATIO = 0.5;
const SHEET_MAX_RATIO = 0.72;

/**
 * Hoja para elegir el pasaje desde el chip (U6, #198). Es el selector que antes
 * era la pantalla entera de Preguntar (`PassageSearch` + `ChapterGrid`), ahora
 * dentro de un `BottomPanel`: preguntar ya no exige elegir antes.
 *
 * Velo: el mismo `ink` al 30 % del `SideDrawer`. Esquinas de arriba
 * `radius.xxl`, como las tarjetas del inicio. Sin borde a los costados: la
 * rejilla de capítulos mide el ancho de la pantalla menos `screenPadding`.
 */
export function PassageSheet({ onClose, onSelect, version, visible }: PassageSheetProps) {
  const { color } = useTheme();
  const { height } = useWindowDimensions();
  const [book, setBook] = useState<string | null>(null);

  // Cada vez que se abre arranca en el buscador, no en el último libro.
  useEffect(() => {
    if (visible) setBook(null);
  }, [visible]);

  const pick = (passage: PassageQuery) => {
    onSelect(passage);
    onClose();
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={keyboardBehaviorFor(Platform.OS)} style={styles.root}>
        <Pressable
          accessibilityLabel="Cerrar el buscador de pasajes"
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.scrim, { backgroundColor: color.ink }]}
        />
        <View style={[styles.sheet, { backgroundColor: color.surface }]} testID="qa-passage-sheet">
          <SafeAreaView edges={["bottom"]} style={styles.safe}>
            <BottomPanel
              bodyStyle={{ maxHeight: height * SHEET_MAX_RATIO, minHeight: height * SHEET_MIN_RATIO }}
              header={
                <View style={styles.head}>
                  {book ? (
                    <Pressable
                      accessibilityLabel="Volver a los libros"
                      accessibilityRole="button"
                      hitSlop={tokens.space.sm}
                      onPress={() => setBook(null)}
                      style={[styles.round, { borderColor: color.border }]}
                      testID="qa-passage-sheet-back"
                    >
                      <Icon color={color.ink} name="back" size="sm" />
                    </Pressable>
                  ) : null}
                  <View style={styles.headText}>
                    <Text style={[styles.title, { color: color.ink }]}>{book ?? "¿Sobre qué pasaje?"}</Text>
                    <Text style={[styles.subtitle, { color: color.inkSoft }]}>
                      {book ? "Elegí el capítulo." : "Buscá un libro, una cita o una palabra del texto."}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Cerrar"
                    accessibilityRole="button"
                    hitSlop={tokens.space.sm}
                    onPress={onClose}
                    style={[styles.round, { borderColor: color.border }]}
                    testID="qa-passage-sheet-close"
                  >
                    <Icon color={color.ink} name="close" size="sm" />
                  </Pressable>
                </View>
              }
            >
              {book ? (
                <ChapterGrid book={book} onSelect={(chapter) => pick({ book, chapter })} />
              ) : (
                <PassageSearch onSelectBook={setBook} onSelectPassage={pick} version={version} />
              )}
            </BottomPanel>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  // Velo de `ink` al 30 %, igual que el `SideDrawer`.
  scrim: { ...StyleSheet.absoluteFill, opacity: (1 - tokens.opacity.pressed) * 3 },
  sheet: {
    borderTopLeftRadius: tokens.radius.xxl,
    borderTopRightRadius: tokens.radius.xxl,
    overflow: "hidden",
  },
  safe: { flexShrink: 1 },
  head: { alignItems: "flex-start", flexDirection: "row", gap: tokens.space.md, paddingTop: tokens.space.xs },
  headText: { flex: 1 },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.qaPickTitle.size,
    lineHeight: tokens.type.qaPickTitle.lineHeight,
  },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  round: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
});
