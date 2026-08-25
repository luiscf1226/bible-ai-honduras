import { shareContent } from "../../lib/share";

type StoryForShare = {
  reference: string;
  scenes: readonly unknown[];
  title: string;
};

/** Contenido editorial de la historia; el link y el share sheet son responsabilidad de src/lib/share.ts. */
export function buildStoryShareText(story: StoryForShare): string {
  return `${story.title} — en ${story.scenes.length} escenas ilustradas.\n${story.reference} · Historia ilustrada · Bible AI`;
}

export async function shareStory(params: { story: StoryForShare; referralCode: string }): Promise<void> {
  await shareContent({
    referralCode: params.referralCode,
    text: buildStoryShareText(params.story),
  });
}
