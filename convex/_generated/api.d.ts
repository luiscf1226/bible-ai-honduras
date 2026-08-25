/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as devotional from "../devotional.js";
import type * as devotionalCatalog from "../devotionalCatalog.js";
import type * as entitlements from "../entitlements.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as quotas from "../quotas.js";
import type * as rag_embed from "../rag/embed.js";
import type * as rag_ingest from "../rag/ingest.js";
import type * as rag_verses from "../rag/verses.js";
import type * as users from "../users.js";
import type * as voices from "../voices.js";
import type * as voicesCatalog from "../voicesCatalog.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  devotional: typeof devotional;
  devotionalCatalog: typeof devotionalCatalog;
  entitlements: typeof entitlements;
  history: typeof history;
  http: typeof http;
  quotas: typeof quotas;
  "rag/embed": typeof rag_embed;
  "rag/ingest": typeof rag_ingest;
  "rag/verses": typeof rag_verses;
  users: typeof users;
  voices: typeof voices;
  voicesCatalog: typeof voicesCatalog;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
