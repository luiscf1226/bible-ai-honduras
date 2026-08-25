export type StorySceneImage = {
  status: "generating" | "ready" | "unavailable";
  uri?: string;
};

export type StorySceneImages = Readonly<Record<string, StorySceneImage | undefined>>;

/**
 * Una URI sólo se considera lista cuando el generador la entregó. Así el visor
 * nunca presenta una ranura vacía como una ilustración ya creada.
 */
export function resolveSceneImage(sceneId: string, images: StorySceneImages): StorySceneImage {
  const image = images[sceneId];
  if (image?.status === "ready" && image.uri) {
    return image;
  }
  if (image?.status === "generating") {
    return image;
  }
  return { status: "unavailable" };
}
