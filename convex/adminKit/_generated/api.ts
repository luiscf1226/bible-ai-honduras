/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiCalls from "../aiCalls.js";
import type * as contract from "../contract.js";
import type * as counters from "../counters.js";
import type * as events from "../events.js";
import type * as httpHandler from "../httpHandler.js";
import type * as meter from "../meter.js";
import type * as metrics from "../metrics.js";
import type * as pricing from "../pricing.js";
import type * as rollup from "../rollup.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  aiCalls: typeof aiCalls;
  contract: typeof contract;
  counters: typeof counters;
  events: typeof events;
  httpHandler: typeof httpHandler;
  meter: typeof meter;
  metrics: typeof metrics;
  pricing: typeof pricing;
  rollup: typeof rollup;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {};
