/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appVersion from "../appVersion.js";
import type * as bibleVersions from "../bibleVersions.js";
import type * as crons from "../crons.js";
import type * as devotional from "../devotional.js";
import type * as devotionalCatalog from "../devotionalCatalog.js";
import type * as devotionals_01_enero from "../devotionals/01_enero.js";
import type * as devotionals_02_febrero from "../devotionals/02_febrero.js";
import type * as devotionals_03_marzo from "../devotionals/03_marzo.js";
import type * as devotionals_04_abril from "../devotionals/04_abril.js";
import type * as devotionals_05_mayo from "../devotionals/05_mayo.js";
import type * as devotionals_06_junio from "../devotionals/06_junio.js";
import type * as devotionals_07_julio from "../devotionals/07_julio.js";
import type * as devotionals_08_agosto from "../devotionals/08_agosto.js";
import type * as devotionals_09_septiembre from "../devotionals/09_septiembre.js";
import type * as devotionals_10_octubre from "../devotionals/10_octubre.js";
import type * as devotionals_11_noviembre from "../devotionals/11_noviembre.js";
import type * as devotionals_12_diciembre from "../devotionals/12_diciembre.js";
import type * as devotionals_index from "../devotionals/index.js";
import type * as devotionals_types from "../devotionals/types.js";
import type * as entitlements from "../entitlements.js";
import type * as feelings from "../feelings.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as memorize from "../memorize.js";
import type * as memorizeSchedule from "../memorizeSchedule.js";
import type * as offlineBible from "../offlineBible.js";
import type * as offlineBiblePackage from "../offlineBiblePackage.js";
import type * as prayers from "../prayers.js";
import type * as qa from "../qa.js";
import type * as quotas from "../quotas.js";
import type * as rag_answer from "../rag/answer.js";
import type * as rag_commentary from "../rag/commentary.js";
import type * as rag_corpusCheck from "../rag/corpusCheck.js";
import type * as rag_embed from "../rag/embed.js";
import type * as rag_groupGuide from "../rag/groupGuide.js";
import type * as rag_ingest from "../rag/ingest.js";
import type * as rag_llm from "../rag/llm.js";
import type * as rag_prompts_groupGuide from "../rag/prompts/groupGuide.js";
import type * as rag_prompts_qa from "../rag/prompts/qa.js";
import type * as rag_retrieve from "../rag/retrieve.js";
import type * as rag_verses from "../rag/verses.js";
import type * as reading from "../reading.js";
import type * as readingGroupCore from "../readingGroupCore.js";
import type * as readingGroups from "../readingGroups.js";
import type * as readingPlanCatalog from "../readingPlanCatalog.js";
import type * as readingPlans from "../readingPlans.js";
import type * as referralCode from "../referralCode.js";
import type * as referrals from "../referrals.js";
import type * as savedMemory from "../savedMemory.js";
import type * as seasons from "../seasons.js";
import type * as seasonsDraftCatalog from "../seasonsDraftCatalog.js";
import type * as stories from "../stories.js";
import type * as telemetry from "../telemetry.js";
import type * as textStories from "../textStories.js";
import type * as textStoriesCatalog from "../textStoriesCatalog.js";
import type * as users from "../users.js";
import type * as voices from "../voices.js";
import type * as voicesCatalog from "../voicesCatalog.js";
import type * as voicesGuardrail from "../voicesGuardrail.js";
import type * as voicesPrompt from "../voicesPrompt.js";
import type * as yearInWord from "../yearInWord.js";
import type * as yearInWordCore from "../yearInWordCore.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appVersion: typeof appVersion;
  bibleVersions: typeof bibleVersions;
  crons: typeof crons;
  devotional: typeof devotional;
  devotionalCatalog: typeof devotionalCatalog;
  "devotionals/01_enero": typeof devotionals_01_enero;
  "devotionals/02_febrero": typeof devotionals_02_febrero;
  "devotionals/03_marzo": typeof devotionals_03_marzo;
  "devotionals/04_abril": typeof devotionals_04_abril;
  "devotionals/05_mayo": typeof devotionals_05_mayo;
  "devotionals/06_junio": typeof devotionals_06_junio;
  "devotionals/07_julio": typeof devotionals_07_julio;
  "devotionals/08_agosto": typeof devotionals_08_agosto;
  "devotionals/09_septiembre": typeof devotionals_09_septiembre;
  "devotionals/10_octubre": typeof devotionals_10_octubre;
  "devotionals/11_noviembre": typeof devotionals_11_noviembre;
  "devotionals/12_diciembre": typeof devotionals_12_diciembre;
  "devotionals/index": typeof devotionals_index;
  "devotionals/types": typeof devotionals_types;
  entitlements: typeof entitlements;
  feelings: typeof feelings;
  history: typeof history;
  http: typeof http;
  images: typeof images;
  memorize: typeof memorize;
  memorizeSchedule: typeof memorizeSchedule;
  offlineBible: typeof offlineBible;
  offlineBiblePackage: typeof offlineBiblePackage;
  prayers: typeof prayers;
  qa: typeof qa;
  quotas: typeof quotas;
  "rag/answer": typeof rag_answer;
  "rag/commentary": typeof rag_commentary;
  "rag/corpusCheck": typeof rag_corpusCheck;
  "rag/embed": typeof rag_embed;
  "rag/groupGuide": typeof rag_groupGuide;
  "rag/ingest": typeof rag_ingest;
  "rag/llm": typeof rag_llm;
  "rag/prompts/groupGuide": typeof rag_prompts_groupGuide;
  "rag/prompts/qa": typeof rag_prompts_qa;
  "rag/retrieve": typeof rag_retrieve;
  "rag/verses": typeof rag_verses;
  reading: typeof reading;
  readingGroupCore: typeof readingGroupCore;
  readingGroups: typeof readingGroups;
  readingPlanCatalog: typeof readingPlanCatalog;
  readingPlans: typeof readingPlans;
  referralCode: typeof referralCode;
  referrals: typeof referrals;
  savedMemory: typeof savedMemory;
  seasons: typeof seasons;
  seasonsDraftCatalog: typeof seasonsDraftCatalog;
  stories: typeof stories;
  telemetry: typeof telemetry;
  textStories: typeof textStories;
  textStoriesCatalog: typeof textStoriesCatalog;
  users: typeof users;
  voices: typeof voices;
  voicesCatalog: typeof voicesCatalog;
  voicesGuardrail: typeof voicesGuardrail;
  voicesPrompt: typeof voicesPrompt;
  yearInWord: typeof yearInWord;
  yearInWordCore: typeof yearInWordCore;
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
