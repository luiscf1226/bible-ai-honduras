import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { PixelRatio, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { FilterPills } from "../src/components/FilterPills";
import { LoadingState } from "../src/components/LoadingState";
import { ScreenHeader } from "../src/components/ScreenHeader";
import {
  buildDedicationShareText,
  cleanDedicationMessage,
  cleanDedicationTo,
  DEDICATION_FORMATS,
  DEDICATION_MESSAGE_MAX,
  DEDICATION_TO_MAX,
  dedicationBlock,
  dedicationTemplates,
  defaultTemplateId,
  fittingFormats,
  type DedicationTemplateId,
} from "../src/features/dedicate/dedication";
import { VerseStoryCard } from "../src/features/home/VerseStoryCard";
import { storyCaptureSize, storyFrame, type StoryFormat } from "../src/features/home/verseStoryLayout";
import { readPauseParams } from "../src/features/pause/pause";
import { formatCitation } from "../src/lib/citation";
import { asFileUri, shareImage } from "../src/lib/share";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

type Feedback = "error" | "copied" | null;

/**
 * Dedicar un versículo (#202, design/dedicar-y-escuchar.md §Dedicar). Se
 * llega desde la hoja del versículo en el lector y desde `/hoy`. Vista previa
 * arriba, "Para" y dedicatoria, plantilla y formato, y un solo botón que
 * manda la imagen por el compartir de siempre (regla dura #3).
 *
 * Nada de lo que se escribe acá se guarda ni se manda al servidor.
 */
export default function DedicateScreen() {
  const { color, season } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string }>();
  const passage = useMemo(
    () => readPauseParams({ book: params.book, chapter: params.chapter, verse: params.verse }),
    [params.book, params.chapter, params.verse],
  );
  // El texto sale del corpus en la versión de la persona, sin editar (regla dura #4).
  const cited = useQuery(api.rag.verses.citedForUser, passage ?? "skip");
  const currentUser = useQuery(api.users.current);
  const referralCode = currentUser?.referralCode;

  const templates = useMemo(() => dedicationTemplates(season), [season]);
  const [templateId, setTemplateId] = useState<DedicationTemplateId>(() => defaultTemplateId(templates));
  const template = templates.find((item) => item.id === templateId) ?? templates[0];
  const [chosenFormat, setFormat] = useState<StoryFormat>("story");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const captureRefView = useRef<View>(null);

  const verseText = cited?.verse?.text ?? null;
  const version = cited?.version ?? "";
  const citation = passage ? `${formatCitation(passage)} · ${version}` : "";
  // Vista previa: el nombre de ejemplo hasta que la persona escriba uno.
  const previewTo = to.trim() || "Mamá";
  const block = useMemo(() => dedicationBlock(previewTo, message), [previewTo, message]);
  // Un versículo muy largo no entra entero en la cuadrada: solo se ofrece 9:16.
  const formats = useMemo(() => fittingFormats(verseText ?? "", block), [verseText, block]);
  const format: StoryFormat = formats.includes(chosenFormat) ? chosenFormat : "story";
  const frame = storyFrame(tokens.storyImage, format);
  const previewWidth = format === "story" ? tokens.size.dedicationPreview.story : tokens.size.dedicationPreview.square;
  const canShare = Boolean(verseText && referralCode && to.trim()) && !sharing;

  const onShare = async () => {
    if (!passage || !verseText || !referralCode || !to.trim() || sharing) return;
    setSharing(true);
    setFeedback(null);
    try {
      const fileUri = await captureRef(captureRefView, {
        format: "png",
        quality: 1,
        result: Platform.OS === "web" ? "data-uri" : "tmpfile",
        ...storyCaptureSize(Platform.OS, PixelRatio.get(), tokens.storyImage, format),
      });
      const result = await shareImage({
        fileUri: asFileUri(fileUri),
        origin: "dedicated",
        referralCode,
        text: buildDedicationShareText({ to, reference: formatCitation(passage), version }),
      });
      if (result.status === "error") setFeedback("error");
      else if (result.status === "shared" && result.textCopied) setFeedback("copied");
    } catch {
      setFeedback("error");
    } finally {
      setSharing(false);
    }
  };

  if (!passage || cited === undefined || (cited && !cited.verse)) {
    return (
      <AppScreen contentStyle={styles.statusScreen}>
        <ScreenHeader title="Dedicar" testID="dedicar-back" />
        {passage && cited === undefined ? (
          <LoadingState message="Buscando el versículo…" testID="dedicar-loading" />
        ) : (
          <Text style={[styles.status, { color: color.inkMuted }]} testID="dedicar-unavailable">
            No encontramos ese versículo en tu versión de la Biblia. Elegí otro desde el lector.
          </Text>
        )}
      </AppScreen>
    );
  }

  return (
    <AppScreen contentStyle={styles.screen}>
      <ScreenHeader style={styles.header} title="Dedicar" testID="dedicar-back" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="dedicar-screen">
        <View style={styles.previewWrap}>
          <View style={[styles.preview, { borderColor: color.border }]} testID="dedicar-preview">
            <VerseStoryCard
              citation={citation}
              dedication={{ to: previewTo, message, block }}
              format={format}
              palette={template.palette}
              scale={previewWidth / frame.width}
              seasonName={template.overline}
              verseText={verseText ?? ""}
            />
          </View>
        </View>

        <Field label="PARA" counter={`${to.length}/${DEDICATION_TO_MAX}`}>
          <TextInput
            accessibilityLabel="Para quién es el versículo"
            maxLength={DEDICATION_TO_MAX}
            onChangeText={(value) => setTo(cleanDedicationTo(value))}
            placeholder="Mi mamá, Don Chepe, mi célula…"
            placeholderTextColor={color.inkFaint}
            returnKeyType="next"
            style={[styles.input, { backgroundColor: color.surface, borderColor: color.borderStrong, color: color.ink }]}
            testID="dedicar-to"
            value={to}
          />
        </Field>

        <Field label="DEDICATORIA · OPCIONAL" counter={`${message.length}/${DEDICATION_MESSAGE_MAX}`}>
          <TextInput
            accessibilityLabel="Dedicatoria corta"
            maxLength={DEDICATION_MESSAGE_MAX}
            multiline
            onChangeText={(value) => setMessage(cleanDedicationMessage(value))}
            placeholder="Gracias por enseñarme a orar."
            placeholderTextColor={color.inkFaint}
            style={[styles.input, styles.inputMultiline, { backgroundColor: color.surface, borderColor: color.borderStrong, color: color.ink }]}
            testID="dedicar-message"
            textAlignVertical="top"
            value={message}
          />
        </Field>

        <Field label="PLANTILLA">
          <FilterPills
            onSelect={setTemplateId}
            options={templates.map((item) => ({ id: item.id, label: item.label, dot: item.palette.accent }))}
            selected={template.id}
            testID="dedicar-template"
          />
        </Field>

        <Field label="FORMATO">
          <FilterPills
            onSelect={setFormat}
            options={DEDICATION_FORMATS.filter((item) => formats.includes(item.id))}
            selected={format}
            testID="dedicar-format"
          />
          {formats.length < DEDICATION_FORMATS.length ? (
            <Text style={[styles.counter, { color: color.inkSoft }]} testID="dedicar-format-note">
              Este versículo es largo: para que entre entero, va en formato estado.
            </Text>
          ) : null}
        </Field>

        <View style={styles.actions}>
          <AppButton disabled={!canShare} icon="whatsapp" onPress={() => void onShare()} testID="dedicar-share">
            {sharing ? "Preparando…" : "Enviar por WhatsApp"}
          </AppButton>
          {feedback === "error" ? (
            <Text style={[styles.feedback, { color: color.danger }]} testID="dedicar-error">
              No pudimos abrir el compartir. Probá de nuevo.
            </Text>
          ) : feedback === "copied" ? (
            <Text style={[styles.feedback, { color: color.inkSoft }]} testID="dedicar-copied">
              Copiamos el texto con tu link: pegalo al mandar la imagen.
            </Text>
          ) : (
            <Text style={[styles.feedback, { color: color.inkSoft }]}>
              La dedicatoria no se guarda: se arma en tu teléfono y sale por WhatsApp.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Imagen a tamaño de captura, fuera de pantalla (mismo generador que #161). */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.offscreen, { left: -windowWidth * 2 }]}
      >
        <VerseStoryCard
          citation={citation}
          dedication={{ to: previewTo, message, block }}
          format={format}
          palette={template.palette}
          ref={captureRefView}
          scale={windowWidth / frame.width}
          seasonName={template.overline}
          verseText={verseText ?? ""}
        />
      </View>
    </AppScreen>
  );
}

function Field({ children, counter, label }: { children: React.ReactNode; counter?: string; label: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={[styles.overline, { color: color.accent }]}>{label}</Text>
        {counter ? <Text style={[styles.counter, { color: color.inkFaint }]}>{counter}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  header: { paddingHorizontal: tokens.screenPadding.horizontal },
  statusScreen: { gap: tokens.space.xl },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  content: {
    gap: tokens.space.xl,
    paddingBottom: tokens.space.xxl,
    paddingHorizontal: tokens.screenPadding.horizontal,
    paddingTop: tokens.space.lg,
  },
  previewWrap: { alignItems: "center" },
  preview: { borderRadius: tokens.radius.lg, borderWidth: 1, overflow: "hidden" },
  field: { gap: tokens.space.sm },
  fieldHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  counter: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  input: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  inputMultiline: { lineHeight: tokens.type.body.lineHeight, minHeight: tokens.size.avatar * 2 },
  actions: { gap: tokens.space.sm },
  feedback: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  offscreen: { position: "absolute", top: 0 },
});
