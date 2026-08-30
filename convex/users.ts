import {
  DEFAULT_BIBLE_VERSION,
  bibleVersionIsAvailable,
  resolveBibleVersion,
  type BibleVersion,
} from "./bibleVersions";
import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";

export const AI_CONSENT_VERSION = "2026-08-25";

// `identity.subject` (el user id de Clerk) es la llave de todo lo que es del
// usuario. Ninguna función de acá abajo confía en un userId que venga en los
// argumentos — eso sería una IDOR esperando a pasar.
async function requireIdentity(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("No autenticado");
  }
  return identity;
}

async function findByClerkId(ctx: QueryCtx, clerkId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

// Código de referido corto y determinístico a partir del id de Clerk —
// testeable sin depender de Math.random(). FNV-1a de 32 bits sobre el string
// completo (no solo un sufijo, para no tirar entropía). `referralCode` no
// tiene índice único: a la escala de este producto una colisión es
// despreciable, pero no está garantizada — si algún día se necesita, agregar
// un índice único + reintento en `upsert`.
export function makeReferralCode(clerkId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < clerkId.length; i++) {
    hash ^= clerkId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `BAH-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

// Se llama una vez desde el cliente justo después de que Clerk confirma la sesión.
// Crea el espejo local del usuario si no existe; si existe, refresca email/nombre
// por si cambiaron en Clerk. No toca preferencias (bibleVersion, reminderHour).
export const upsert = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await findByClerkId(ctx, identity.subject);

    if (existing) {
      const patch: Partial<{ email: string; name: string }> = {};
      if (identity.email && identity.email !== existing.email) {
        patch.email = identity.email;
      }
      if (identity.name && identity.name !== existing.name) {
        patch.name = identity.name;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email,
      name: identity.name,
      bibleVersion: "RVR1960",
      referralCode: makeReferralCode(identity.subject),
    });
  },
});

// Perfil del usuario autenticado. `null` si no hay sesión o si Clerk emitió
// un JWT válido pero `upsert` todavía no corrió (primer frame tras el login).
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return await findByClerkId(ctx, identity.subject);
  },
});

export const acceptAiConsent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await findByClerkId(ctx, identity.subject);
    if (!existing) {
      throw new ConvexError("Usuario no encontrado — llama a users.upsert primero");
    }
    const acceptedAt = Date.now();
    await ctx.db.patch(existing._id, {
      aiConsentAt: acceptedAt,
      aiConsentVersion: AI_CONSENT_VERSION,
    });
    return { acceptedAt, version: AI_CONSENT_VERSION };
  },
});

// Las actions de IA llaman esta query antes de consumir cuota o enviar texto.
export const requireAiConsent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await findByClerkId(ctx, identity.subject);
    if (!existing?.aiConsentAt || existing.aiConsentVersion !== AI_CONSENT_VERSION) {
      throw new ConvexError("AI_CONSENT_REQUIRED");
    }
    return true;
  },
});

/**
 * Devuelve a RVR1960 a los usuarios que alcanzaron a elegir NVI antes de que
 * se desactivara — #93 §4b. Sin esto quedan con una preferencia que la lectura
 * degrada en cada request pero que sigue guardada como NVI.
 *
 *   npx convex run users:migrateUnavailableBibleVersions '{}'
 */
export const migrateUnavailableBibleVersions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let migrated = 0;
    for (const user of users) {
      if (bibleVersionIsAvailable(user.bibleVersion)) {
        continue;
      }
      await ctx.db.patch(user._id, { bibleVersion: DEFAULT_BIBLE_VERSION });
      migrated += 1;
    }
    return { scanned: users.length, migrated };
  },
});

export const updatePreferences = mutation({
  args: {
    bibleVersion: v.optional(v.union(v.literal("RVR1960"), v.literal("NVI"))),
    reminderHour: v.optional(v.number()),
    darkMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await findByClerkId(ctx, identity.subject);
    if (!existing) {
      throw new ConvexError("Usuario no encontrado — llamá a users.upsert primero");
    }
    if (
      args.reminderHour !== undefined &&
      (!Number.isInteger(args.reminderHour) || args.reminderHour < 0 || args.reminderHour > 23)
    ) {
      throw new ConvexError("reminderHour debe ser un entero entre 0 y 23");
    }

    const patch: Partial<{ bibleVersion: BibleVersion; reminderHour: number; darkMode: boolean }> = {};
    if (args.bibleVersion !== undefined) {
      // #93 §4b: el schema sigue aceptando NVI (hay filas viejas que la tienen),
      // pero sin corpus ingerido no se puede guardar como preferencia nueva.
      // Se coerce en vez de lanzar para no romper builds ya instaladas en la beta.
      patch.bibleVersion = resolveBibleVersion(args.bibleVersion) as BibleVersion;
    }
    if (args.reminderHour !== undefined) {
      patch.reminderHour = args.reminderHour;
    }
    if (args.darkMode !== undefined) {
      patch.darkMode = args.darkMode;
    }
    await ctx.db.patch(existing._id, patch);
  },
});
