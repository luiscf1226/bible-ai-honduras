import {
  DEFAULT_BIBLE_VERSION,
  bibleVersionIsAvailable,
  resolveBibleVersion,
  type BibleVersion,
} from "./bibleVersions";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { deleteConversationsForUser } from "./history";
import { deleteReadingDataForUser } from "./reading";
import { deleteReadingPlanDataForUser } from "./readingPlans";

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
      const patch: Partial<{ email: string; name: string; onboardedAt: number }> = {};
      if (identity.email && identity.email !== existing.email) {
        patch.email = identity.email;
      }
      if (identity.name && identity.name !== existing.name) {
        patch.name = identity.name;
      }
      // Red de seguridad de la migración de #124: quien ya aceptó el consentimiento
      // de IA obviamente pasó por el onboarding, aunque su fila sea anterior al
      // campo. Si `migrateOnboardedFromConsent` no se corrió en el deploy, esto lo
      // cubre igual en el primer arranque — es idempotente y no pisa un valor ya
      // escrito.
      if (existing.onboardedAt === undefined && existing.aiConsentAt !== undefined) {
        patch.onboardedAt = existing.aiConsentAt;
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
      bibleVersion: DEFAULT_BIBLE_VERSION,
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

/**
 * Marca que el usuario ya vio el onboarding — #124.
 *
 * La llaman las DOS salidas de `app/(auth)/onboarding.tsx`: terminar el último
 * paso y "Saltar". Saltar también cuenta: el usuario decidió no verlo, y
 * volvérselo a mostrar en el próximo login es exactamente el bug reportado.
 *
 * Idempotente y no regresiva: si ya había marca, se conserva la original para
 * que la fecha siga significando "la primera vez que lo vio".
 */
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await findByClerkId(ctx, identity.subject);
    if (!existing) {
      throw new ConvexError("Usuario no encontrado — llamá a users.upsert primero");
    }
    if (existing.onboardedAt !== undefined) {
      return { onboardedAt: existing.onboardedAt };
    }
    const onboardedAt = Date.now();
    await ctx.db.patch(existing._id, { onboardedAt });
    return { onboardedAt };
  },
});

/**
 * Migración de #124. `onboardedAt` no existía: sin esto, todo usuario ya
 * registrado vería el onboarding una vez más al actualizar, que es justo el
 * síntoma que el issue arregla.
 *
 * Haber aceptado el consentimiento de IA (`aiConsentAt`) implica haber pasado
 * por el onboarding, porque esa pantalla es la única que lleva a
 * `/consentimiento-ia`. Se copia esa fecha en vez de usar `Date.now()` para no
 * inventar una marca temporal que nunca ocurrió.
 *
 * Correr una vez, ANTES de publicar el build:
 *   npx convex run users:migrateOnboardedFromConsent '{}'
 */
export const migrateOnboardedFromConsent = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let migrated = 0;
    for (const user of users) {
      if (user.onboardedAt !== undefined || user.aiConsentAt === undefined) {
        continue;
      }
      await ctx.db.patch(user._id, { onboardedAt: user.aiConsentAt });
      migrated += 1;
    }
    return { scanned: users.length, migrated };
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

/**
 * Techo de los pasos de lectura. El cliente ya los clampea
 * (`clampFontStep` / `clampSpacingStep`), pero el servidor no confía en el
 * cliente: un paso absurdo se rechaza en vez de guardarse.
 */
const MAX_READING_STEP = 9;

export const updatePreferences = mutation({
  args: {
    bibleVersion: v.optional(v.union(v.literal("RV1909"), v.literal("RVR1960"), v.literal("NVI"))),
    reminderHour: v.optional(v.number()),
    darkMode: v.optional(v.boolean()),
    // Controles del lector (#113). Son índices de paso, no tamaños: el px
    // sale del token en src/features/reading/readingSettings.ts.
    readingFontStep: v.optional(v.number()),
    readingSpacingStep: v.optional(v.number()),
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

    for (const [name, step] of [
      ["readingFontStep", args.readingFontStep],
      ["readingSpacingStep", args.readingSpacingStep],
    ] as const) {
      if (step !== undefined && (!Number.isInteger(step) || step < 0 || step > MAX_READING_STEP)) {
        throw new ConvexError(`${name} debe ser un entero entre 0 y ${MAX_READING_STEP}`);
      }
    }

    const patch: Partial<{
      bibleVersion: BibleVersion;
      reminderHour: number;
      darkMode: boolean;
      readingFontStep: number;
      readingSpacingStep: number;
    }> = {};
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
    if (args.readingFontStep !== undefined) {
      patch.readingFontStep = args.readingFontStep;
    }
    if (args.readingSpacingStep !== undefined) {
      patch.readingSpacingStep = args.readingSpacingStep;
    }
    await ctx.db.patch(existing._id, patch);
  },
});

