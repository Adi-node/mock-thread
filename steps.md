# steps.md — Active Milestone Instructions

Progress log (compact — details live in PLAN.md appendices):

- Milestone 1 — Foundations (T001, T003, T002): **IN PROGRESS — not reviewed**
- A2/A2b done: turbo 2.11.10 installed; esbuild install-script approved via `allowBuilds: {esbuild: true}` in pnpm-workspace.yaml (pnpm 12.14 syntax — the pre-12 `pnpm.onlyBuiltDependencies` field in package.json is no longer read; discovered during A2, documented in A2b).
- A3 done: `apps/web` scaffolded with create-next-app 16.4.3 (`--disable-git`; auth defaults observed: Cache Components on, AGENTS.md generated inside apps/web, Tailwind via `@tailwindcss/turbopack`, Turbopack bundler). Scaffold artifacts removed: apps/web/pnpm-workspace.yaml + apps/web/pnpm-lock.yaml. `unrs-resolver` added to allowBuilds. `pnpm ls -r` shows root + `web@0.1.0` — **PENDING: rename apps/web package name to `@mt/web` + re-run pnpm install** (first transaction of the bookkeeping note in A3 "Finish A3").

NEXT STEP: A8 (verify + commit Part A). A7 done: root AGENTS.md written by agent (covers: PLAN.md-as-truth, repo map, turbo/pnpm-12/allowBuilds realities, Next 16.4.3 caveats incl. apps/web/AGENTS.md being tool-managed and kept, working agreements).

