# Project map — Bible AI Honduras

Written by `orient`. The shared source of truth for **how this repo works**, read by every other skill
and every teammate. Regenerate with `orient` when it goes stale.

- **Mapped on:** 2026-08-25 (commit `30de9d22` on `origin/master`)
- **Project type:** existing (inherited)

## Stack
| Field | Value |
|-------|-------|
| Language / runtime | TypeScript, Node 22 in CI (Expo SDK 57 / RN 0.86) |
| Framework | Expo Router (React Native, iOS + Android) |
| Package manager | npm (`package-lock.json`) |
| Database + ORM | Convex (`convex/schema.ts`, generated `convex/_generated/*`) |
| Auth | Clerk (`@clerk/expo`) → JWT validated by `convex/auth.config.ts` |

## Commands — verified
Mark each one `verified` (you ran it) or `UNVERIFIED`. Never guess.

| Purpose | Command | Status |
|---------|---------|--------|
| Install | `npm ci` | verified (2026-08-25); Node 23 locally emits engine warnings because CI/project dependencies target Node 22 |
| Run (dev) | `npm start` (`expo start`) | UNVERIFIED |
| Build | `npm run export` | verified — web, Android and iOS exports (2026-08-25) |
| Test (all) | `npm test` (`vitest run`) | verified — 32 files / 187 tests passing (2026-08-25) |
| Test (single file) | `npx vitest run convex/users.test.ts` | UNVERIFIED (inferred from vitest) |
| Lint / format | none in `package.json` | UNVERIFIED — no lint script |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | verified (2026-08-25) |
| Convex codegen | `npx convex codegen` | UNVERIFIED — required after adding `convex/*.ts` modules |
| Convex local | `npm run convex:once` / `npm run convex:dev` | UNVERIFIED; needs Convex project |
| Seed | none | UNVERIFIED |

## Layout
| What | Where |
|------|-------|
| App entry point | `app/_layout.tsx` (`expo-router/entry`) |
| Routes | `app/(auth)/*`, `app/(tabs)/*` |
| UI components | `src/components/*` |
| Shared libs | `src/lib/*`, `src/hooks/*` |
| DB schema | `convex/schema.ts` |
| Tests | colocated `convex/**/*.test.ts` (vitest + convex-test, `edge-runtime`) |
| Design tokens / theme | `design/tokens.json` → `src/theme/tokens.ts` |

## Roles
Exact names as they appear in code (`superadmin` ≠ `admin`).

| Role | How it's checked | Can do |
|------|------------------|--------|
| authenticated user | `ctx.auth.getUserIdentity()` | own profile via `users.*` |
| Pro | `entitlements.isPro` from RevenueCat webhook | skip free quotas; purchase/restore through RevenueCat SDK |

No app-level RBAC. Identity is Clerk `identity.subject`. Never accept `userId` from client args.

## Conventions
- **Branch naming:** `track-b/<n>-slug` for Track B (also historical `backend/`, `agent/`, `spike/`)
- **Commit style:** Spanish, imperative / descriptive of why (`Agrega…`, `Backend: …`)
- **Test style:** vitest + `convex-test`; module map passed explicitly; Spanish `describe`/`it` names
- **PR requirements:** one issue per PR; `npx tsc --noEmit` + `vitest` green; humans merge
- **Evidence norm:** backend = vitest output; UI = screenshot vs `design/Bible AI Honduras.dc.html`
- **UI:** tokens only (`design/tokens.json`); no hex/fontSize/radius literals
- **Product copy:** Spanish (Honduras). Code comments in this repo are currently Spanish.

## Environment
Names only — **never values**.

| Var | Needed for | Where to get it |
|-----|------------|-----------------|
| `EXPO_PUBLIC_CONVEX_URL` | app Convex client | `npx convex dev` writes `.env.local` |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | ClerkProvider | Clerk dashboard |
| `CLERK_JWT_ISSUER_DOMAIN` | `convex/auth.config.ts` | Clerk JWT issuer |
| `ANTHROPIC_API_KEY` | RAG answer (#7) | Anthropic — Convex env only |
| `VOYAGE_API_KEY` | RAG embed (#5) | Voyage — Convex env only |
| `REVENUECAT_WEBHOOK_SECRET` | webhook (#4/#31) | RevenueCat — Convex env only |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | purchase/restore | RevenueCat — public SDK key, never a secret API key |
| `OPENAI_API_KEY` | illustrated story generation | OpenAI — Convex env only |

External services: Clerk, Convex, Anthropic, Voyage AI, RevenueCat. No staging URL in repo.

## Risk areas
Shared/fragile surfaces. `plan-parallelize` keeps parallel agents off these; `run-batch` never assigns
two of these to different tracks at once.

| File / module | Why risky | Rule |
|---------------|-----------|------|
| `convex/schema.ts` | every backend issue | Append-only. Do not reorder/reformat others' tables. |
| `convex/_generated/*` | everyone | Regenerate with `npx convex codegen`; never hand-edit. |
| `src/theme/tokens.ts`, `design/tokens.json` | all UI | Frozen. Re-export from Claude Design only. |
| `app/_layout.tsx`, `app/(tabs)/_layout.tsx` | new routes | Track A owns. B/C open a tiny PR or ask A. |
| `convex/quotas.ts` | #15 #20 #24 #29 | Track B only. No local quota forks. |
| `src/lib/share.ts` | #11 #16 #21 #26 | Track C owns (#36). |
| `src/components/*` (base) | everyone | Track A owns the library. |

## Unverified / unknown
Everything the map could not confirm. Be explicit — this is the list the next person picks up.
- `npm start` not run in this session.
- `npx convex codegen` not run yet (no new modules on this map pass).
- No ESLint/Prettier script.
- RevenueCat dashboard/Test Store configuration is human-owned; device validation remains in #37.
- Full RVR1960 corpus is not in git (copyright); #5 must ingest from a fixture + documented loader.
- NVI license still unresolved (`PRD.md`).
- `no-mistakes` CLI not confirmed installed in this repo.
