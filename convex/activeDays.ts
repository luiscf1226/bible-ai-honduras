import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { addDays, hondurasDateKey } from "./devotional";

/**
 * Usuarios activos por día, semana y mes contados por cuenta, no por teléfono.
 * Cada cuenta guarda en su propia fila los días de Honduras en que abrió la
 * app o usó la IA, solo los últimos 30. No hace falta otra tabla: el borrado
 * de cuenta ya se lleva la fila, y nunca se guarda qué hizo ese día.
 */
export const ACTIVE_DAYS_KEPT = 30;

/** Agrega `today` y recorta a los últimos 30 días. `null` = ya estaba. */
export function withActiveDay(days: ReadonlyArray<string> | undefined, today: string): string[] | null {
  if (days?.includes(today)) return null;
  const oldest = addDays(today, 1 - ACTIVE_DAYS_KEPT);
  return [...(days ?? []).filter((day) => day >= oldest && day < today), today];
}

export async function markActive(ctx: MutationCtx, user: Doc<"users">, now = Date.now()): Promise<void> {
  const next = withActiveDay(user.activeDays, hondurasDateKey(now));
  if (next) await ctx.db.patch(user._id, { activeDays: next });
}

/** Cuentas activas en las ventanas de 1, 7 y 30 días que terminan en `day`. */
export function activeAccounts(
  users: ReadonlyArray<{ activeDays?: string[] }>,
  day: string,
): { day: number; week: number; month: number } {
  const since = (span: number) => {
    const from = addDays(day, 1 - span);
    return users.filter((user) => user.activeDays?.some((active) => active >= from && active <= day)).length;
  };
  return { day: since(1), week: since(7), month: since(30) };
}
