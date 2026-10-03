import { useAction, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppButton } from "../../../src/components/AppButton";
import { AppScreen } from "../../../src/components/AppScreen";
import { LimitReached } from "../../../src/components/LimitReached";
import { LoadingState } from "../../../src/components/LoadingState";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import {
  buildGuideShareText,
  citationsLabel,
  GROUP_GUIDE_STEPS,
  truncatedNotice,
  type GroupGuideView,
  type GuideItem,
} from "../../../src/features/groups/groupGuideText";
import { groupStyles as styles } from "../../../src/features/groups/groupStyles";
import { parseChapterParams } from "../../../src/features/reading/chapterNavigation";
import { shareContent } from "../../../src/lib/share";
import { useTheme } from "../../../src/theme/ThemeProvider";

type Outcome =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; guide: GroupGuideView }
  | { kind: "limit" }
  | { kind: "pro" }
  | { kind: "message"; text: string };

/**
 * "Preparar para mi grupo" (#188, Pro): un resumen del capítulo y 4 o 5
 * preguntas para conversar, cada pieza con su cita. Es una variante de
 * Preguntar: mismo pipeline RAG y misma cuota (`qa.prepareGroupGuide`).
 */
export default function GuiaGrupoScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ book?: string | string[]; chapter?: string | string[] }>();
  const ref = parseChapterParams(params);
  const entitlement = useQuery(api.entitlements.mine);
  const currentUser = useQuery(api.users.current);
  const prepare = useAction(api.qa.prepareGroupGuide);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const isPro = entitlement?.isPro === true;

  if (!ref) {
    return (
      <AppScreen contentStyle={styles.content}>
        <ScreenHeader onBack={goBackOrHome} title="Para tu grupo" />
        <Text style={[styles.body, { color: color.inkSoft }]}>Ese capítulo no existe. Abrí la guía desde el lector.</Text>
      </AppScreen>
    );
  }
  if (outcome.kind === "limit") {
    return <LimitReached module="qa" testID="guia-limit" />;
  }

  const run = async () => {
    setOutcome({ kind: "loading" });
    try {
      const result = await prepare({ book: ref.book, chapter: ref.chapter });
      if (result.status === "ok") setOutcome({ kind: "ok", guide: result.guide });
      else if (result.status === "limit_reached") setOutcome({ kind: "limit" });
      else if (result.status === "pro_required") setOutcome({ kind: "pro" });
      else if (result.status === "no_content")
        setOutcome({ kind: "message", text: "Todavía no tenemos este capítulo en el corpus, así que no hay de dónde citar." });
      else
        setOutcome({
          kind: "message",
          text: "No pudimos armar una guía en la que cada pregunta tenga su versículo. Probá de nuevo en un momento.",
        });
    } catch {
      setOutcome({ kind: "message", text: "No pudimos preparar la guía. Revisá tu conexión e intentá de nuevo." });
    }
  };

  const share = () => {
    if (outcome.kind !== "ok" || !currentUser?.referralCode) return;
    void shareContent({ text: buildGuideShareText(outcome.guide), referralCode: currentUser.referralCode });
  };

  const showProCard = entitlement !== undefined && (!isPro || outcome.kind === "pro");

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader onBack={goBackOrHome} title="Para tu grupo" />

      <View style={styles.section}>
        <Text style={[styles.overline, { color: color.accent }]}>PREPARAR PARA MI GRUPO · PRO</Text>
        <Text style={[styles.title, { color: color.ink }]}>
          {ref.book} {ref.chapter}
        </Text>
        <Text style={[styles.bodySm, { color: color.inkMuted }]}>
          Un resumen del capítulo y 4 o 5 preguntas para conversar en la célula o en la escuela dominical. Cada una
          lleva el versículo en el que se apoya.
        </Text>
      </View>

      {showProCard ? (
        <View style={[styles.card, { backgroundColor: color.surfaceSunk, borderColor: color.border }]} testID="guia-pro">
          <View style={styles.cardBody}>
            <Text style={[styles.bodySm, { color: color.inkMuted }]}>
              Preparar para mi grupo es parte de Pro. Con Pro también preguntás sin límite.
            </Text>
            <AppButton onPress={() => router.push("/paywall")} testID="guia-ver-pro">
              Ver Pro
            </AppButton>
          </View>
        </View>
      ) : outcome.kind === "idle" ? (
        <AppButton disabled={entitlement === undefined} onPress={() => void run()} testID="guia-preparar">
          Preparar la guía
        </AppButton>
      ) : outcome.kind === "loading" ? (
        <LoadingState steps={GROUP_GUIDE_STEPS} testID="guia-cargando" variant="inline" />
      ) : outcome.kind === "message" ? (
        <>
          <Text accessibilityRole="alert" style={[styles.body, { color: color.inkMuted }]} testID="guia-mensaje">
            {outcome.text}
          </Text>
          <AppButton onPress={() => void run()} variant="secondary">
            Intentar de nuevo
          </AppButton>
        </>
      ) : outcome.kind === "ok" ? (
        <GuideBody guide={outcome.guide} onShare={share} canShare={Boolean(currentUser?.referralCode)} />
      ) : null}
    </AppScreen>
  );
}

function Citations({ item }: { item: GuideItem }) {
  const { color } = useTheme();
  return (
    <View style={[styles.citation, { backgroundColor: color.surfaceSunk }]}>
      {item.citations.map((citation) => (
        <Text key={citation.verse} style={[styles.citationQuote, { color: color.inkMuted }]}>
          {citation.verse} &ldquo;{citation.text}&rdquo;
        </Text>
      ))}
      <Text style={[styles.citationRef, { color: color.inkFaint }]}>
        {citationsLabel(item.citations)} ({item.citations[0]?.version})
      </Text>
    </View>
  );
}

function GuideBody({ canShare, guide, onShare }: { guide: GroupGuideView; onShare: () => void; canShare: boolean }) {
  const { color } = useTheme();
  const notice = truncatedNotice(guide);
  return (
    <>
      <View style={styles.section} testID="guia-resumen">
        <Text style={[styles.overline, { color: color.accent }]}>RESUMEN</Text>
        <Text style={[styles.body, { color: color.ink }]}>{guide.summary.text}</Text>
        <Citations item={guide.summary} />
      </View>

      <View style={styles.section} testID="guia-preguntas">
        <Text style={[styles.overline, { color: color.accent }]}>PARA CONVERSAR</Text>
        {guide.questions.map((item, index) => (
          <View key={index} style={styles.section}>
            <Text style={[styles.subtitle, { color: color.ink }]}>
              {index + 1}. {item.text}
            </Text>
            <Citations item={item} />
          </View>
        ))}
      </View>

      {notice ? <Text style={[styles.caption, { color: color.inkSoft }]}>{notice}</Text> : null}
      <Text style={[styles.disclaimer, { color: color.inkFaint }]}>
        Hecha con IA a partir del texto {guide.version} y de comentarios evangélicos. La IA puede equivocarse: leela
        antes de la reunión.
      </Text>
      <AppButton disabled={!canShare} onPress={onShare} testID="guia-compartir" variant="secondary">
        Mandar la guía por WhatsApp
      </AppButton>
    </>
  );
}
