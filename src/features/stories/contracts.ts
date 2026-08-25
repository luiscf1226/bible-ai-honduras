import type { FunctionReference } from "convex/server";

import { api } from "../../../convex/_generated/api";
import type { StoryCatalogItem } from "../../../convex/stories";

export type { StoryCatalogItem, StoryScene } from "../../../convex/stories";

type StoriesApi = {
  stories: {
    getById: FunctionReference<"query", "public", { storyId: string }, StoryCatalogItem | null>;
    list: FunctionReference<"query", "public", Record<string, never>, readonly StoryCatalogItem[]>;
  };
};

// Convex no puede regenerar `api` en este worktree sin CONVEX_DEPLOYMENT. El
// proxy generado existente resuelve estos endpoints al desplegarse; este tipo
// conserva el contrato de #23 sin editar código generado.
export const storiesApi = api as unknown as StoriesApi;
