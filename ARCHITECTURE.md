# Arquitectura — Bible AI Honduras

**Stack:** Expo (React Native, TypeScript) · Convex (backend, DB, vector search) ·
Clerk (auth) · Anthropic Claude Sonnet 5 (IA) · Voyage AI (embeddings) · RevenueCat (IAP) ·
Claude Design (contrato visual).

**Principio rector:** una sola fuente de verdad por cosa. Un prototipo para la UI, una
base de datos para el estado, un servicio para las cuotas, un pipeline para el contenido
bíblico. Cuatro módulos construidos en paralelo solo sobreviven si nadie tiene su propia
copia de nada.

Relacionado: `PRD.md` (producto) · `phases.md` (orden de ejecución) · `CLAUDE.md` (reglas duras).

---

## 1. Vista de 10,000 pies

```
┌─────────────────────────────────────────────────────────┐
│  Claude Design  ── design/*.dc.html ── design/tokens.json│  contrato visual
└─────────────────────────────────────────────────────────┘
                            │ genera
                            ▼
┌─────────────────────────────────────────────────────────┐
│  App Expo (iOS + Android)                                │
│  expo-router · theme generado · componentes base         │
│  @clerk/clerk-expo (sesión) · RevenueCat SDK (solo compra)│
└─────────────────────────────────────────────────────────┘
        │ JWT de Clerk           │ queries/mutations reactivas
        ▼                        ▼
┌──────────────┐   ┌─────────────────────────────────────────┐
│    Clerk     │──▶│  Convex                                  │
│ Google/Apple │JWT│  ├─ auth.config.ts  valida el JWT        │
│ email        │   │  ├─ db      perfiles, historial, cuotas  │
└──────────────┘   │  ├─ vector  versículos + comentarios     │
                   │  ├─ actions Sonnet 5, Voyage, imágenes   │
                   │  ├─ crons   devocional diario            │
                   │  └─ http    webhook de RevenueCat        │
                   └─────────────────────────────────────────┘
                                  │
                                  ▼  solo desde actions
                   Anthropic (Claude) · Voyage AI (embeddings)
                   Proveedor de imágenes · RevenueCat
```

**Regla de frontera:** la app nunca llama a un proveedor externo. Ni al LLM, ni al
generador de imágenes, ni a la API de RevenueCat para leer estado. Toda clave vive en
Convex. La app habla solo con Convex.

---

## 2. Por qué Convex

