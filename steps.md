# steps.md — Active Milestone Instructions

Progress log (compact — details live in PLAN.md appendices):

- **Milestone 1 — Foundations (T001 ✅, T003 in progress, T002 pending):**
- **Part A (T001) — ✅ ACCEPTED 2026-10-29.** All findings fixed and verified (build/lint/typecheck exit 0; landing render verified from served HTTP 200 HTML; no secrets tracked; no scaffold leftovers). Logged in PLAN.md Appendix C. Commits: `c5f52e1 task(T001)` + the user's review-fix commit.
- **NOW ACTIVE: Part B (T003 — dev compose + `@mt/shared` env module)** → then Part C (T002 — prisma). Instructions below in full.
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

## Part B — T003: Dev infrastructure compose + env loading

### B1. Compose file

**Objective**: one-command local infra.
**Files involved**: `docker/compose.dev.yaml`

**What to do**:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: mockthread
      POSTGRES_PASSWORD: mockthread
      POSTGRES_DB: mockthread
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

- Local dev: **no Redis password** (matches dev REDIS_URL without auth; prod adds `requirepass` per §13.1 comment). Dev-only ports exposed on localhost is fine.
- Named volumes so data survives container restarts; a later `docker compose down -v` is the documented way to wipe.

**Explain-before-run note**: `up -d` starts the two containers in the background and downloads the images the first time (~once). It does not delete anything. With named volumes, your dev data persists across `up`/`down`; only `down -v` erases data.

**Terminal commands**:

| Command | Expect |
|---|---|
| `docker compose -f docker/compose.dev.yaml up -d` | both containers "Started" |
| `docker exec -it $(docker ps -qf "name=redis") redis-cli ping` | `PONG` |
| `psql "postgresql://mockthread:mockthread@localhost:5432/mockthread" -c "\conninfo"` (or `docker exec -it <pg-container> psql -U mockthread -d mockthread -c "\conninfo"`) | connected |

### B2. `packages/shared` + env module

**Objective**: zod-validated env loading used by every app — fail-fast on missing vars.
**Files involved**: `packages/shared/package.json`, `tsconfig.json`, `src/index.ts`, `src/env.ts`

**terminal commands**:

| Command | What it does |
|---|---|
| `mkdir -p packages/shared/src` | creates the package folder |
| Then hand-create `package.json`, `tsconfig.json`, `src/index.ts`, `src/env.ts` below | no generator needed |

