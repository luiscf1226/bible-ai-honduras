import { query } from "./_generated/server";
import { voiceCharacters } from "./voicesCatalog";

export const list = query({
  args: {},
  handler: async () => voiceCharacters,
});
