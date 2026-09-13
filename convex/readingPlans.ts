import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { addDays, hondurasDateKey, parseDateKey } from "./devotional";
import {
  canonicalReadingPlan,
  findReadingPlan,
  JOURNEY_READING_PLANS,
  readingsForDay,
  SUPPORTED_READING_PLANS,
  type ReadingPlanDay,
  type ReadingPlanDefinition,
} from "./readingPlanCatalog";

/**
 * Planes de lectura: el anual canónico (#114) y los recorridos cortos por tema,
 * historia y sentimiento (#115). Gratis, sin cuota (no llama a
 * `convex/quotas.ts` — mismo criterio que el lector, #113). Cronológico,
 * M'Cheyne y "NT + Salmos" quedaron fuera a propósito.
 *
 * Un recorrido es un plan con menos días: mismo motor, mismas tablas. El
 * progreso es una fila por (usuario, plan), así que un recorrido se sigue a la
 * par del anual sin pisarlo.
 *
 * El "día de hoy" se calcula en America/Tegucigalpa reusando
 * `hondurasDateKey`/`parseDateKey`/`addDays` de `convex/devotional.ts` — no se
 * reimplementa esa aritmética acá.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

async function requireUser(ctx: QueryCtx): Promise<{ _id: Id<"users"> } | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to) - parseDateKey(from)) / DAY_MS);
}

/**
 * Día del plan (1-indexado) que le corresponde a `today` dado que el plan
 * arrancó en `startedAt`. Se aferra al calendario real, no al progreso
 * marcado: si el usuario no abre la app en varios días, el "día de hoy" sigue
 * avanzando — es lo que hace posible "ponerme al día" en vez de congelar el
 * plan en el último día visto.
 *
 * Clampeado a [1, totalDays]: un reloj de dispositivo adelantado o el día 366
 * en adelante no revientan el plan, simplemente muestran el último día.
 */
export function currentPlanDay(startedAt: string, today: string, totalDays: number): number {
  const elapsed = daysBetween(startedAt, today);
  const day = elapsed + 1;
  return Math.min(Math.max(day, 1), totalDays);
}

export type StreakState = {
  lastCompletedDate?: string;
  currentStreak: number;
  longestStreak: number;
};

/**
 * Transición de racha para "marcar como leído", evaluada contra la fecha real
 * (Honduras) de la acción — no contra el día del plan que se está marcando.
 *
 * Esto es deliberado por el punto sensible de UX del ticket: alguien que se
 * atrasó y se pone al día marcando 5 días pendientes en una sola sesión suma
 * *un* día de racha, no cinco. Inflar la racha por ponerse al día premiaría lo
 * contrario de un hábito diario real.
 */
export function nextStreakState(state: StreakState, today: string): StreakState {
  if (state.lastCompletedDate === today) {
    // Ya se marcó algo hoy (p. ej. varios días de atraso de una sentada): la
    // racha no vuelve a moverse.
    return { ...state, lastCompletedDate: today };
  }

  const isConsecutive = state.lastCompletedDate !== undefined && addDays(state.lastCompletedDate, 1) === today;
  const currentStreak = isConsecutive ? state.currentStreak + 1 : 1;
  return {
    lastCompletedDate: today,
    currentStreak,
    longestStreak: Math.max(state.longestStreak, currentStreak),
  };
}

export type ReadingPlanSummary = { id: string; name: string; description: string; totalDays: number };

function summarize(plan: ReadingPlanDefinition): ReadingPlanSummary {
  return { id: plan.id, name: plan.name, description: plan.description, totalDays: plan.totalDays };
}

/**
 * Metadatos de un plan, sin sesión. Sin `planId` devuelve el canónico (así lo
 * llamaba la pantalla del plan anual antes de #115). null si el plan no existe.
 */
export const catalog = query({
  args: { planId: v.optional(v.string()) },
  handler: async (_ctx, args): Promise<ReadingPlanSummary | null> => {
    const plan = findReadingPlan(args.planId ?? canonicalReadingPlan.id);
    return plan ? summarize(plan) : null;
  },
});

/** Catálogo de recorridos cortos (#115), en orden de presentación. Sin sesión. */
export const journeys = query({
  args: {},
  handler: async (): Promise<ReadingPlanSummary[]> => JOURNEY_READING_PLANS.map(summarize),
});

/**
 * Siembra la copia servible de cada plan soportado en la tabla `readingPlans`
 * — idempotente, igual patrón que `devotional.ensureWindow`. No pisa una fila
 * existente: dejar espacio para que el contenido se cure a mano en la base sin
 * que un redeploy lo revierta. Devuelve los ids que sembró en esta corrida.
 */
export const ensurePlanSeeded = internalMutation({
  args: {},
  handler: async (ctx) => {
    const seeded: string[] = [];
    for (const plan of SUPPORTED_READING_PLANS) {
      const existing = await ctx.db
        .query("readingPlans")
        .withIndex("by_plan_id", (q) => q.eq("planId", plan.id))
        .unique();
      if (existing) {
        continue;
      }
      await ctx.db.insert("readingPlans", {
        planId: plan.id,
        name: plan.name,
        description: plan.description,
        totalDays: plan.totalDays,
        days: plan.days,
      });
      seeded.push(plan.id);
    }
    return { seeded };
  },
});

type ProgressRow = {
  _id: Id<"userPlanProgress">;
  planId: string;
  startedAt: string;
  completedDays: number[];
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate?: string;
};

async function findProgress(ctx: QueryCtx, userId: Id<"users">, planId: string): Promise<ProgressRow | null> {
  return await ctx.db
    .query("userPlanProgress")
    .withIndex("by_user_plan", (q) => q.eq("userId", userId).eq("planId", planId))
    .unique();
}

