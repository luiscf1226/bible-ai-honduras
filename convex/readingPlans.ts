import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { addDays, hondurasDateKey, parseDateKey } from "./devotional";
import {
  canonicalReadingPlan,
  findReadingPlan,
  readingsForDay,
  type ReadingPlanDay,
} from "./readingPlanCatalog";

/**
 * Plan de lectura anual (#114): gratis, sin cuota (no llama a
 * `convex/quotas.ts` — mismo criterio que el lector, #113) y anclado al único
 * plan soportado en v1, el canónico (Génesis → Apocalipsis). Cronológico,
 * M'Cheyne y "NT + Salmos" quedaron fuera de esta primera versión a propósito.
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

/** Metadatos del plan canónico — hoy es el único soportado (v1). */
export const catalog = query({
  args: {},
  handler: async () => {
    const plan = canonicalReadingPlan;
    return { id: plan.id, name: plan.name, description: plan.description, totalDays: plan.totalDays };
  },
});

/**
 * Siembra la copia servible del plan en la tabla `readingPlans` — idempotente,
 * igual patrón que `devotional.ensureWindow`. No pisa una fila existente: dejar
 * espacio para que el contenido se cure a mano en la base sin que un redeploy
 * lo revierta.
 */
export const ensurePlanSeeded = internalMutation({
  args: {},
  handler: async (ctx) => {
    const plan = canonicalReadingPlan;
    const existing = await ctx.db
      .query("readingPlans")
      .withIndex("by_plan_id", (q) => q.eq("planId", plan.id))
      .unique();
    if (existing) {
      return { seeded: false };
    }
    await ctx.db.insert("readingPlans", {
      planId: plan.id,
      name: plan.name,
      description: plan.description,
      totalDays: plan.totalDays,
      days: plan.days,
    });
    return { seeded: true };
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

async function findProgress(ctx: QueryCtx, userId: Id<"users">): Promise<ProgressRow | null> {
  return await ctx.db
    .query("userPlanProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * Elige un plan y arranca desde el día 1 hoy. Si ya había progreso (en el
 * mismo plan u otro), se reemplaza — v1 no lleva historial de planes
 * abandonados, y "elegir un plan" siempre fija una fecha de inicio nueva.
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

    const existing = await findProgress(ctx, user._id);
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
  plan: { id: string; name: string; description: string; totalDays: number };
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

/** null si no hay sesión o si el usuario todavía no eligió un plan. */
export const myProgress = query({
  args: {},
  handler: async (ctx): Promise<MyPlanProgress | null> => {
    const user = await requireUser(ctx);
    if (!user) {
      return null;
    }
    const progress = await findProgress(ctx, user._id);
    if (!progress) {
      return null;
    }
    const plan = findReadingPlan(progress.planId);
    if (!plan) {
      // No debería pasar en v1 (un solo plan soportado), pero si el plan activo
      // de una fila vieja ya no existe, mejor decir "no hay plan" que reventar.
      return null;
    }

    const today = hondurasDateKey();
    const currentDay = currentPlanDay(progress.startedAt, today, plan.totalDays);
    const completed = new Set(progress.completedDays);
    const pendingDays = plan.days.filter((entry) => entry.day < currentDay && !completed.has(entry.day));

    return {
      plan: { id: plan.id, name: plan.name, description: plan.description, totalDays: plan.totalDays },
      startedAt: progress.startedAt,
      currentDay,
      todayReadings: readingsForDay(plan, currentDay),
      todayCompleted: completed.has(currentDay),
      completedCount: progress.completedDays.length,
      currentStreak: progress.currentStreak,
      longestStreak: progress.longestStreak,
      pendingDays,
    };
  },
});

/**
 * Marca un día del plan como leído — puede ser el día de hoy o un día
 * pendiente de atrás (ponerse al día). La racha se actualiza contra la fecha
 * real de hoy, no contra el día que se está marcando (ver `nextStreakState`).
 */
export const markDayRead = mutation({
  args: { day: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    const progress = await findProgress(ctx, user._id);
    if (!progress) {
      throw new ConvexError("No hay un plan activo — elegí un plan primero");
    }
    const plan = findReadingPlan(progress.planId);
    if (!plan) {
      throw new ConvexError(`Plan desconocido: ${progress.planId}`);
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

/** Borra el progreso de plan del usuario — cascada de borrado de cuenta (#107). */
export async function deleteReadingPlanDataForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ deleted: number }> {
  const existing = await ctx.db
    .query("userPlanProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!existing) {
    return { deleted: 0 };
  }
  await ctx.db.delete(existing._id);
  return { deleted: 1 };
}