| Necesidad | Qué resuelve Convex | Alternativa que evitamos |
|---|---|---|
| RAG bíblico (#5, #6, #7) | `vectorIndex` nativo, sin DB de vectores aparte | Pinecone/pgvector = segunda base de datos que mantener |
| Cuotas free/Pro (#15/#20/#24/#29) | Mutations transaccionales — no hay carrera | Contador en el cliente = trivial de burlar |
| Historial reactivo (#29, #35) | Queries reactivas, la UI se actualiza sola | Polling + invalidación manual de caché |
| Devocional diario (#9) | Cron function | Servidor aparte solo para un job diario |
| Webhook de RevenueCat (#31) | `httpAction` | Lambda/servidor aparte |
| Generación de imágenes (#25) | Action + scheduler + file storage | Cola + bucket + CDN por separado |

Un solo backend, un solo despliegue, un solo lenguaje. Con 2-3 devs y 8-10 semanas, eso
importa más que cualquier ventaja teórica de un stack más granular.

### 2.1 Los proveedores externos y por qué cada uno

| Proveedor | Rol | Dónde vive la clave |
|---|---|---|
| **Clerk** | Auth: Google, Apple, email. Emite un JWT que Convex valida | publishable key en la app; secret en Clerk |
| **Anthropic (Claude Sonnet 5)** | Q&A, Voces, Sentimiento — los 3 módulos conversacionales | `ANTHROPIC_API_KEY`, **solo** en Convex |
| **Voyage AI** | Embeddings del RVR1960 y de los comentarios | `VOYAGE_API_KEY`, **solo** en Convex |
| **RevenueCat** | Compra IAP + webhook de estado | SDK en la app; secret del webhook en Convex |

**Ninguna clave de IA toca la app.** Si `ANTHROPIC_API_KEY` aparece en un archivo bajo
`app/` o `src/`, es un incidente de seguridad: se extrae del bundle en minutos.

---

## 3. Estructura de carpetas

```
bible-ai-honduras/
├── app/                        # expo-router — una ruta por pantalla del prototipo
│   ├── _layout.tsx             # ClerkProvider + ConvexProviderWithClerk + tema
│   ├── (auth)/                 # splash, login, onboarding, permiso de push
│   ├── (tabs)/
│   │   ├── index.tsx           # Home — devocional diario          #8
│   │   ├── preguntar/          # Q&A guiado                        #12 #14
│   │   ├── voces/              # personajes bíblicos               #17
│   │   ├── historias/          # historias ilustradas              #25
│   │   └── sentir/             # devocional por sentimiento        #27
│   ├── paywall.tsx             #                                   #30
│   └── ajustes.tsx             #                                   #34
│
├── design/                     # ← contrato visual, no se edita a mano
│   ├── Bible AI Honduras.dc.html
│   ├── tokens.json             # fuente de verdad de estilos
│   └── README.md
│
├── src/
│   ├── theme/
│   │   ├── tokens.generated.ts # GENERADO desde design/tokens.json
│   │   └── index.ts            # useTheme(), tipos
│   ├── components/             # card, botón, chip, versículo, burbuja de chat  #2
│   ├── features/               # lógica de UI por módulo (sin llamadas directas a proveedores)
│   └── lib/
│       ├── share.ts            # componente único de compartir     #36
│       └── revenuecat.ts       # solo compra/restore, nunca lectura de estado
│
├── convex/
│   ├── schema.ts
│   ├── auth.config.ts          # valida el JWT de Clerk           #3
│   ├── users.ts                # upsert de perfil desde el JWT    #3
│   ├── rag/
│   │   ├── embed.ts            # cliente de Voyage AI (único lugar)
│   │   ├── ingest.ts           # RVR1960 → chunks → embeddings     #5
│   │   ├── commentary.ts       # comentarios evangélicos           #6
│   │   ├── retrieve.ts         # vectorSearch + hidratación        #7
│   │   ├── answer.ts           # Claude + verificación de cita     #7
│   │   └── prompts/            # system prompt por módulo
│   ├── qa.ts                   #                                   #13
│   ├── voices.ts               # + guardrail de personajes         #18 #19
│   ├── feelings.ts             #                                   #28
│   ├── stories.ts              # catálogo + generación de imágenes #23 #25
│   ├── devotional.ts           # contenido diario + cron           #9
│   ├── quotas.ts               # ← SERVICIO ÚNICO                  #15 #20 #24 #29
│   ├── entitlements.ts         # estado Pro derivado del webhook   #31 #32 #33
│   ├── history.ts              # guardar / borrar                  #29 #35
│   ├── crons.ts
│   └── http.ts                 # webhook de RevenueCat
│
├── scripts/
│   └── build-tokens.ts         # design/tokens.json → tokens.generated.ts
│
├── CLAUDE.md
├── PRD.md
├── phases.md
└── ARCHITECTURE.md
```

---

## 4. Esquema de datos (Convex)

```ts
// convex/schema.ts — forma, no versión final
export default defineSchema({
  // Clerk es la autoridad de identidad; acá solo espejamos lo que necesitamos
  users: defineTable({
    clerkId: v.string(),                       // identity.subject del JWT
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    bibleVersion: v.union(v.literal("RVR1960"), v.literal("NVI")),
    reminderHour: v.optional(v.number()),
    referralCode: v.string(),
  }).index("by_clerk_id", ["clerkId"]),

  // ── RAG ────────────────────────────────────────────────
  verses: defineTable({
    book: v.string(), chapter: v.number(), verse: v.number(),
    version: v.string(), text: v.string(),
    embedding: v.array(v.float64()),           // voyage-4 → 1024 dims
  })
    .index("by_ref", ["version", "book", "chapter", "verse"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding", dimensions: 1024,   // ← atado al modelo de embeddings
      filterFields: ["version", "book"],            // filtro exacto en el vector search
    }),

  commentaries: defineTable({
    source: v.string(),                        // "Matthew Henry", etc.
    book: v.string(), chapter: v.number(),
    text: v.string(), embedding: v.array(v.float64()),
  }).vectorIndex("by_embedding", {
      vectorField: "embedding", dimensions: 1024,
      filterFields: ["source", "book"],
    }),

  // ── Transversales ──────────────────────────────────────
  usage: defineTable({
    userId: v.id("users"),
    module: v.union(v.literal("qa"), v.literal("voices"),
                    v.literal("feelings"), v.literal("stories")),
    day: v.string(),                           // "2026-08-18" — null para stories (de por vida)
    count: v.number(),
  }).index("by_user_module_day", ["userId", "module", "day"]),

  entitlements: defineTable({
    userId: v.id("users"),
    isPro: v.boolean(),
    expiresAt: v.optional(v.number()),
    source: v.string(),                        // "revenuecat_webhook"
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ── Contenido de módulos ───────────────────────────────
  conversations: defineTable({
    userId: v.id("users"),
    module: v.string(),
    characterId: v.optional(v.string()),       // solo Voces
    createdAt: v.number(),
  }).index("by_user_module", ["userId", "module"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    citations: v.optional(v.array(v.object({   // ← toda respuesta de IA las lleva
      book: v.string(), chapter: v.number(), verse: v.number(),
      version: v.string(), verseId: v.id("verses"),
    }))),
  }).index("by_conversation", ["conversationId"]),

  dailyDevotionals: defineTable({
    date: v.string(), verseRef: v.string(),
    reflection: v.string(), imageUrl: v.string(),
  }).index("by_date", ["date"]),

  stories: defineTable({
    userId: v.id("users"), storyId: v.string(),
    status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
    scenes: v.array(v.object({
      text: v.string(),
      imageStorageId: v.optional(v.id("_storage")),
    })),
  }).index("by_user", ["userId"]),
});
```

---

## 5. Los flujos que importan

### 5.0 Identidad — Clerk emite, Convex valida (#3)

```
app  → ClerkProvider (@clerk/clerk-expo, tokenCache en expo-secure-store)
     → ConvexProviderWithClerk(client, useAuth)
     → cada request lleva el JWT de Clerk
Convex → convex/auth.config.ts { domain: CLERK_JWT_ISSUER_DOMAIN, applicationID: "convex" }
       → ctx.auth.getUserIdentity() en toda query/mutation/action
       → users.upsert(identity.subject) la primera vez
```

Requisitos de configuración, en este orden — saltarse uno da un 401 sin mensaje útil:
1. Un **JWT template llamado `convex`** en el dashboard de Clerk. `applicationID: "convex"`
   se refiere a ese template, no al proyecto.
2. `CLERK_JWT_ISSUER_DOMAIN` en las variables de entorno **de Convex**, no en la app.
3. Instancias separadas de Clerk para dev y prod, apuntando a deployments distintos de Convex.

**`identity.subject` (el user id de Clerk) es la llave de todo lo que es del usuario.**
La tabla `users` es un espejo local con índice `by_clerk_id`; nada de la lógica de negocio
depende de Clerk más allá de ese string.

**Regla:** ninguna función de Convex confía en un `userId` que venga en los argumentos.
Se deriva de `ctx.auth.getUserIdentity()`. Un `userId` como argumento es una IDOR
esperando a pasar — cualquiera consulta el historial de otro cambiando un id.

### 5.1 RAG — el motor compartido (#7)

Q&A, Voces y Sentimiento **son el mismo pipeline con distinto system prompt.**
No son tres integraciones de IA.

```
app → action rag.answer({ pregunta, pasaje?, module })
  1. runMutation quotas.checkAndConsume(module)   ← antes de gastar un token
  2. voyage.embed(pregunta, { input_type: "query" })
  3. ctx.vectorSearch("verses", …)                ← devuelve solo _id + _score
  4. ctx.runQuery(getVersesByIds)                 ← hidratar documentos
  5. ídem sobre commentaries
  6. (opcional) voyage rerank-2.5 sobre lo recuperado
  7. Claude con el contexto recuperado + system prompt del módulo
  8. verificar que cada cita existe en lo recuperado ← paso no negociable
  9. runMutation saveMessage con citations[]
```

**Restricciones de Convex que condicionan el diseño:**
- `vectorSearch` corre **solo dentro de un `action`** — nunca en query ni mutation.
- Devuelve `{_id, _score}`; hay que hidratar con `runQuery`. Presupuestá ese salto.
- Las actions no tocan la DB directo: `ctx.runQuery` / `ctx.runMutation`.
- Filtrar por `version` o `book` exige que estén en `filterFields` del índice.

**El paso 8 es la regla dura #4 hecha código.** Si Claude cita un versículo que no salió
de la recuperación, la respuesta se descarta o se reintenta — no se muestra. Sin eso, el
RAG es decoración.

### 5.1.1 Embeddings — Voyage AI

**Anthropic no ofrece modelo de embeddings.** Es el hueco que el stack elegido no cubre y
la razón de que haya un cuarto proveedor. Anthropic recomienda Voyage AI; el resto de la
arquitectura no cambia si mañana se cambia de proveedor, salvo `dimensions` del índice.

| Decisión | Valor | Por qué |
|---|---|---|
| Modelo | `voyage-4` | Multilingüe (el corpus es español), calidad/costo balanceado |
| Dimensiones | **1024** (default) | Va en `vectorIndex.dimensions`. Cambiarlo = re-embeder todo |
| Alternativas | `voyage-4-lite` (latencia/costo), `voyage-4-large` (calidad) | Misma familia, misma dimensión — se puede probar sin migrar el esquema |
| Reranking | `rerank-2.5` | Opcional. Sube precisión cuando el top-k trae ruido |

**El error que va a cometer alguien:** `input_type`. Al indexar se usa
`input_type: "document"`; al consultar, `input_type: "query"`. Voyage antepone prompts
distintos en cada caso. Si se omite o se mezcla, la recuperación empeora **en silencio** —
no falla, solo trae versículos peores. Encapsulalo en `convex/rag/embed.ts` con dos
funciones (`embedDocument`, `embedQuery`) y que nadie llame a Voyage desde otro lado.

Los embeddings de ingesta (~31,100 versículos + comentarios) se pagan **una vez, offline,
en #5** — no en tiempo de request. En request solo se embebe la pregunta del usuario.

### 5.1.2 Generación — Anthropic Claude

```ts
// convex/rag/answer.ts (forma)
const res = await anthropic.messages.stream({
  model: "claude-sonnet-5",
  max_tokens: 4096,
  thinking: { type: "adaptive" },
  output_config: { effort: "medium" },
  system: [
    { type: "text", text: BASE_RULES,            cache_control: { type: "ephemeral" } },
    { type: "text", text: modulePrompt(module),  cache_control: { type: "ephemeral" } },
    { type: "text", text: retrievedContext },    // volátil → después del breakpoint
  ],
  messages,
});
```

| Decisión | Valor | Nota |
|---|---|---|
| Modelo | `claude-sonnet-5` | $3 / $15 por MTok — $2 / $10 promocional hasta el 2026-08-31 |
| Contexto | 1M tokens | Sobra para el contexto recuperado + historial de la conversación |
| Thinking | `{ type: "adaptive" }` | `budget_tokens` está **removido** — devuelve 400 |
| Effort | `output_config: { effort: "medium" }` | Palanca de costo. `high` es el default si se omite |
| Streaming | siempre en chat | El usuario ve tokens en vez de 4s de spinner |
| Prompt caching | reglas + persona del personaje | Prefijo estable primero, contexto recuperado después |
| Structured outputs | `output_config.format` para `citations[]` | Hace verificable el paso 8 sin parsear texto |

**Prompt caching es la palanca de costo real de este producto.** El orden del prefijo es
`tools → system → messages`, y cualquier byte que cambie invalida todo lo que sigue. Las
reglas base y la persona de cada personaje son idénticas entre requests → van primero,
con breakpoint. El contexto recuperado cambia siempre → va después. Mínimo cacheable
~1024 tokens. Verificalo con `usage.cache_read_input_tokens`: si es 0 request tras
request, algo lo está invalidando (una fecha, un id, un JSON sin ordenar).

**Restricciones de esta familia de modelos** (aplican a Sonnet 5; verificadas, no de memoria):
- `temperature`, `top_p` y `top_k` están **removidos** — devuelven 400. El control de
  variabilidad es el prompt, no un parámetro.
- **Fast mode no está disponible** en Sonnet 5 (es Opus 5 / 4.8). Si hace falta bajar
  latencia, la palanca es `effort` y el streaming, no `speed`.
- **Mensajes de sistema a mitad de conversación** tampoco: eso es Opus 5 / 4.8. Acá el
  system prompt va en el campo `system` y se mantiene estable para no romper el caché.

**Dos cosas que hay que manejar y que la gente olvida:**
- **Prefill de assistant está removido** en esta familia de modelos — devuelve 400. Para
  forzar formato se usa `output_config.format`, no un turno de assistant pre-llenado.
- **`stop_reason: "refusal"`** llega con HTTP 200. Hay que chequearlo **antes** de leer
  `content`, o el módulo de Voces muestra una respuesta vacía. En #19 esto es doblemente
  relevante: un rechazo del clasificador y un rechazo de nuestro guardrail se ven
  distinto y se manejan distinto.

**El guardrail de #19 vive en el system prompt de `voices.ts`** — lista blanca de
personajes humanos, más rechazo explícito de Jesús/Dios/Espíritu Santo en 1ra persona.
Los tests adversariales corren contra la action, no contra el prompt en abstracto.

### 5.2 Cuotas — un servicio, cuatro llamadas (#15/#20/#24/#29)

```ts
// convex/quotas.ts — el único lugar donde se cuenta uso en todo el proyecto
export const checkAndConsume = internalMutation({
  args: { userId: v.id("users"), module: ModuleValidator },
  handler: async (ctx, { userId, module }) => {
    const { isPro } = await getEntitlement(ctx, userId);
    if (isPro) return { allowed: true };

    const limits = { qa: 5, voices: 5, feelings: 3, stories: 1 };
    const key = module === "stories" ? "lifetime" : today();   // stories = de por vida
    const row = await ctx.db.query("usage")
      .withIndex("by_user_module_day", q =>
        q.eq("userId", userId).eq("module", module).eq("day", key)).unique();

    if ((row?.count ?? 0) >= limits[module])
      return { allowed: false, reason: "limit_reached", module };  // ← el gancho de #32

    await (row ? ctx.db.patch(row._id, { count: row.count + 1 })
               : ctx.db.insert("usage", { userId, module, day: key, count: 1 }));
    return { allowed: true };
  },
});
```

**Por qué es mutation y no lógica de cliente:** las mutations de Convex son
transaccionales y serializadas por documento. Dos taps rápidos no consumen una cuota
sola ni saltan el límite. Un contador en AsyncStorage se burla desinstalando la app.

`{ allowed: false, reason: "limit_reached" }` es **el contrato único** que los 4 módulos
devuelven a la UI y que el paywall (#32) consume. Un solo tipo, cuatro emisores, un
consumidor.

### 5.3 Pro / paywall — RevenueCat es la caja, Convex es la verdad (#31/#32/#33)

```
App → RevenueCat SDK: comprar / restaurar          (única función del SDK)
RevenueCat → POST /revenuecat  (httpAction)        firma verificada
  → entitlements.upsert({ userId, isPro, expiresAt })
App → useQuery(entitlements.mine)                  ← reactivo: se desbloquea solo
```

**Decisión:** la app **nunca** pregunta "¿soy Pro?" al SDK de RevenueCat para tomar
decisiones. Lee `entitlements` de Convex. Razón: la cuota se evalúa en el servidor, así
que el estado Pro tiene que vivir donde se evalúa la cuota. Si el cliente fuera la
autoridad, el límite sería opcional.

Efecto secundario que sale gratis: al confirmarse el webhook, la query reactiva
actualiza los 4 módulos a la vez, sin refetch manual. Eso es el criterio de salida de #32.

### 5.4 Historias ilustradas — el flujo caro (#22/#23/#25)

```
mutation stories.create   → status "generating", devuelve id (UI muestra skeleton)
  scheduler.runAfter(0, generateScenes)
action  generateScenes    → N imágenes en paralelo acotado → ctx.storage.store()
  runMutation(patch escena) por cada una  ← la UI las ve aparecer de a una
```

Generar dentro de la mutation bloquearía la UI 30-60s. El scheduler + queries reactivas
convierten eso en un progreso visible escena por escena.

**Control de costo (lo que #22 debe decidir):** el límite de 1 muestra de por vida se
aplica en `quotas.checkAndConsume("stories")` **antes** de agendar la generación, nunca
después. Las imágenes se guardan en Convex file storage, no se regeneran al volver a ver
la historia.

---

## 6. El puente Claude Design → código

```
design/Bible AI Honduras.dc.html   (contrato visual, exportado de Claude Design)
        │  se miden valores
        ▼
design/tokens.json                 (fuente de verdad, versionada)
        │  scripts/build-tokens.ts
        ▼
src/theme/tokens.generated.ts      (tipado, importado por los componentes)
        │
        ▼
src/components/*                   (cero literales de estilo)
```

- `tokens.generated.ts` **no se edita a mano** — se regenera.
- Un componente que necesita un valor que no es token: eso es el hallazgo. Se mide en el
  prototipo y se agrega al token, no se hardcodea.
- Sugerido para el CI de #2: un lint que falle ante `#[0-9a-fA-F]{6}` en `src/components/`
  y `app/`. Hace la regla dura #1 verificable en vez de aspiracional.

Procedimiento completo y re-exportación: `.claude/skills/frontend-claude-design/SKILL.md`.

---

## 7. Reparto por carril (2 devs)

| Carril | Dueño | Superficie |
|---|---|---|
| **App** | Dev 1 | `app/`, `src/`, `design/` → tokens, pantallas, compartir, push |
| **Convex** | Dev 2 | `convex/` completo, RAG, cuotas, entitlements, crons, webhook |

**El contrato entre ambos es `convex/_generated/api`** — tipado de punta a punta. Dev 2
publica firmas de funciones con datos mockeados en `#7` y Dev 1 construye contra los
tipos reales desde el día uno, sin esperar la implementación.

Tres sincronizaciones, ya definidas en el plan de ejecución: `#7` mockeado → pantallas
conversacionales; pantallas listas → enganche de cuotas; `#30` listo → `#31`/`#32`.

---

## 8. Riesgos de esta arquitectura

| Riesgo | Realidad | Mitigación |
|---|---|---|
| **Costo de generación de imágenes** | El gasto variable más alto del producto | `#22` decide en semana 1. Límite aplicado antes de agendar, no después |
| **Latencia del RAG** | 3 saltos (embed → vector → LLM) + hidratación. 3-6s realistas | Respuesta en streaming en la UI; skeleton desde el primer token |
| **Costo de embeddings de ingesta** | ~31,100 versículos + comentarios | Se paga una vez, offline, en `#5`. No en tiempo de request |
| **Costo por request de Claude** | Sonnet 5 a $3/$15 por MTok, con contexto RAG en cada turno | Prompt caching sobre reglas y personas + `effort` bajo en rutas simples. Medir `cache_read_input_tokens` desde el día 1, no al final |
| **Precio promocional que vence** | Sonnet 5 está a $2/$10 hasta el **2026-08-31**; después sube a $3/$15 (+50%) | El modelo de costo por usuario tiene que correrse con $3/$15, no con el promocional |
| **`input_type` de Voyage mal usado** | No falla — degrada la recuperación en silencio | Encapsulado en `rag/embed.ts`; test que compare recuperación con y sin el parámetro |
| **Un proveedor más de lo previsto** | Anthropic no hace embeddings; Voyage es un cuarto vendor con su propia cuenta y factura | Aislado en un módulo. Cambiar de proveedor = re-embeder + cambiar `dimensions` |
| **Vendor lock-in con Convex** | Real. El esquema y las funciones no son portables | Aceptado a cambio de velocidad. La lógica de negocio vive en funciones puras testeables; lo acoplado es la capa de datos |
| **Clerk como punto único de login** | Si Clerk cae, nadie entra — ni usuarios con sesión vieja, según la expiración del JWT | Aceptado. Es el trade normal de auth gestionada; la alternativa es mantener OAuth propio |
| **Verificación de citas** | Si se implementa flojo, la regla dura #4 es decorativa | Test que le pida al LLM citar algo fuera del contexto y verifique que la respuesta se descarta |
| **Límites de plataforma** | Convex tiene topes de tamaño de función y tiempo de action | La generación de historias ya va por scheduler, que es el patrón correcto |

---

## 9. Decisiones abiertas

1. **Proveedor de imágenes** — sale del spike `#22`. Es la única pieza del stack sin dueño.
2. **`voyage-4` vs `voyage-4-lite`** — misma dimensión (1024), así que se puede medir
   con el corpus real en `#5` y cambiar sin migrar el esquema. Medir, no debatir.
3. **Tier de Claude** — elegido: `claude-sonnet-5`. Si la calidad del módulo de Voces no
   convence en pruebas, subir a `claude-opus-5` es cambiar un string; si el costo aprieta,
   `claude-haiku-4-5` ($1/$5) sirve para rutas simples como el devocional por sentimiento.
   La arquitectura no cambia en ningún caso. **Decidilo con tráfico real, no estimando.**
4. **NVI** — licencia sin resolver. El esquema ya lleva `version` en `verses` y en el
   filtro del índice, así que agregarla después no rompe nada.
5. **Push** — Expo Notifications directo vs. servicio aparte. Se decide en `#10`.

---

## 10. Variables de entorno

| Variable | Dónde | Quién la usa |
|---|---|---|
| `EXPO_PUBLIC_CONVEX_URL` | app (pública) | cliente de Convex |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | app (pública) | ClerkProvider |
| `CLERK_JWT_ISSUER_DOMAIN` | **Convex** | `auth.config.ts` |
| `ANTHROPIC_API_KEY` | **Convex** | `rag/answer.ts` |
| `VOYAGE_API_KEY` | **Convex** | `rag/embed.ts` |
| `REVENUECAT_WEBHOOK_SECRET` | **Convex** | `http.ts` |
| RevenueCat public SDK key | app (pública) | compra y restore |

Solo las `EXPO_PUBLIC_*` y la key pública de RevenueCat viajan en el bundle. Todo lo
demás vive en las variables de entorno del deployment de Convex. Deployments separados
para dev y prod, con instancias de Clerk separadas.
