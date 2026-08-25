import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

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

    const patch: Partial<{ bibleVersion: "RVR1960" | "NVI"; reminderHour: number; darkMode: boolean }> = {};
    if (args.bibleVersion !== undefined) {
      patch.bibleVersion = args.bibleVersion;
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
