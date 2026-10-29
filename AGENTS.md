# AGENTS.md — MockThread (project-wide)

Instructions for coding agents and humans joining this repo. Keep it short and true; outdated advice here is worse than none.

## What this project is

Real-time peer-to-peer mock technical interview platform (two 45-minute blocks, random roles, WebRTC A/V, CRDT editor + whiteboard, sandboxed code execution, AI assist for the interviewer, evidence-anchored reports).

**`PLAN.md` is the single source of truth** for requirements, architecture, task list (T001–T056), and decisions (§5.2 + Appendix D). Do not contradict it; changes to requirements/architecture must update PLAN.md and get an Appendix D entry in the same change. `steps.md` holds the *active milestone's* working instructions only — it is intentionally rewritten as milestones complete.

## Repo map

| Path | Status | Responsibility |
|---|---|---|
| `apps/web` | exists (Next.js 16.4.3, App Router, Tailwind v4) | UI + REST route handlers (auth, rooms, tickets, runs, assists, reports, profile) |
| `apps/realtime` | planned | Socket.io server (ticket auth, timer ticks, signaling, transcript relay) + Hocuspocus (Yjs docs) |
| `apps/worker` | planned | BullMQ consumers: `exec` (sandboxed code runs) and `eval` (report generation); `WORKER_MODE=exec|eval|all` |
| `packages/shared` | planned | Constants, zod contracts, Socket.io event map, Redis key builder, zod env module |
| `packages/db` | planned | Prisma v7 schema (PLAN §8.1) + client singleton |
| `packages/llm` | planned | LLM adapter (Vercel AI SDK + Gemini), token bucket, degradation helpers, prompts |
| `packages/engine` | planned | dockerode runner + grader (ephemeral sandbox containers) |
| `docker/`, `scripts/`, `e2e/` | planned | Compose files, ingest/validation scripts, Playwright specs |

## Commands

All run from the repo root. Package manager: **pnpm 12.14** (pinned via `packageManager`).

```bash
pnpm install                                      # links all workspace packages
pnpm dev                                          # turbo run dev (currently apps/web only)
pnpm build | lint | typecheck | test              # turbo run <task> across the graph
pnpm migrate                                      # = prisma migrate dev inside @mt/db
pnpm --filter @mt/web dev                         # single app dev server
docker compose -f docker/compose.dev.yaml up -d   # local Postgres 16 + Redis 7 (AOF) for Part B onward
```

Filter notes: packages are named `@mt/<name>` (`@mt/web`, soon `@mt/shared`, `@mt/db` …). If a `--filter` doesn't resolve, check the package's `name` field and that `pnpm install` ran after any rename.

## Monorepo tooling — what's actually in force here

- **pnpm workspaces** (root `pnpm-workspace.yaml` lists `apps/*`, `packages/*`) for install/linking.
- **Turborepo** is the task runner on top (root `turbo.json`, decision #21 in PLAN.md §5.2): root scripts are `turbo run …`.
  - **Turborepo ≠ Turbopack.** Turborepo = this task runner. Turbopack = Next.js 16's default bundler inside `apps/web`. Both appear in logs; don't conflate diagnostics between them.
  - Packages with no `build` script (raw-TS packages like the planned `@mt/shared`/`@mt/db`) are **silently skipped** by turbo — intended, not a gap. Their `typecheck` does not glob `^build` deps.
- **pnpm 12 settings live in the root `pnpm-workspace.yaml` only.** The legacy `pnpm` field inside `package.json` is no longer read.
  - Dependency install scripts are **blocked by default** (`ERR_PNPM_IGNORED_BUILDS`). Approved packages live in `allowBuilds` (map of `name: true/false`) in the root `pnpm-workspace.yaml`. Each entry grants install-time code execution — keep it minimal, add **only names pnpm actually reported**, never pre-approve. Seen so far: `esbuild` (tsx/vitest native binary), `unrs-resolver` (eslint-config-next).
- Dev data services run in Docker with named volumes; wiping dev data is `docker compose -f docker/compose.dev.yaml down -v`. `.env`/`*.env` files are gitignored — never commit real credentials; `.env.example` is template-only.

## Next.js 16 caveats (version of record: 16.4.3)

- **This Next.js is newer than your training data.** Before writing page/-route/layout code, consult the bundled docs: `apps/web/node_modules/next/dist/docs/` (the app-local copy; `next` may not resolve from the repo root in this pnpm workspace). Heed deprecation notices.
- Scaffold conventions assumed (create-next-app 16.4.3 defaults): App Router + `src/` dir, TS strict, Tailwind v4 via **`@tailwindcss/turbopack`** (not `@tailwindcss/postcss` — don't "fix" it back), Turbopack bundler, **Cache Components enabled**, `AGENTS.md` auto-managed inside `apps/web`.
- **`apps/web/AGENTS.md` exists and is necessary — keep it.** That file (markers `BEGIN/END:nextjs-agent-rules`) is generated and re-added by `next dev` itself; it carries the version-specific warning and pointers above. Read it when working on the web app. Do not hand-delete it — removal only re-creates itself on the next dev run.
- `transpilePackages: ["@mt/shared"]` (and later `@mt/db`) in `apps/web/next.config.ts` is required because workspace packages ship raw TS.

## Working agreements

- Commit messages follow `task(T00x): summary` for plan tasks (PLAN §10) and plain `chore:/docs:/fix:` for tooling/docs-only changes.
- Everything is server-authoritative per PLAN §12; never trust client role claims. Interviewee-bound payloads must never contain editorial/checker/expected Big-O/hints (snapshot-tested later; keep the schema comments when you see them).
- Do not switch package managers, add joke dependencies, or "modernize" configs without recording the change in PLAN.md Appendix D.
