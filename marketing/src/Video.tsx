import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";

import { type Character, CharacterHook, Closing, Hook, VerseCard } from "./components/Cards";
import { rise, sceneOpacity } from "./components/motion";
import { appScale, color, font, safe, screenHeight, seconds, story, tokens } from "./theme";

/**
 * Un video es una lista de escenas. `scripts/semana.mjs` la arma desde
 * plan/semanas.json y las grabaciones de la app real (public/capturas/).
 */
/** Una voz que suena `at` segundos después de que empieza su escena. */
export type Voice = { src: string; at: number };

export type Scene = (
  | { kind: "hook"; seconds: number; text: string; overline?: string }
  | { kind: "characterHook"; seconds: number; text: string; character: Character }
  /** Una grabación de la app a pantalla completa, como una grabación de pantalla. */
  | { kind: "clip"; seconds: number; src: string; startFrom?: number }
  /** Presentación: qué función es, arriba, y su grabación en una tarjeta. */
  | { kind: "feature"; seconds: number; step: number; text: string; src: string; startFrom?: number }
  | { kind: "verse"; seconds: number; text: string; reference: string }
  /** `qr`: imagen del QR a la página de descarga; `url`: esa dirección, para leerla. */
  | { kind: "closing"; seconds: number; lead: string; qr?: string; url?: string }
) & { voices?: Voice[] };

export type VideoProps = {
  scenes: Scene[];
};

export function videoLength(props: VideoProps) {
  return props.scenes.reduce((total, scene) => total + seconds(scene.seconds), 0);
}

function Fade({ length, fadeIn, children }: { length: number; fadeIn: boolean; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: sceneOpacity(frame, length, fadeIn) }}>{children}</AbsoluteFill>;
}

function Clip({ src, startFrom = 0 }: { src: string; startFrom?: number }) {
  return <OffthreadVideo src={staticFile(src)} startFrom={seconds(startFrom)} muted style={{ width: "100%", height: "100%" }} />;
}

function Feature({ step, text, src, startFrom }: { step: number; text: string; src: string; startFrom?: number }) {
  const frame = useCurrentFrame();
  const scale = (story.width - 2 * safe.left) / story.width;
  const cardHeight = screenHeight - story.verseMin * story.verseLineHeight - story.paddingX / 2;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: color.bg,
        paddingTop: safe.top,
        paddingBottom: safe.bottom,
        alignItems: "center",
        gap: story.paddingX / 2,
      }}
    >
      <div style={{ ...rise(frame, 0), alignSelf: "stretch", paddingLeft: safe.left, fontFamily: font.serif, fontSize: story.verseMin, color: color.ink }}>
        <span style={{ color: color.accent }}>{step} · </span>
        {text}
      </div>
      <div
        style={{
          width: story.width * scale,
          height: cardHeight,
          flexShrink: 0,
          overflow: "hidden",
          position: "relative",
          borderRadius: tokens.radius.xxl * appScale * scale,
          border: `${appScale}px solid ${color.borderStrong}`,
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: story.width, height: story.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <Clip src={src} startFrom={startFrom} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SceneView({ scene }: { scene: Scene }) {
  switch (scene.kind) {
    case "hook":
      return <Hook text={scene.text} overline={scene.overline} />;
    case "characterHook":
      return <CharacterHook text={scene.text} character={scene.character} />;
    case "clip":
      return <Clip src={scene.src} startFrom={scene.startFrom} />;
    case "feature":
      return <Feature step={scene.step} text={scene.text} src={scene.src} startFrom={scene.startFrom} />;
    case "verse":
      return <VerseCard text={scene.text} reference={scene.reference} />;
    case "closing":
      return <Closing lead={scene.lead} qr={scene.qr} url={scene.url} />;
  }
}

export function Video(props: VideoProps) {
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: color.bg }}>
      {props.scenes.map((scene, index) => {
        const length = seconds(scene.seconds);
        const start = from;
        from += length;
        return (
          <Sequence key={index} from={start} durationInFrames={length}>
            {/* El primer cuadro es la portada: el gancho se ve entero desde el principio. */}
            <Fade length={length} fadeIn={index > 0}>
              <SceneView scene={scene} />
            </Fade>
            {scene.voices?.map((voice) => (
              <Sequence key={voice.src} from={seconds(voice.at)} layout="none">
                <Audio src={staticFile(voice.src)} />
              </Sequence>
            ))}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