Remaining Part A items before review: A8 verification table (`pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm dev` landing render) + the `task(T001)` commit (user's work commits there together — first commit including scaffold).
- Instructions updated to use turborepo (PLAN.md §5.2 decision #21 + §10 T001 amended; run logs note: PLAN.md + steps.md updated together in one commit before any code was written).
- Completed: none yet. No application code exists; repository contains only PLAN.md.

---

# Milestone 1 — Foundations: Monorepo scaffold, dev infrastructure, database layer

## A. Milestone overview

- **Milestone number and name**: Milestone 1 — Foundations
- **Corresponding plan tasks**: T001 (Monorepo scaffold), T003 (Dev infra compose + env loading), T002 (packages/db: Prisma + Postgres)
- **Goal**: A clean pnpm-workspace monorepo whose Next.js app builds with strict TypeScript and Tailwind; local Postgres + Redis boot with one Docker Compose command behind a zod-validated env module; the full Prisma schema from PLAN.md §8.1 applies as a migration with a reusable client singleton and a Topics seed stub.
- **Why it is needed**: Every later task (auth, rooms, banker, realtime, worker) imports the workspace packages, the env module, and the Prisma client. Building these first prevents cross-package drift and gives us the local infra everything else runs against.
- **Dependencies / prerequisites**: An empty repo. Tools already present on this machine: Node 24 (plan requires ≥22 for Hocuspocus v4), pnpm 12, Docker + Compose. Reference code to port patterns from: `~/algo-arena` (Prisma v7 singleton, `prisma.config.ts`, flag conventions).
- **Definition of completion**: All acceptance criteria below verified on your machine:
  - [ ] `pnpm i && pnpm build` succeeds in the repo
  - [ ] `pnpm lint` is clean
  - [ ] The landing page renders at localhost
  - [ ] `docker compose -f docker/compose.dev.yaml up -d` boots Postgres + Redis; `redis-cli ping` replies PONG; psql connects
  - [ ] `pnpm dev` boots with compose up and connects to both Postgres and Redis (env module loads fail-fast)
  - [ ] `pnpm --filter @mt/db exec prisma migrate status` shows migrations applied
  - [ ] A smoke query from `apps/web` returns seeded topics
  - [ ] First commit(s) made with message format `task(T00x): summary`

Order of work inside the milestone: Part A (T001) → Part B (T003) → Part C (T002). If you get stuck mid-part, stop and report the error — do not skip ahead.

---

## Part A — T001: Monorepo scaffold (plan §10 Phase 0)

### A1. Create the workspace root files

**Objective**: Define the pnpm workspace and root scripts.
**Files involved**: `pnpm-workspace.yaml`, `package.json` (root), `.gitignore`

**What to do**: In `/home/adi/mock-thread` create:

`pnpm-workspace.yaml` — declares which folders are workspace packages:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Root `package.json` — private, no published code, holds shared scripts:

```jsonc
{
  "name": "mock-thread",
  "private": true,
  "packageManager": "pnpm@12.14.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "migrate": "pnpm --filter @mt/db exec prisma migrate dev"
  },
  "devDependencies": {
    "prettier": "^3",
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

(Exact versions: use what pnpm resolves today; only `packageManager` should be the literal installed version. `pnpm migrate` is a root convenience — plan T002 verification uses the filter form. The `turbo run` scripts assume Part A2 installs turbo before they're first exercised.)

`.gitignore`:

```
node_modules/
.next/
.turbo/
dist/
coverage/
.env
.env.*
!.env.example
*.tsbuildinfo
```

**Why**: The workspace file is what makes `@mt/shared`, `@mt/db` etc. importable across apps later. Root scripts mean you type one command regardless of which packages exist. Turborepo (decision #21 in PLAN.md §5.2) adds graph-parallel scheduling and content-hash caching on top of pnpm workspaces — pnpm stays the *only* package manager; turbo is purely the task runner.

### A2. Turborepo setup

**Objective**: Give the workspace a task runner so build/typecheck/test scale as packages appear.

**Terminal commands** (run from repo root):

| Command | What it does |
|---|---|
| `pnpm add -D -w turbo` | Installs turbo as a root-only dev dependency (`-w` = workspace root). |

**Files involved**: `turbo.json` (root) — create it with:

```jsonc
{
  "$schema": "https://turbo.build/repo/docs/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {},
    "lint": {}
  }
}
```

**Why each value is what it is** (worth writing a one-line comment in your own words somewhere — this is the part that bites later):
- `build.dependsOn: ["^build"]` — "build my dependencies first"; `^` means "in packages I depend on".
- `outputs` excludes `.next/cache` — it's a machine-specific build intermediate, not a cacheable artifact; caching it would poison incremental builds.
- `dev` must be `cache: false, persistent: true` — long-running processes must never be cached or awaited.
- `typecheck.dependsOn: ["^build"]` is conservative (strict TS often wants dependency declaration files). In Milestone 1 the only package with a real build is `@mt/web`, so the graph is trivial until realtime/worker exist.
- Packages without a `build` script (soon `@mt/shared`, `@mt/db` — they ship raw TS) are **skipped** by turbo silently, which is the intended behavior, not a gap.

**Naming clarity (goes in AGENTS.md in A7):** *Turborepo* (task runner, this section) is a different thing from *Turbopack* (the bundler create-next-app enabled by default in Next 16). Both will show up in logs; don't confuse them.

### A2b. pnpm 12 install-script approval (required after the first `pnpm add`)

**What happens**: pnpm ≥ 10 blocks third-party dependencies' `postinstall`/build scripts by default (supply-chain protection). Installing turbo pulls in packages that need native binaries — first hit: `esbuild` (transitive dep of `tsx`/`vitest`). pnpm aborts with:

```
Error: ERR_PNPM_IGNORED_BUILDS — Ignored build scripts: esbuild@x.y.z
help: Run "pnpm approve-builds" ...
```

**This is expected, not an error to fix by reinstalling.** Approve the build script in `pnpm-workspace.yaml` — the pnpm-12 home for these settings (the legacy `pnpm` field inside `package.json` is **no longer read**; don't use it):

```yaml
packages:
  - "apps/*"
  - "packages/*"

allowBuilds:
  esbuild: true
```

It's a map of package-name → `true`/`false`, not a list. Then re-run `pnpm install` — expect a line like `Running postinstall script, done in …` for esbuild and no `ERR_PNPM_IGNORED_BUILDS`. Prove the binary works with `pnpm exec tsx --version`.

Alternative: `pnpm approve-builds` (interactive selector) writes the same entry for you. Both are equivalent; either way the allowlist lives in the committed `pnpm-workspace.yaml`, which is the point — reproducible for anyone cloning the repo.

**Security framing (goes in AGENTS.md in A7)**: an `allowBuilds` entry grants *code execution at install time* to the named package — keep the list minimal and each entry justifiable (esbuild: native binary required by tsx/vitest; prisma: downloads its query engine).

**Ongoing recipe** (this exact pattern repeats all milestone long): whenever `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS — Ignored build scripts: <name>@<ver>`, add `<name>: true` to `allowBuilds` **only for the names pnpm actually reported**, re-run `pnpm install`, and move on. Packages seen so far on this project: `esbuild` (via tsx/vitest), `unrs-resolver` (via eslint-config-next, appeared when `apps/web` joined the workspace). Expect more in Part C (prisma family) if pnpm reports them.

### A3. Scaffold the Next.js app

**Objective**: A building Next.js App Router app with TS strict, Tailwind v4, ESLint.

**Terminal commands** (run from repo root):

| Command | What it does |
|---|---|
| `pwd` | Confirms you are in `/home/adi/mock-thread` — the scaffold resolves the target relative to the current directory. |
| `mkdir -p apps` | **Required before scaffolding.** create-next-app checks writability of the *parent* of the target (`apps/`), and a non-existent parent fails the check with a misleading "The application path is not writable / check folder permissions" error. Pre-creating `apps/` avoids it. |
| `pnpm create next-app@latest apps/web --typescript --app --tailwind --eslint --src-dir --import-alias "@/*" --disable-git` | Scaffolds `apps/web`. `--disable-git` is essential: without it create-next-app runs `git init` inside `apps/web`, creating a nested repo that breaks tracking in our existing root repository. If the CLI prints "Using defaults for unprovided options" (e.g. React Compiler off, Cache Components on, AGENTS.md on), that is expected — defaults accepted; record anything surprising so it can land in AGENTS.md. Observed with 16.4.3: devDeps include `@tailwindcss/turbopack` (not `@tailwindcss/postcss`), an `AGENTS.md` is written *inside* `apps/web`, and route types are generated at the end. |
| `rm apps/web/pnpm-workspace.yaml` | **Workspace cleanup.** create-next-app 16.4.3 generates its own `pnpm-workspace.yaml` inside `apps/web`; inside our workspace pnpm reads settings only from the root file, so the nested one is dead weight and triggers the WARN "settings in apps/web/pnpm-workspace.yaml do not apply". `cat` it first in case a future scaffold version puts real settings there (then merge them into the root file before deleting). |
| `if [ -f apps/web/pnpm-lock.yaml ]; then rm apps/web/pnpm-lock.yaml; fi` | The scaffold ran a self-contained `pnpm install` before the folder joined the workspace, so a stray per-project lockfile may exist. The root `pnpm-lock.yaml` must be the single source of truth; delete the nested one. |
| `pnpm install` | Links the workspace. Expect possible `ERR_PNPM_IGNORED_BUILDS` for new native deps coming with the app (e.g. `unrs-resolver` via eslint-config-next) — handle per the A2b recipe. Also expect a `deprecated eslint@9.39.5` WARN: eslint-config-next still pins ESLint ^9 while 10.x exists upstream — informational, do not act. |
| `pnpm ls -r --depth -1` | Sanity check: confirms the workspace links the app. Expect exactly two entries: `mock-thread` (root) and `web@0.1.0` (apps/web). |

**Why**: Handcrafting the Next.js config wastes time and drifts from current-version conventions — the scaffold is the sane starting point. **Important caveat (goes in AGENTS.md below in A7)**: Next.js App Router conventions change between versions; consult the docs for the *installed* version (likely Next 16) rather than assuming older training-data conventions.

**Finish A3 — rename the package** (the scaffold names it `web@0.1.0`): edit `apps/web/package.json`'s `"name"` field to `@mt/web`, then re-run `pnpm install` so the lockfile records the new name. All later commands use `--filter @mt/web`, e.g. `pnpm --filter @mt/web dev`. If the filter doesn't resolve, the rename wasn't saved or the install wasn't re-run.

### A4. Tailwind + lint/format config

- Keep the scaffold's Tailwind v4 setup. Note: Next 16.4.3 scaffolds `@tailwindcss/turbopack` as the Tailwind integration (not `@tailwindcss/postcss` as older guides say) — keep what the scaffold gave you and don't "fix" it back.
- Add `prettier` at the ROOT only: create a minimal `.prettierrc.json` (`{ "semi": true, "singleQuote": false, "printWidth": 100 }`) and a `.prettierignore` (`node_modules`, `.next`, `pnpm-lock.yaml`). No config plumbing in each package yet — root prettier is enough for now.
- No extra ESLint plugins. `eslint-config-next` from the scaffold is the standard.

**Why**: One formatter, no shared-config bikeshedding this early. Deviates from nothing in the plan.

### A5. Landing page

**Objective**: A place-holder landing that proves the render path.
**Files involved**: `apps/web/src/app/page.tsx`, `apps/web/src/app/layout.tsx`

**What to do**: Replace the scaffolded page with a minimal product landing: project name "MockThread", one sentence ("Real-time peer-to-peer mock technical interviews"), and a "Log in" link (href `/login`, which we'll first wire up during Task T004 — a 404 is expected there until then). Dark background, Tailwind classes only. Keep `layout.tsx`'s `<html>`/`<body>` structure; just adjust metadata title.

**Why**: The plan's acceptance is "landing page renders at localhost" — this is the visible proof the app boots.

### A6. `.env.example` (every var from §13.1)

**Files involved**: `.env.example` (repo root). Copy the variable names + comment header exactly from PLAN.md §13.1 (Core, Auth.js, LLM, Engine, TURN, Worker, Feature flags, Test-only overrides). Values blank or obviously-fake placeholders; **no real secrets**.

Deduplicate the two lines the plan squashes with `;` into one var per line (e.g. `AUTH_SECRET=`, `GITHUB_ID=`, `GITHUB_SECRET=`, `GOOGLE_CLIENT_ID=`, `GOOGLE_CLIENT_SECRET=` on separate lines).

### A7. `AGENTS.md`

**Files involved**: `AGENTS.md` (repo root)

**Content**: a short file with:
1. Project map: list `apps/web`, and the planned `apps/realtime`, `apps/worker`, `packages/shared`, `packages/db`, `packages/llm`, `packages/engine` (with their one-line responsibilities from plan §6 table).
2. Commands: `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm migrate`, `docker compose -f docker/compose.dev.yaml up -d`.
3. The Next.js version caveat (consult installed-version docs, not generic App Router memory). Also note Next 16 conventions observed at scaffold time: Cache Components enabled by default, `AGENTS.md` generated inside `apps/web` by create-next-app (the root `AGENTS.md` below is separate and project-wide), Turbopack is the default bundler; create-next-app targets must have an existing parent directory (`mkdir -p apps` first) and get `--disable-git` in a repo context.
4. The Turborepo/Turbopack distinction (A2): Turborepo = task runner that the root scripts call; Turbopack = Next.js bundler. Packages without a `build` script are skipped by turbo silently — that's intended while `packages/*` ship raw TS.
5. The pnpm install-script allowlist (A2b): pnpm 12 blocks dependency postinstall scripts; approved packages live in `allowBuilds` in `pnpm-workspace.yaml` (the `pnpm` field in package.json is dead). Each entry grants install-time code execution — keep minimal and justified.
6. Pointer to PLAN.md as the single source of truth + the rule that architecture changes go through PLAN.md Appendix D.

### A8. Verify + commit

Commands from repo root:

| Command | Expect |
|---|---|
| `pnpm install` | resolves with no peer-dep errors |
| `pnpm build` | turbo runs the graph (only `@mt/web` has a build); Next build succeeds, no TS errors, turbo prints its task summary |
| `pnpm lint` | exits 0 |
| `pnpm dev` then open `http://localhost:3000` | landing page renders; turbo shows `dev` as persistent (no cache) |
| `pnpm typecheck` | turbo runs it (currently only `@mt/web` declares the script — acceptable until more packages exist) |
| `git add -A && git commit -m "task(T001): monorepo scaffold — pnpm workspace + turborepo, Next.js web app, env example, AGENTS.md"` | Part A committed |

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
