import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Clerk es la autoridad de identidad; acá solo espejamos lo que necesitamos.
  users: defineTable({
    clerkId: v.string(), // identity.subject del JWT de Clerk
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    bibleVersion: v.union(v.literal("RV1909"), v.literal("RVR1960"), v.literal("NVI")),
    reminderHour: v.optional(v.number()),
    darkMode: v.optional(v.boolean()),
    aiConsentAt: v.optional(v.number()),
    aiConsentVersion: v.optional(v.string()),
    // Marca de que el usuario ya pasó por el onboarding (#124). Sin esto el
    // onboarding solo era alcanzable por el redirect post-login, que no
    // consultaba nada, y se repetía en cada inicio de sesión.
    onboardedAt: v.optional(v.number()),
    referralCode: v.string(),
    // Controles de lectura (#113). Son índices dentro de
    // READING_FONT_SCALES / READING_LINE_SPACINGS, no tamaños en px: el
    // tamaño sale siempre del token (regla dura #1).
    readingFontStep: v.optional(v.number()),
    readingSpacingStep: v.optional(v.number()),
    // "Hace un año guardaste…" en el inicio (#172). Sin valor = encendido;
    // se apaga en Ajustes. `savedMemoryDismissedWeek` es el lunes (YYYY-MM-DD,
    // hora de Honduras) de la semana en que la persona la cerró.
    savedMemoryEnabled: v.optional(v.boolean()),
    savedMemoryDismissedWeek: v.optional(v.string()),
    // Quién invitó a esta persona (PRD §9b): el `referralCode` de quien
    // compartió el link. Sirve solo para medir cuántos registros y pagos vienen
    // de compartir; no da premios ni se le muestra a nadie. Vive en la fila del
    // usuario, así que el borrado de cuenta ya lo cubre.
    referredBy: v.optional(v.string()),
    referredVia: v.optional(v.union(v.literal("link"), v.literal("play"), v.literal("manual"))),
    referredAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_referral_code", ["referralCode"]),

  // ── RAG (#5) ────────────────────────────────────────────
  verses: defineTable({
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    version: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()), // text-embedding-3-small reducido a 1024 dims
  })
    .index("by_ref", ["version", "book", "chapter", "verse"])
    // Búsqueda de texto del buscador (#112). Full-text, no semántica: es
    // instantánea y no cuesta un embedding por consulta. El índice vectorial
    // de abajo sigue siendo el del RAG y no se toca.
    .searchIndex("by_text", {
      searchField: "text",
      filterFields: ["version", "book"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1024,
      filterFields: ["version", "book"],
    }),

  // Comentarios evangélicos de referencia (#6) — granularidad de capítulo,
  // no de versículo (así se publican). Segunda fuente de recuperación que
  // enriquece la respuesta de rag.answer; nunca reemplaza la cita bíblica.
  commentaries: defineTable({
    source: v.string(), // "Matthew Henry", etc.
    book: v.string(),
    chapter: v.number(),
    text: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_ref", ["source", "book", "chapter"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1024,
      filterFields: ["source", "book"],
    }),

  // Contenido editorial curado. La fecha usa el calendario de Honduras
  // (YYYY-MM-DD), no la zona horaria del dispositivo.
  dailyDevotionals: defineTable({
    date: v.string(),
    catalogId: v.string(),
    verseRef: v.string(),
    reflection: v.string(),
    imageUrl: v.string(),
    imageAlt: v.string(),
    imageAttributionUrl: v.string(),
  }).index("by_date", ["date"]),

  // Marcador "seguí leyendo" del lector (#113). Una fila por usuario: el
  // lector no guarda un historial de lectura, guarda dónde quedó.
  readingProgress: defineTable({
    userId: v.id("users"),
    book: v.string(),
    chapter: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Referencias abiertas recientemente y guardadas desde el lector (#112/#113).
  // Se guardan por separado del progreso: una persona puede retomar Génesis 4,
  // conservar Juan 3:16 y seguir viendo ambos en sus listas.
  readingRecents: defineTable({
    userId: v.id("users"),
    book: v.string(),
    chapter: v.number(),
    openedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_chapter", ["userId", "book", "chapter"]),

  readingBookmarks: defineTable({
    userId: v.id("users"),
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    createdAt: v.number(),
    // Nota personal (#167): privada, nunca se comparte ni se manda a la IA.
    // Entra en "Borrar mi historial" y en el borrado de cuenta.
    note: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_verse", ["userId", "book", "chapter", "verse"]),

  // Separador del lector: la cinta que uno deja a propósito en una página, como
  // en una Biblia de papel. No es `readingProgress` (que se mueve solo con cada
  // capítulo abierto): el separador se queda donde la persona lo puso hasta que
  // lo mueve o lo quita. Una sola fila por usuario.
  readingSeparators: defineTable({
    userId: v.id("users"),
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Subrayados del lector (#168): el resaltador de una Biblia de papel. Una
  // fila por versículo subrayado; cambiar de color parchea la fila. `color` es
  // una llave de la paleta `highlight` de design/tokens.json, nunca un hex:
  // el tono real lo decide el tema (claro u oscuro) al pintar.
  readingHighlights: defineTable({
    userId: v.id("users"),
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    color: v.union(v.literal("amber"), v.literal("sage"), v.literal("clay"), v.literal("sand")),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_verse", ["userId", "book", "chapter", "verse"]),

  // Diagnóstico (convex/telemetry.ts): eventos del embudo y errores de la app.
  // Sin userId a propósito — `installId` es un id aleatorio del teléfono que no
  // se une con la cuenta — y sin contenido. Se borran a los 90 días.
  telemetryEvents: defineTable({
    installId: v.string(),
    name: v.string(),
    module: v.optional(v.union(v.literal("qa"), v.literal("voices"), v.literal("feelings"), v.literal("stories"))),
    platform: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
    build: v.optional(v.string()),
    at: v.number(),
  }).index("by_at", ["at"]),

  clientErrors: defineTable({
    installId: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    fatal: v.boolean(),
    platform: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
    build: v.optional(v.string()),
    at: v.number(),
  }).index("by_at", ["at"]),

  // Plan de lectura anual (#114). Contenido curado versionado en el repo
  // (docs/content/planes/canonico.json, cargado y validado por
  // convex/readingPlanCatalog.ts) — esta tabla es la copia servible, sembrada
  // una vez por `readingPlans.ensurePlanSeeded` (mismo patrón que
  // `dailyDevotionals`). Leer el plan es gratis: no pasa por `convex/quotas.ts`.
  readingPlans: defineTable({
    planId: v.string(),
    name: v.string(),
    description: v.string(),
    totalDays: v.number(),
    days: v.array(
      v.object({
        day: v.number(),
        // Puede ser más de una lectura por día (p. ej. 3-4 capítulos en el plan
        // canónico repartidos parejo a lo largo del año). `verseStart`/`verseEnd`
        // acotan la lectura a un pasaje (recorridos temáticos, #115); sin ellos
        // es el capítulo completo. Campos opcionales: las filas ya sembradas del
        // canónico siguen siendo válidas sin migración.
        readings: v.array(
          v.object({
            book: v.string(),
            chapter: v.number(),
            verseStart: v.optional(v.number()),
            verseEnd: v.optional(v.number()),
          }),
        ),
      }),
    ),
  }).index("by_plan_id", ["planId"]),

  // Progreso de un usuario en un plan. Una fila por (usuario, plan) desde #115:
  // un recorrido corto se sigue a la par del plan anual sin pisarlo. No hay
  // historial de intentos abandonados — reiniciar un plan reemplaza solo la
  // fila de ese plan.
  //
  // Migración desde #114 (una fila por usuario): no hace falta backfill. Cada
  // fila existente ya tiene `planId`, así que ya es una fila (usuario, plan)
  // válida y `by_user_plan` la encuentra tal cual.
  userPlanProgress: defineTable({
    userId: v.id("users"),
    planId: v.string(),
    // Fecha de inicio en el calendario de Honduras (YYYY-MM-DD) — el día 1 del
    // plan corresponde a esta fecha, igual criterio que `dailyDevotionals`.
    startedAt: v.string(),
    // Números de día (1-indexado) que el usuario marcó como leídos. No
    // necesariamente consecutivos: "ponerme al día" permite marcar días
    // salteados sin re-ordenar nada.
    completedDays: v.array(v.number()),
    currentStreak: v.number(),
    longestStreak: v.number(),
    // Fecha (Honduras) de la última vez que se marcó un día como leído — la
    // racha se calcula contra el calendario real, no contra el día del plan,
    // para que ponerse al día en una sola sesión no infle la racha.
    lastCompletedDate: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_plan", ["userId", "planId"]),

  // Plan en grupo cerrado (#185, cierra #162). El nombre del grupo no se
  // guarda: se deriva de `kind` (lista fija) y del plan, para que no haya
  // texto libre de usuarios que moderar (docs/spikes/moderacion-contenido-usuarios.md).
  readingGroups: defineTable({
    planId: v.string(),
    kind: v.union(
      v.literal("familia"),
      v.literal("celula"),
      v.literal("escuela-dominical"),
      v.literal("jovenes"),
      v.literal("amigos"),
    ),
    // Quien está a cargo: puede cambiar el link. Si sale, pasa a quien entró primero.
    ownerId: v.id("users"),
    // Token del link de invitación (`bibleai://grupo?token=…`). Se puede rotar.
    inviteToken: v.string(),
    createdAt: v.number(),
  }).index("by_invite_token", ["inviteToken"]),

  // Una fila por (grupo, persona). Lo único que se comparte es el avance del
  // plan, que se lee de `userPlanProgress` — acá no se copia nada.
  readingGroupMembers: defineTable({
    groupId: v.id("readingGroups"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"]),

  // ── Transversales (#4 / quotas) ─────────────────────────
  usage: defineTable({
    userId: v.id("users"),
    module: v.union(
      v.literal("qa"),
      v.literal("voices"),
      v.literal("feelings"),
      v.literal("stories"),
    ),
    day: v.string(), // "2026-08-18"; use "lifetime" for stories
    count: v.number(),
  }).index("by_user_module_day", ["userId", "module", "day"]),

  entitlements: defineTable({
    userId: v.id("users"),
    isPro: v.boolean(),
    expiresAt: v.optional(v.number()),
    source: v.string(), // "revenuecat_webhook"
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Historial compartido (Voces, Q&A, Sentimiento). #35 borra estas filas
  // de verdad — no hay `deleted: true`.
  conversations: defineTable({
    userId: v.id("users"),
    module: v.union(v.literal("qa"), v.literal("voices"), v.literal("feelings")),
    characterId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user_module", ["userId", "module"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    devotional: v.optional(
      v.object({
        title: v.string(),
        reflection: v.string(),
        prayer: v.string(),
        citation: v.object({
          book: v.string(),
          chapter: v.number(),
          verse: v.number(),
          version: v.string(),
          text: v.string(),
        }),
      }),
    ),
    citations: v.optional(
      v.array(
        v.object({
          book: v.string(),
          chapter: v.number(),
          verse: v.number(),
          version: v.string(),
          verseId: v.id("verses"),
          text: v.string(),
        }),
      ),
    ),
  }).index("by_conversation", ["conversationId"]),

  stories: defineTable({
    userId: v.id("users"),
    catalogId: v.string(),
    status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
    scenes: v.array(v.object({
      id: v.string(),
      order: v.number(),
      title: v.string(),
      narration: v.string(),
      reference: v.string(),
      status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
      storageId: v.optional(v.id("_storage")),
    })),
    createdAt: v.number(),
  }).index("by_user_catalog", ["userId", "catalogId"]),
});
