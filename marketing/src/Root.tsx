import { Composition } from "remotion";

import { FPS, story } from "./theme";
import { Video, type VideoProps, videoLength } from "./Video";

const preview: VideoProps = {
  scenes: [
    { kind: "hook", seconds: 2, text: "¿Qué dice la Biblia cuando no podés dejar de preocuparte?" },
    { kind: "verse", seconds: 4, text: "Por nada estéis afanosos.", reference: "Filipenses 4:6 · RV1909" },
    { kind: "closing", seconds: 3, lead: "Preguntale lo que quieras." },
  ],
};

/** Una sola composición: cada video llega como props desde `scripts/semana.mjs`. */
export function Root() {
  return (
    <Composition
      id="video"
      component={Video}
      fps={FPS}
      width={story.width}
      height={story.height}
      durationInFrames={videoLength(preview)}
      defaultProps={preview}
      calculateMetadata={({ props }) => ({ durationInFrames: videoLength(props) })}
    />
  );
}