Make `packages/shared/package.json` a **source-included package** (no build step yet — consumers import the TS directly; this is the simplest correct setup for pnpm workspaces + Next's bundler):

```jsonc
{
  "name": "@mt/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": { "zod": "^4" },
  "scripts": { "test": "vitest --passWithNoTests" }
}
```

`packages/shared/tsconfig.json` minimal strict TS:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`src/env.ts` — the actual env contract. Pseudocode / syntax guidance (this is guidance, not final code — you write it):

```ts
import { z } from "zod";

// one schema place per §13.1, parsed once per process
const EnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  REDIS_URL: z.string().url(),
  // Auth.js, LLM, engine, TURN, worker, flags — declare required vs. optional
  // thoughtfully: GEMINI_API_KEY is OPTIONAL in dev (tests use a stub provider),
  // TURN_SECRET optional in dev; ENGINE vars only meaningful for the worker.
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // fail-fast: list every missing/invalid var, then throw. Never log secret values.
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  mutated cached and returned;
}

export const env = loadEnv(); // importing modules get a validated object immediately
```

Design decisions to note in a short comment (your rationale, not mine to force):
- **Parse-once module-level singleton** — env is immutable per process; late re-reads cause the classic "it worked in dev, failed in prod" bug class.
- **Failure listing everything at once**, not first-error-only — one roundtrip catches every missing var.
- `z.string().url()` rather than `min(1)` on DB URLs — the shape itself is the contract.
- Recommend `dotenv`-style loading: apps call `import "dotenv/config"` (or use Next's built-in `.env` loading) **before** importing `@mt/shared`'s env module; document this in the package's `src/index.ts` as an exported note. Do not smuggle dotenv into the shared package config.

`src/index.ts` re-exports `env` and `loadEnv`.

### B3. Wire the web app into the env + infra

**Files involved**: `apps/web/.env` (gitignored — copy from `.env.example`), `apps/web/src/app/page.tsx` (tiny change or none), a smoke check.

**What to do**:
1. Create `apps/web/.env` (copy from `.env.example`; **do not commit it — verify `.gitignore` already excludes `.env`**) with local dev values:
   ```
   DATABASE_URL=postgresql://mockthread:mockthread@localhost:5432/mockthread
   REDIS_URL=redis://localhost:6379
   AUTH_SECRET=(run `npx auth secret` ONCE and paste its output value — it's a local secret, only in .env)
   ```
2. Smoke proof the env works: link the shared package into the web app with
   ```
   pnpm --filter @mt/web add @mt/shared@workspace:*
   ```
   Because `@mt/shared` ships raw TypeScript (no build step), `apps/web/next.config.ts` must include it in the bundler:
   ```ts
   // apps/web/next.config.ts
   const nextConfig = { transpilePackages: ["@mt/shared"] };
   export default nextConfig;
   ```
   (When `@mt/db` gets added in Part C, add it to `transpilePackages` too.)
3. Temporarily `import { env } from "@mt/shared";` in the landing page component and render `env.DATABASE_URL ? "db configured" : "db missing"` — **render a boolean indicator, not the URL itself** (don't leak connection strings to the browser).
4. Document `docker compose -f docker/compose.dev.yaml up -d` + `pnpm dev` in `AGENTS.md` commands section (already covers it if you followed A7).

### B4. Verify + commit

| Command | Expect |
|---|---|
| `docker compose -f docker/compose.dev.yaml up -d` | both healthy |
| `pnpm dev` → open `http://localhost:3000` | landing renders and shows the db-configured indicator |
| Break test (proves fail-fast): temporarily comment out `DATABASE_URL` in `apps/web/.env`, restart `pnpm dev` | clear error listing the missing var; **then restore it** |
| `git add -A && git commit -m "task(T003): dev infra compose + zod-validated env module in @mt/shared"` | committed |

---

## Part C — T002: packages/db (Prisma v7 + Postgres)

### C1. Package skeleton

**Files involved**: `packages/db/package.json`, `tsconfig.json`, `prisma.config.ts`, `prisma/schema.prisma`, `src/client.ts`, `scripts/seed-topics.ts`

Commands:

```
mkdir -p packages/db/{prisma,src,scripts}
```

`packages/db/package.json` — modeled on algo-arena's (this refs the PLAN decision "port algo-arena pattern"):

```jsonc
{
  "name": "@mt/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "postinstall": "prisma generate",
    "test": "vitest --passWithNoTests"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7",
    "@prisma/client": "^7",
    "pg": "^8"
  },
  "devDependencies": {
    "prisma": "^7",
    "dotenv": "^17"
  }
}
```

(Then `pnpm install` at the root links it. If the exact prisma major minor differs from 7.8, keep whatever `pnpm` resolves — it just needs to be v7 with the `prisma-client` generator.)

`packages/db/prisma.config.ts` — copy the pattern from `~/algo-arena/prisma.config.ts` (shown earlier in conversation). It needs `import "dotenv/config";` then `defineConfig` with `schema`, `migrations.path`, and `datasource.url` from `process.env.DATABASE_URL`.

**Important**: Prisma v7 requires a `.env` or dotenv-loaded `DATABASE_URL` visible to this package when you run migrate — since compose Postgres is dev-local, create `packages/db/.env` too (gitignored) or rely on `dotenv/config` picking an env you set in the shell. Simplest consistent choice: duplicate the one-line `DATABASE_URL=...` into `packages/db/.env` (gitignored) so directives from the root work; the file is a copy of a dev-only local credential, not a secret leak.

**pnpm 12 heads-up (A2b again)**: installing the db deps will very likely trip `ERR_PNPM_IGNORED_BUILDS` for `prisma` / `@prisma/engines` (they download native engine binaries via postinstall). Extend `allowBuilds` in `pnpm-workspace.yaml` with exactly the packages pnpm names, each as `name: true`, then `pnpm install` again — don't pre-approve blind, approve what the error lists (and it may turn out prisma v7 doesn't need it; only add what pnpm actually reports).

### C2. `schema.prisma` — exactly per §8.1

**What to do**: Author `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"   // generated INSIDE the package, not app code
}

datasource db {
  provider = "postgresql"
}

enum Difficulty { EASY MEDIUM HARD }
enum RoomStatus { PENDING ACTIVE BLOCK1 BREAK BLOCK2 ENDED CANCELLED }
enum BlockStatus { DRAWN RUNNING ENDED }

// then: User, Topic, Question, QuestionTopic, Room, RoomParticipant, Block,
// ExecutionRun, InterviewReport, Notification — EXACTLY the §8.1 models,
// and the Auth.js-standard Account, Session, VerificationToken models that
// @auth/prisma-adapter expects (copy from the latest Auth.js Prisma docs).
```

Key details to get right (each is a real decision, not copy-paste trivia):
- `User.username @unique` (needed for invites in T009), `preferredLanguage @default("python")`.
- `Question.editorial`, `checker` `@db.Text` and **server-side only** — a comment in the schema saying "NEVER send to interviewee" is cheap insurance for T008's leak snapshots.
- `Question.examples` `Json`, `expectedBigO`/`hintLadder` `Json?` (populated by T035 enrichment, null until then).
- `Room.tokenHash @unique` — we store sha256, raw token lives only in the link.
- `RoomParticipant` `@@id([roomId, userId])` compound PK.
- `Block.transcript`/`events` `Json?` (flushed at end from Redis), `finalCode @db.Text`.
- `@@index([difficulty])` on Question (the picker's cell-count query).
- `Topic` model `id String @id; slug String @unique; name String`.
- `Notification` minimal per §8.1.

**Why the generator output path matters**: algo-arena generated into `app/generated/…` (app folder). In a monorepo, generating into the *package* (`packages/db/src/generated/`) is the right call — the client is db-package code, and `apps/*` just import `@mt/db`. Add `src/generated` to `.gitignore` (**root** `.gitignore`: `packages/*/src/generated/`) — never commit generated clients.

**Turbo note (from A2)**: `@mt/db` intentionally has **no `build` script** (raw TS + the generated client), so turbo skips it in the graph. If a turbo cache ever serves a *stale* state around the generated client (symptom: imports typecheck fine after `pnpm build` but fail at runtime, or migrate picks up an old schema), the fix is declaring explicit `inputs`/`outputs` for db-package tasks — treat as a parked known-issue, act only if a symptom appears.

### C3. Client singleton

**Files involved**: `packages/db/src/client.ts`, `packages/db/src/index.ts`

Port the singleton from `~/algo-arena/lib/prisma.ts` (read it first — it's ~8 lines):

```ts
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
```

Differences to handle vs algo-arena's version:
- Import the client from the local generated path (above), not `@/app/generated/...`.
- Connection string should come from the **shared env module** (`env.DATABASE_URL`) rather than `process.env!` — that's why Part B exists and gives us one validated source of truth. Keep the same shape otherwise: `PrismaPg({ connectionString })`, global-caching on `globalThis` to avoid dev-hot-reload connection churn, plus `if (NODE_ENV !== "production") globalThis.prisma = prisma` bridging.
- `src/index.ts` should export the singleton plus the model types the rest of the codebase imports.

### C4. Migrate + seed stub

**Terminal commands** (run from repo root with compose up):

| Command | What it does / expect |
|---|---|
| `pnpm install` | links `@mt/db`; `postinstall: prisma generate` runs; generated client lands in `src/generated/prisma` |
| `pnpm --filter @mt/db exec prisma migrate dev --name init` | creates `prisma/migrations/<ts>_init/`; `migrate status` then shows all applied. Expect no drift errors on a fresh DB. |
| `pnpm --filter @mt/db exec prisma migrate status` | prints "Database schema is up to date!" — **this exact command is the plan's T002 verification line** |

Seed stub — `packages/db/src/scripts/seed-topics.ts` (or `scripts/seed-topics.ts` inside the package, wired via `tsx`). Guidance, not final code:

```ts
// ~15 curated CF-topic slugs per plan §5.2.9 — you pick the real 15 now from
// the plan's "Topics: ~15 curated CF tags"; keep them lowercase kebab-case.
const TOPICS = [
  /* e.g. "two-pointers", "graphs", "dp", "greedy", "binary-search", ... (~15) */
  // T007 will prune thin cells later; start with a sensible superset.
];

// idempotent upsert per slug → Topic row
// for (const slug of TOPICS) prisma.topic.upsert({ where: { slug }, ... });
// exit cleanly; print "Seeded N topics"
```

Why seeded *now*: T008's `GET /api/bank/cells?topicId=` needs valid Topic ids; T010's room creation joins `topicId`. But we don't ingest questions yet (T006), so row count is intentionally 0 — the smoke test proves Topic-table shape, not bank volume.

Add root script `"seed": "pnpm --filter @mt/db seed"` if you wire a package-level script.

### C5. Smoke: web → db → topics

**Files involved**: `apps/web/src/app/page.tsx` (temporary import)

**What to do**:
1. From repo root: `pnpm --filter @mt/web add @mt/db@workspace:*`, then add `"@mt/db"` to `transpilePackages` in `apps/web/next.config.ts` (same as `@mt/shared` in B3 — the db package ships raw TS too).
2. On the landing page (server component), call `prisma.topic.count()` (make the page `async`), render the count (e.g. "3 topics ready" once you've run the seed; "0 topics" pre-seed is also fine — the goal is a successful round-trip, not data volume).
3. `pnpm dev` → landing still renders, now showing the count.

**Constraint to honor**: keep this temporary count-display code, we'll replace it in the Milestone 2 landing-page polish, or simplify before T004 changes the page. It's scaffolding, not a feature.

### C6. Verify + commit

| Command | Expect |
|---|---|
| `pnpm --filter @mt/db exec prisma migrate status` | up to date |
| `pnpm --filter @mt/db seed` (once wired) | "Seeded N topics" |
| `pnpm --filter @mt/web` dev server's landing page | topic count displays |
| `pnpm build` | still clean end-to-end |
| `git add -A && git commit -m "task(T002): prisma v7 schema per §8.1, client singleton, topics seed stub"` | committed |

---

## Acceptance checklist (milestone-level, from PLAN.md T001/T003/T002)

- [ ] `pnpm i && pnpm build` succeeds
- [ ] `pnpm lint` clean
- [ ] Landing page renders at localhost (shows db indicator + topic count)
- [ ] Compose boots Postgres + Redis; PONG + psql connect verified
- [ ] `pnpm dev` boots with compose up; env fail-fast demonstrably works
- [ ] `pnpm --filter @mt/db exec prisma migrate status` = up to date
- [ ] Topics smoke query returns from `apps/web`
- [ ] Commits follow `task(T00x): …` format; `.env` files gitignored; no secrets committed
- [ ] No leftover scaffold artifacts: no `apps/web/pnpm-workspace.yaml`, no `apps/web/pnpm-lock.yaml`, no `.git` inside `apps/web`
- [ ] `apps/web/package.json` name is `@mt/web` and `pnpm --filter @mt/web exec next --version` resolves (proves the rename + lockfile are consistent)
- [ ] Root `.gitignore` excludes `packages/*/src/generated/`

## Known / open items carried into next milestone

- T001 notes: exact Next.js version installed may advance past plan assumptions (plan says "latest stable"); behavior differences go in AGENTS.md, not plan edits unless they contradict §8 contracts.
- T005's 15-topic slug list is something you'll be committing in this milestone's seed stub; T007 (bank validation) may prune later — that's expected, not a deviation.
- `~/algo-arena` confirmed present locally for porting; `~/aiproject/ai_interviewer` confirmed for later WebRTC tasks (T021/T022), not needed now.

## Next milestone preview (do not start until this one is reviewed & accepted)

**Milestone 2 — Auth + shared contracts (T004 + T005)**: Auth.js v5 GitHub/Google OAuth with database sessions + middleware-protected routes (ported from algo-arena's auth.ts), and the `packages/shared` constants/events/redis-keys/zod-schemas layer with the `ratingToDifficulty` boundary unit tests.
