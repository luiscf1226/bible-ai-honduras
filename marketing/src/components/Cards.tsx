import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";

import { appScale, color, font, safe, story, tokens } from "../theme";
import { rise } from "./motion";

const card: React.CSSProperties = {
  backgroundColor: color.bg,
  paddingTop: safe.top,
  paddingBottom: safe.bottom,
  paddingLeft: safe.left,
  paddingRight: safe.right,
  justifyContent: "center",
};

/**
 * El gancho: lo que se lee en los primeros 2 segundos. Letra grande, sin nada
 * alrededor, y quieta desde el primer cuadro porque también es la portada.
 */
export function Hook({ text, overline }: { text: string; overline?: string }) {
  return (
    <AbsoluteFill style={card}>
      {overline ? (
        <div
          style={{
            fontFamily: font.sans,
            fontWeight: tokens.font.weight.regular,
            fontSize: story.reference,
            letterSpacing: `${tokens.type.overline.letterSpacing}em`,
            textTransform: "uppercase",
            color: color.accent,
            marginBottom: story.paddingX / 2,
          }}
        >
          {overline}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: font.serif,
          fontSize: story.verseMax,
          lineHeight: story.verseLineHeight,
          color: color.ink,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

/** Versículo a pantalla completa, como la imagen para el estado de WhatsApp. */
export function VerseCard({ text, reference }: { text: string; reference: string }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={card}>
      <div
        style={{
          ...rise(frame, 0),
          fontFamily: font.serif,
          fontSize: story.verseMin,
          lineHeight: story.verseLineHeight,
          color: color.ink,
        }}
      >
        «{text}»
      </div>
      <div
        style={{
          ...rise(frame, 18),
          display: "flex",
          alignItems: "center",
          gap: story.reference / 2,
          marginTop: story.paddingX / 2,
          fontFamily: font.sans,
          fontWeight: tokens.font.weight.medium,
          fontSize: story.reference,
          color: color.accent,
        }}
      >
        <div style={{ width: story.minimalRuleWidth, height: story.minimalRule, backgroundColor: color.accent }} />
        {reference}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Cierre, igual en todos los videos: ícono, la frase del video y cómo
 * descargar 3C: un QR a la página de descarga y su dirección escrita.
 */
export function Closing({ lead, qr, url }: { lead: string; qr?: string; url?: string }) {
  const frame = useCurrentFrame();
  const icon = tokens.size.logoMedium * appScale;
  const qrSize = tokens.size.verseCardImage * appScale * 0.75;
  return (
    <AbsoluteFill style={{ ...card, alignItems: "center", textAlign: "center" }}>
      <Img
        src={staticFile("icon.png")}
        style={{
          ...rise(frame, 0),
          width: icon,
          height: icon,
          borderRadius: tokens.radius.xl * appScale,
          marginBottom: story.paddingX / 3,
        }}
      />
      <div style={{ ...rise(frame, 6), fontFamily: font.serif, fontSize: story.verseMin, lineHeight: story.verseLineHeight, color: color.ink }}>
        {lead}
      </div>
      {qr ? (
        <div
          style={{
            ...rise(frame, 12),
            marginTop: story.paddingX / 2,
            padding: story.brand,
            borderRadius: tokens.radius.xl * appScale,
            backgroundColor: color.surface,
            border: `${appScale / 2}px solid ${color.borderStrong}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: story.brand / 2,
          }}
        >
          <Img src={staticFile(qr)} style={{ width: qrSize, height: qrSize }} />
          <div style={{ fontFamily: font.sans, fontWeight: tokens.font.weight.medium, fontSize: story.brand, color: color.ink }}>
            Escaneá para descargar
          </div>
        </div>
      ) : null}
      {url ? (
        <div style={{ ...rise(frame, 16), marginTop: story.brand, fontFamily: font.sans, fontWeight: tokens.font.weight.regular, fontSize: story.brand, color: color.accentDeep }}>
          {url}
        </div>
      ) : null}
      <div
        style={{
          ...rise(frame, 20),
          marginTop: story.paddingX / 2,
          paddingTop: story.brand / 2,
          paddingBottom: story.brand / 2,
          paddingLeft: story.brand,
          paddingRight: story.brand,
          borderRadius: tokens.radius.pill,
          backgroundColor: color.ink,
          color: color.surface,
          fontFamily: font.sans,
          fontWeight: tokens.font.weight.medium,
          fontSize: story.reference,
        }}
      >
        3C, gratis en iPhone y Android
      </div>
    </AbsoluteFill>
  );
}

export type Character = { name: string; tag: string; gradientFrom: string; gradientTo: string };

/** Gancho de Voces: el degradado del personaje (convex/voicesCatalog.ts), su avatar y la frase. */
export function CharacterHook({ text, character }: { text: string; character: Character }) {
  const avatar = tokens.size.avatarLarge * appScale;
  return (
    <AbsoluteFill style={{ ...card, backgroundImage: `linear-gradient(160deg, ${character.gradientFrom}, ${character.gradientTo})` }}>
      <div style={{ display: "flex", alignItems: "center", gap: story.reference / 2, marginBottom: story.paddingX / 2 }}>
        <div
          style={{
            width: avatar,
            height: avatar,
            borderRadius: tokens.radius.pill,
            border: `${tokens.size.ring * appScale}px solid ${color.avatarInitial}`,
            backgroundImage: `linear-gradient(135deg, ${character.gradientFrom}, ${character.gradientTo})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color.avatarInitial,
            fontFamily: font.serif,
            fontSize: tokens.type.subtitle.size * appScale,
          }}
        >
          {character.name[0]}
        </div>
        <div>
          <div style={{ fontFamily: font.serif, fontSize: story.verseMin, lineHeight: 1.1, color: color.ink }}>{character.name}</div>
          <div style={{ fontFamily: font.sans, fontWeight: tokens.font.weight.light, fontSize: story.brand, color: color.ink }}>{character.tag}</div>
        </div>
      </div>
      <div style={{ fontFamily: font.serif, fontSize: story.verseMax, lineHeight: story.verseLineHeight, color: color.ink }}>{text}</div>
    </AbsoluteFill>
  );
}
