/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    aiCalls: {
      purgeOld: FunctionReference<
        "mutation",
        "internal",
        { retentionDays: number },
        any,
        Name
      >;
      record: FunctionReference<
        "mutation",
        "internal",
        {
          errorKind?: string;
          feature: string;
          inputTokens: number;
          latencyMs: number;
          model: string;
          ok: boolean;
          outputTokens: number;
          provider: string;
        },
        any,
        Name
      >;
      summary: FunctionReference<
        "query",
        "internal",
        { days: number },
        any,
        Name
      >;
    };
    counters: {
      bump: FunctionReference<
        "mutation",
        "internal",
        { by?: number; day: string; key: string },
        any,
        Name
      >;
      range: FunctionReference<
        "query",
        "internal",
        { fromDay: string; toDay: string },
        any,
        Name
      >;
    };
    events: {
      funnel: FunctionReference<
        "query",
        "internal",
        { days: number; names: Array<string> },
        any,
        Name
      >;
      importRows: FunctionReference<
        "mutation",
        "internal",
        {
          errors: Array<{
            at: number;
            build?: string;
            fatal: boolean;
            installId: string;
            message: string;
            platform: string;
            stack?: string;
          }>;
          events: Array<{
            at: number;
            build?: string;
            installId: string;
            module?: string;
            name: string;
            origin?: string;
            platform: string;
          }>;
        },
        any,
        Name
      >;
      purgeOld: FunctionReference<
        "mutation",
        "internal",
        { retentionDays: number },
        any,
        Name
      >;
      recentErrors: FunctionReference<
        "query",
        "internal",
        { limit: number },
        any,
        Name
      >;
      reportError: FunctionReference<
        "mutation",
        "internal",
        {
          build?: string;
          fatal: boolean;
          installId: string;
          message: string;
          platform: string;
          stack?: string;
        },
        any,
        Name
      >;
      track: FunctionReference<
        "mutation",
        "internal",
        {
          build?: string;
          installId: string;
          module?: string;
          name: string;
          origin?: string;
          platform: string;
        },
        any,
        Name
      >;
    };
    metrics: {
      read: FunctionReference<
        "query",
        "internal",
        { from: string; keys: Array<string>; to: string },
        any,
        Name
      >;
      store: FunctionReference<
        "mutation",
        "internal",
        {
          day: string;
          rows: Array<{ dim?: string; key: string; value: number }>;
        },
        any,
        Name
      >;
    };
    rollup: {
      standard: FunctionReference<
        "query",
        "internal",
        { day: string; endMs: number; startMs: number },
        any,
        Name
      >;
    };
  };