/**
 * Elige un plan y arranca desde el día 1 hoy. Si ya había progreso en *ese*
 * plan, se reemplaza (no se lleva historial de intentos abandonados). El
 * progreso en otros planes no se toca: un recorrido corto no pisa el anual.
 */
export const start = mutation({
  args: { planId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    const planId = args.planId ?? canonicalReadingPlan.id;
    if (!findReadingPlan(planId)) {
      throw new ConvexError(`Plan desconocido: ${planId}`);
    }

    const existing = await findProgress(ctx, user._id, planId);
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return await ctx.db.insert("userPlanProgress", {
      userId: user._id,
      planId,
      startedAt: hondurasDateKey(),
      completedDays: [],
      currentStreak: 0,
      longestStreak: existing?.longestStreak ?? 0,
    });
  },
});

export type MyPlanProgress = {
  plan: ReadingPlanSummary;
  startedAt: string;
  currentDay: number;
  todayReadings: ReadingPlanDay["readings"];
  todayCompleted: boolean;
  completedCount: number;
  currentStreak: number;
  longestStreak: number;
  /**
   * Días anteriores al de hoy que quedaron sin marcar, del más viejo al más
   * nuevo. Es la data de "ponerme al día" — la pantalla la muestra como
   * "seguí desde donde estés" con la lista de lecturas pendientes, sin un
   * contador de días de atraso (issue #114, punto sensible de UX).
   */
  pendingDays: ReadingPlanDay[];
};

function buildProgress(progress: ProgressRow, plan: ReadingPlanDefinition, today: string): MyPlanProgress {
  const currentDay = currentPlanDay(progress.startedAt, today, plan.totalDays);
  const completed = new Set(progress.completedDays);
  const pendingDays = plan.days.filter((entry) => entry.day < currentDay && !completed.has(entry.day));

  return {
    plan: summarize(plan),
    startedAt: progress.startedAt,
    currentDay,
    todayReadings: readingsForDay(plan, currentDay),
    todayCompleted: completed.has(currentDay),
    completedCount: progress.completedDays.length,
    currentStreak: progress.currentStreak,
    longestStreak: progress.longestStreak,
    pendingDays,
  };
}

/**
 * Progreso en un plan (por defecto el canónico). null si no hay sesión o si el
 * usuario todavía no empezó ese plan.
 */
export const myProgress = query({
  args: { planId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<MyPlanProgress | null> => {
    const user = await requireUser(ctx);
    if (!user) {
      return null;
    }
    const plan = findReadingPlan(args.planId ?? canonicalReadingPlan.id);
    if (!plan) {
      return null;
    }
    const progress = await findProgress(ctx, user._id, plan.id);
    if (!progress) {
      return null;
    }
    return buildProgress(progress, plan, hondurasDateKey());
  },
});

/**
 * Todos los planes que el usuario tiene empezados (anual y recorridos), en el
 * orden del catálogo. Vacío sin sesión. Una fila vieja de un plan que ya no
 * existe en el catálogo se omite en vez de reventar.
 */
export const myPlans = query({
  args: {},
  handler: async (ctx): Promise<MyPlanProgress[]> => {
    const user = await requireUser(ctx);
    if (!user) {
      return [];
    }
    const rows = await ctx.db
      .query("userPlanProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const today = hondurasDateKey();
    return SUPPORTED_READING_PLANS.flatMap((plan) => {
      const row = rows.find((candidate) => candidate.planId === plan.id);
      return row ? [buildProgress(row, plan, today)] : [];
    });
  },
});

/**
 * Marca un día de un plan como leído — puede ser el día de hoy o un día
 * pendiente de atrás (ponerse al día). La racha se actualiza contra la fecha
 * real de hoy, no contra el día que se está marcando (ver `nextStreakState`).
 *
 * `planId` es opcional solo por compatibilidad con clientes de #114 (que
 * únicamente conocían el canónico); las pantallas nuevas siempre lo mandan.
 */
export const markDayRead = mutation({
  args: { planId: v.optional(v.string()), day: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    const planId = args.planId ?? canonicalReadingPlan.id;
    const plan = findReadingPlan(planId);
    if (!plan) {
      throw new ConvexError(`Plan desconocido: ${planId}`);
    }
    const progress = await findProgress(ctx, user._id, plan.id);
    if (!progress) {
      throw new ConvexError("Ese plan no está empezado — empezalo primero");
    }
    if (!Number.isInteger(args.day) || args.day < 1 || args.day > plan.totalDays) {
      throw new ConvexError(`day debe ser un entero entre 1 y ${plan.totalDays}`);
    }

    const completedDays = progress.completedDays.includes(args.day)
      ? progress.completedDays
      : [...progress.completedDays, args.day].sort((a, b) => a - b);

    const today = hondurasDateKey();
    const streak = nextStreakState(progress, today);

    await ctx.db.patch(progress._id, {
      completedDays,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastCompletedDate: streak.lastCompletedDate,
    });

    return { completedDays, ...streak };
  },
});

/**
 * Borra el progreso de todos los planes del usuario — cascada de borrado de
 * cuenta (#107). Desde #115 hay una fila por plan empezado, así que no puede
 * ser `.unique()`. Las filas están acotadas por el tamaño del catálogo (una
 * por plan soportado), así que entran holgadas en una sola pasada.
 */
export async function deleteReadingPlanDataForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ deleted: number }> {
  const rows = await ctx.db
    .query("userPlanProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return { deleted: rows.length };
}