// ── Eliminar mi cuenta (#107 · App Store 5.1.1(v)) ──────────
//
// Tablas del schema que apuntan al usuario y por lo tanto se borran acá:
//   users          → la fila espejo (última, cuando ya no queda nada más)
//   conversations  → vía history.deleteConversationsForUser (#35)
//   messages       → idem (hijos de conversations)
//   usage          → contadores de cuota (transversal #15/#20/#24/#29)
//   entitlements   → fila de Pro; NO cancela la suscripción de la tienda
//   stories        → la fila y además cada blob de `_storage` de sus escenas
//   reading*       → marcador, recientes y guardados del lector (#112/#113)
//   userPlanProgress → progreso en planes de lectura, una fila por plan (#114/#115)
// `verses`, `commentaries`, `dailyDevotionals` y `readingPlans` son contenido
// editorial global: no tienen userId y no se tocan.

const PURGE_BUDGET = 256; // filas por transacción
const PURGE_MAX_PASSES = 200; // techo duro: 200 × 256 ≈ 51k filas

export type PurgeCounts = {
  messages: number;
  conversations: number;
  usage: number;
  entitlements: number;
  stories: number;
  storyImages: number;
  readingProgress: number;
  readingRecents: number;
  readingBookmarks: number;
  readingPlanProgress: number;
  users: number;
};

export type ClerkDeletionStatus = "deleted" | "not_configured" | "failed";

export type DeleteAccountResult = {
  /**
   * ok                → datos borrados y usuario de Clerk borrado.
   * clerk_pendiente   → datos borrados, pero la identidad de Clerk sobrevive.
   *                     La UI debe avisar y cerrar sesión igual.
   * datos_incompletos → quedó data sin borrar; la UI no cierra sesión y pide
   *                     reintentar (la identidad de Clerk sigue viva a propósito).
   */
  status: "ok" | "clerk_pendiente" | "datos_incompletos";
  clerk: ClerkDeletionStatus;
  deleted: PurgeCounts;
};

function emptyPurgeCounts(): PurgeCounts {
  return {
    messages: 0,
    conversations: 0,
    usage: 0,
    entitlements: 0,
    stories: 0,
    storyImages: 0,
    readingProgress: 0,
    readingRecents: 0,
    readingBookmarks: 0,
    readingPlanProgress: 0,
    users: 0,
  };
}

async function deleteUsageForUser(ctx: MutationCtx, userId: Id<"users">, budget: number) {
  const rowsOf = (limit: number) =>
    ctx.db
      .query("usage")
      .withIndex("by_user_module_day", (q) => q.eq("userId", userId))
      .take(limit);

  let deleted = 0;
  while (deleted < budget) {
    const page = await rowsOf(Math.min(budget - deleted, 128));
    if (page.length === 0) {
      return { deleted, done: true };
    }
    for (const row of page) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
  }
  return { deleted, done: (await rowsOf(1)).length === 0 };
}

async function deleteEntitlementsForUser(ctx: MutationCtx, userId: Id<"users">, budget: number) {
  const rowsOf = (limit: number) =>
    ctx.db
      .query("entitlements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(limit);

  let deleted = 0;
  while (deleted < budget) {
    const page = await rowsOf(Math.min(budget - deleted, 128));
    if (page.length === 0) {
      return { deleted, done: true };
    }
    for (const row of page) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
  }
  return { deleted, done: (await rowsOf(1)).length === 0 };
}

/**
 * Historias + los blobs de `_storage` de sus escenas. Cada historia se borra
 * completa (blobs primero, después la fila) para que un corte a mitad no deje
 * un blob sin dueño ni una fila apuntando a un blob que ya no está.
 */
async function deleteStoriesForUser(ctx: MutationCtx, userId: Id<"users">, budget: number) {
  let stories = 0;
  let storyImages = 0;
  let spent = 0;

  const nextStory = () =>
    ctx.db
      .query("stories")
      .withIndex("by_user_catalog", (q) => q.eq("userId", userId))
      .first();

  while (spent < budget) {
    const story = await nextStory();
    if (!story) {
      return { stories, storyImages, done: true };
    }
    for (const scene of story.scenes) {
      if (!scene.storageId) {
        continue;
      }
      try {
        await ctx.storage.delete(scene.storageId);
        storyImages += 1;
      } catch {
        // El blob ya no existe (reintento, o borrado a mano). La fila se va
        // igual: dejarla viva sería peor que no contar este blob.
      }
      spent += 1;
    }
    await ctx.db.delete(story._id);
    stories += 1;
    spent += 1;
  }

  return { stories, storyImages, done: (await nextStory()) === null };
}

/**
 * Una pasada del borrado en cascada. Interna: el `clerkId` lo pone la action a
 * partir de `identity.subject`, nunca el cliente — un argumento así expuesto
 * al cliente sería una IDOR con forma de "borrame la cuenta de otro".
 */
export const purgeAccountData = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args): Promise<{ done: boolean; deleted: PurgeCounts }> => {
    const deleted = emptyPurgeCounts();
    const user = await findByClerkId(ctx, args.clerkId);
    if (!user) {
      // Ya no queda nada que borrar (reintento después de una pasada completa).
      return { done: true, deleted };
    }

    const conversations = await deleteConversationsForUser(ctx, user._id, PURGE_BUDGET);
    deleted.conversations = conversations.deletedConversations;
    deleted.messages = conversations.deletedMessages;

    const stories = await deleteStoriesForUser(ctx, user._id, PURGE_BUDGET);
    deleted.stories = stories.stories;
    deleted.storyImages = stories.storyImages;

    const usage = await deleteUsageForUser(ctx, user._id, PURGE_BUDGET);
    deleted.usage = usage.deleted;

    const entitlements = await deleteEntitlementsForUser(ctx, user._id, PURGE_BUDGET);
    deleted.entitlements = entitlements.deleted;

    const reading = await deleteReadingDataForUser(ctx, user._id, PURGE_BUDGET);
    deleted.readingProgress = reading.deleted.progress;
    deleted.readingRecents = reading.deleted.recents;
    deleted.readingBookmarks = reading.deleted.bookmarks;

    const readingPlan = await deleteReadingPlanDataForUser(ctx, user._id);
    deleted.readingPlanProgress = readingPlan.deleted;

    const childrenDone =
      conversations.done && stories.done && usage.done && entitlements.done && reading.done;
    if (!childrenDone) {
      return { done: false, deleted };
    }

    // La fila del usuario va al final: mientras exista, una pasada nueva sabe
    // a quién le falta limpiar.
    await ctx.db.delete(user._id);
    deleted.users = 1;
    return { done: true, deleted };
  },
});

