# steps.md — Active Milestone Instructions

Progress log (compact — details live in PLAN.md appendices):

- **Milestone 1 — Foundations: T001 ✅, T003 ✅, T002 ✅ — MILESTONE 1 COMPLETE (all three accepted).**
- Full evidence in Part A/B/C accepted-summary blocks below + PLAN.md Appendix C.
- NOW CLEARING FOR: Milestone 2 — T004 (Auth.js v5 port) + T005 (shared contracts). Preview at the bottom of this file; detailed instructions to be written by the reviewer before work starts.
- PLAN.md §5.2 decision #21 (Turborepo) + §10 T001 amended before any code was written.

---

# Milestone 1 — Foundations: Monorepo scaffold, dev infrastructure, database layer

## Part A — T001: Monorepo scaffold — ✅ ACCEPTED (2026-10-29)

All Part A steps (A1 base files, A2/A2b turbo + pnpm-12 allowBuilds, A3 scaffold + cleanup + rename `@mt/web`, A4 prettier, A5 landing, A6 `.env.example`, A7 `AGENTS.md` pair, A8 verification) are complete, review-accepted with all findings fixed, and logged in PLAN.md Appendix C.

Acceptance evidence (verified by reviewer):
- `pnpm build` / `pnpm lint` / `pnpm typecheck` all exit 0 (typecheck: 1 real task, fresh run — no-op bug fixed).
- Landing page render verified from served HTML (HTTP 200): `MockThread` h1, tagline, `Log in` `<Link>` on a centered dark layout; `/login` 404s as designed (T004 wires it).
- No `.env` tracked anywhere; no scaffold leftovers; `allowBuilds` = esbuild, unrs-resolver.

Commits: `c5f52e1 task(T001)` (scaffold) + the user's review-fix commit (landing, typecheck script, formatting).

The detailed Part A instructions were removed from this file at acceptance (per the workflow: steps.md holds only active instructions). What remains active below: **Part B (T003)** and **Part C (T002)**.

---

## Part B — T003: Dev infra compose + env module — ✅ ACCEPTED (2026-10-29)

All B steps (B1 compose, B2 `@mt/shared` env module, B3 web wiring, B4 verify+commit) complete, review-accepted, logged in PLAN.md Appendix C.

Reviewer-verified evidence:
- Compose healthy: postgres:16 + redis:7 up, `PONG`, `pg_isready` accepting. Named volumes + AOF per plan.
- Fail-fast proven in BOTH directions: missing `DATABASE_URL` → `Invalid environment: DATABASE_URL: expected string, received undefined` (thrown from `env.ts` loadEnv); restored → `db configured` indicator (boolean only, no URL leak).
- Fresh `pnpm build`/`lint`/`typecheck` all exit 0.
- Commits: `78ab816` (already merged T001 review fixes), `648d0db task(T003)`.

Carried Minor (fix by end of Part C, your choice, my lean = A):
- env schema declares `ENGINE_URL`, `ENGINE_API_KEY`, `WORKER_CONCURRENCY` which are absent from `.env.example` → two sources of truth. Option A: add them to `.env.example`; Option B: drop from schema. Schema is the contract, so either direction is fine as long as they match. No boot risk (all optional/default'd).

---


## Part C — T002: packages/db (Prisma v7 + Postgres) — ✅ ACCEPTED (2026-11-02)

Completed partly by the user (C1/C2) and partly by the reviewer under explicit user authorization (C2 auth-merge fix, C3 singleton, C4 migrate+seed, C5 smoke wiring) so the milestone could close. All verified from scratch by the reviewer; logged in PLAN.md Appendix C.

Reviewer-verified evidence:
- `prisma migrate status` = up to date (2 migrations); 14 tables verified via psql (FKs, compound PKs, `@@index([difficulty])`).
- Schema: 3 enums + 10 plan models + Account/Session/VerificationToken (docs-verbatim). `Authenticator` intentionally skipped (passkeys out of MVP scope). Deviation logged in Appendix D: `email` optional-unique.
- Adapter-crash risk caught in review: user had omitted `name/email/emailVerified/image` from `User` claiming "not needed for MVP" — adapter source (`createUser` → `p.user.create` with provider profile props) proves the omission breaks first OAuth sign-in; reverted with migration `add_auth_user_fields`.
- Seed: 15 curated CF-topic slugs (§5.2.9), idempotent — "Seeded 15 topics" twice, count stays 15. `Topic.id` has no cuid default in §8.1 → seed uses `id: slug` (readable, idempotent).
- `@mt/db` singleton (`PrismaClient` + `PrismaPg`, env via `@mt/shared`, globalThis dev-cache) consumed by `apps/web` through `transpilePackages`; landing page streams `topicCount` inside a Cache-Components `<Suspense>` — reviewer screenshot: "15 topics in the bank".
- Fresh build/lint/typecheck all exit 0 post-Suspense fix.
- Dev-env duplication (packages/db/.env needs DATABASE_URL/REDIS_URL/AUTH_SECRET) accepted as a dev convenience; service .env files are per-package in dev.

---

## Acceptance checklist (milestone-level, from PLAN.md T001/T003/T002)

- [x] `pnpm i && pnpm build` succeeds *(verified, T001 accept)*
- [x] `pnpm lint` clean *(verified)*
- [x] Landing page renders at localhost (db indicator + topic count — "15 topics in the bank" verified by reviewer screenshot)
- [x] Compose boots Postgres + Redis; PONG + psql connect verified *(verified, T003 accept)*
- [x] `pnpm dev` boots with compose up; env fail-fast demonstrably works *(verified both directions)*
- [x] `pnpm --filter @mt/db exec prisma migrate status` = up to date *(reviewer-run, 2 migrations)*
- [x] Topics smoke query returns from `apps/web` *(server-rendered count verified)*
- [x] Commits follow `task(T00x): …` format; `.env` files gitignored; no secrets committed — **including `packages/*/src/generated/` exclusion** (`git status` clean, generated dir ignored)
- [x] No leftover scaffold artifacts: no `apps/web/pnpm-workspace.yaml`, no `apps/web/pnpm-lock.yaml`, no `.git` inside `apps/web` *(verified)*
- [x] `apps/web/package.json` name is `@mt/web` and filter resolves *(verified)*
- [x] Root `.gitignore` excludes `packages/*/src/generated/` *(added; also fixed the glued `*.tsbuildinfo` line found in review)*

## Known / open items carried into next milestone

- **Carried forward to Milestone 2:** env schema vs `.env.example` var-set alignment remains the user's choice (they commented both out in sync — acceptable; if worker/engine tasks need them later, uncomment both sources together).
- T001 notes: exact Next.js version installed may advance past plan assumptions (plan says "latest stable"); behavior differences go in AGENTS.md, not plan edits unless they contradict §8 contracts.
- T005's 15-topic slug list is something you'll be committing in this milestone's seed stub; T007 (bank validation) may prune later — that's expected, not a deviation.
- `~/algo-arena` confirmed present locally for porting; `~/aiproject/ai_interviewer` confirmed for later WebRTC tasks (T021/T022), not needed now.

## Next milestone preview (do not start until this one is reviewed & accepted)

**Milestone 2 — Auth + shared contracts (T004 + T005)**: Auth.js v5 GitHub/Google OAuth with database sessions + middleware-protected routes (ported from algo-arena's auth.ts), and the `packages/shared` constants/events/redis-keys/zod-schemas layer with the `ratingToDifficulty` boundary unit tests.
