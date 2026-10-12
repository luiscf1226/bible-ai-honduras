import { useQuery } from "convex/react";
import * as Print from "expo-print";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { ListCard, ListRow, ListSectionLabel } from "../src/components/ListRow";
import { PersonalLockGate } from "../src/components/PersonalLockGate";
import { ScreenHeader } from "../src/components/ScreenHeader";
import {
  EXPORT_EMPTY_COPY,
  buildExportDocument,
  buildExportHtml,
  buildExportText,
  entryMarks,
  exportPreview,
  exportSummary,
} from "../src/features/personal/exportMine";
import { shareFile, sharePlainText } from "../src/lib/share";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

const PREVIEW_COUNT = 3;

/**
 * Exportar lo mío (#173): guardados con su nota y subrayados, en texto o PDF,
 * ordenados por libro y capítulo, más el diario de oración (#159) y las notas
 * de prédica (#232). Se arma en el teléfono; nada pasa por la IA.
 *
 * Única entrada: Mi espacio (más el atajo de "Eliminar mi cuenta", #232).
 */
function ExportarScreen() {
  const { color } = useTheme();
  const bookmarks = useQuery(api.reading.bookmarks, {});
  const highlights = useQuery(api.reading.highlightsWithText, {});
  const prayers = useQuery(api.prayers.list, {});
  const sermonNotes = useQuery(api.sermonNotes.list, {});
  const [busy, setBusy] = useState<"pdf" | "text" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loading = bookmarks === undefined || highlights === undefined || prayers === undefined || sermonNotes === undefined;

  const doc = buildExportDocument({
    bookmarks: bookmarks?.items ?? [],
    highlights: highlights?.items ?? [],
    prayers: prayers ?? [],
    sermonNotes: sermonNotes ?? [],
    generatedAt: Date.now(),
  });
  const empty = !loading && doc.total === 0;
  const preview = exportPreview(doc, PREVIEW_COUNT);

  async function exportPdf() {
    setBusy("pdf");
    setNotice(null);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildExportHtml(doc) });
      const result = await shareFile({ uri, mimeType: "application/pdf", uti: "com.adobe.pdf", dialogTitle: "Lo mío (PDF)" });
      if (result.status === "error") setNotice("No pudimos abrir la hoja para compartir. Probá de nuevo.");
    } catch {
      setNotice("No pudimos crear el PDF. Probá de nuevo o exportá como texto.");
    } finally {
      setBusy(null);
    }
  }

  async function exportText() {
    setBusy("text");
    setNotice(null);
    const result = await sharePlainText(buildExportText(doc));
    if (result.status === "error") setNotice("No pudimos abrir la hoja para compartir. Probá de nuevo.");
    setBusy(null);
  }

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: color.surface }}>
      <ScreenHeader accessibilityLabel="Volver" style={styles.header} title="Exportar lo mío" />

      <ListCard tone="sunk">
        <Text style={[styles.copy, { color: color.inkMuted }]}>
          Es tuyo, te lo podés llevar. Van tus guardados con su nota y tus subrayados, ordenados por libro y capítulo,
          con la versión y la fecha, tu diario de oración y tus notas de prédica. No van Sentir ni tus conversaciones.
        </Text>
      </ListCard>

      <ListSectionLabel>Vista previa</ListSectionLabel>
      <ListCard testID="exportar-vista-previa">
        <ListRow title={loading ? "…" : exportSummary(doc.counts)} testID="exportar-resumen" />
        {empty ? (
          <Text style={[styles.copy, { color: color.inkSoft }]} testID="exportar-vacio">
            {EXPORT_EMPTY_COPY}
          </Text>
        ) : null}
        {preview.entries.map((entry) => (
          <ListRow key={entry.reference} serif title={`${entry.reference} · ${entry.version}`}>
            <Text style={[styles.hint, { color: color.inkMuted }]}>{entryMarks(entry)}</Text>
            {entry.note ? (
              <Text numberOfLines={2} style={[styles.hint, { color: color.inkSoft }]}>
                Mi nota: {entry.note}
              </Text>
            ) : null}
          </ListRow>
        ))}
        {preview.more > 0 ? <Text style={[styles.copy, { color: color.inkSoft }]}>y {preview.more} más en el archivo</Text> : null}
      </ListCard>

      <View style={styles.actions}>
        <AppButton disabled={loading || empty || busy !== null} onPress={() => void exportPdf()} testID="exportar-pdf">
          {busy === "pdf" ? "Creando el PDF…" : "Compartir en PDF"}
        </AppButton>
        <AppButton
          disabled={loading || empty || busy !== null}
          onPress={() => void exportText()}
          testID="exportar-texto"
          variant="secondary"
        >
          Compartir como texto
        </AppButton>
        <Text style={[styles.hint, styles.center, { color: color.inkSoft }]}>
          {empty
            ? "Los botones se activan cuando tengas algo guardado o subrayado."
            : "El PDF es para imprimir; el texto, para pegarlo en un mensaje o en tus notas."}
        </Text>
        {notice ? (
          <Text accessibilityRole="alert" style={[styles.hint, styles.center, { color: color.danger }]} testID="exportar-aviso">
            {notice}
          </Text>
        ) : null}
      </View>
    </AppScreen>
  );
}

export default function ExportarRoute() {
  return (
    <PersonalLockGate>
      <ExportarScreen />
    </PersonalLockGate>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  header: { marginBottom: tokens.space.xxl },
  copy: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  hint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  center: { textAlign: "center" },
  actions: { gap: tokens.space.md, marginTop: tokens.space.xxl },
});