const CLERK_BACKEND_API = "https://api.clerk.com/v1";

/**
 * Borra la identidad en Clerk (Backend API `DELETE /v1/users/{id}`). Se llama
 * *después* de que los datos ya no están, y nunca lanza: el resultado viaja al
 * cliente para que la UI pueda avisar si la identidad quedó pendiente.
 */
export async function deleteClerkUser(clerkId: string): Promise<ClerkDeletionStatus> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    console.error(
      "CLERK_SECRET_KEY no está configurada: los datos se borraron pero el usuario de Clerk sobrevive. " +
        "Configurala con `npx convex env set CLERK_SECRET_KEY`.",
    );
    return "not_configured";
  }

  try {
    const response = await fetch(`${CLERK_BACKEND_API}/users/${encodeURIComponent(clerkId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secret}` },
    });
    // 404 = ya no existe en Clerk; para nosotros es el mismo estado final.
    if (response.ok || response.status === 404) {
      return "deleted";
    }
    console.error(`Clerk DELETE /v1/users falló con ${response.status} para ${clerkId}`);
    return "failed";
  } catch (error) {
    console.error(`Clerk DELETE /v1/users lanzó un error para ${clerkId}`, error);
    return "failed";
  }
}

/**
 * Eliminar mi cuenta. Orden deliberado: **primero los datos, después Clerk.**
 *
 * Si Clerk se borrara primero y el purgado fallara, el usuario quedaría sin
 * identidad y con datos vivos: nadie podría volver a pedir el borrado. Al
 * revés, si Clerk falla después, los datos ya no están (que es lo que exige la
 * guideline 5.1.1(v) y la política publicada) y devolvemos
 * `status: "clerk_pendiente"` para que la UI lo diga en voz alta y cierre
 * sesión igual — nunca datos borrados con sesión viva y en silencio.
 *
 * Si el borrado de datos no terminó, la identidad de Clerk **no** se toca:
 * mejor un reintento posible que una cuenta huérfana e inalcanzable.
 */
export const deleteAccount = action({
  args: {},
  handler: async (ctx): Promise<DeleteAccountResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("No autenticado");
    }
    const clerkId = identity.subject;

    const deleted = emptyPurgeCounts();
    let dataDone = false;
    for (let pass = 0; pass < PURGE_MAX_PASSES && !dataDone; pass += 1) {
      const result = await ctx.runMutation(internal.users.purgeAccountData, { clerkId });
      deleted.messages += result.deleted.messages;
      deleted.conversations += result.deleted.conversations;
      deleted.usage += result.deleted.usage;
      deleted.entitlements += result.deleted.entitlements;
      deleted.stories += result.deleted.stories;
      deleted.storyImages += result.deleted.storyImages;
      deleted.readingProgress += result.deleted.readingProgress;
      deleted.readingRecents += result.deleted.readingRecents;
      deleted.readingBookmarks += result.deleted.readingBookmarks;
      deleted.readingPlanProgress += result.deleted.readingPlanProgress;
      deleted.users += result.deleted.users;
      dataDone = result.done;
    }

    if (!dataDone) {
      console.error(`El borrado de datos de ${clerkId} no terminó en ${PURGE_MAX_PASSES} pasadas`);
      return { status: "datos_incompletos", clerk: "failed", deleted };
    }

    const clerk = await deleteClerkUser(clerkId);
    return { status: clerk === "deleted" ? "ok" : "clerk_pendiente", clerk, deleted };
  },
});
