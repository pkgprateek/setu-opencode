# AGENTS.md - Setu OpenCode Development Guide

This repository builds the Setu OpenCode plugin itself.

It is not a downstream app that "uses" Setu to ship product features.

## What This Repo Is

- OpenCode plugin runtime (`src/index.ts` + hooks)
- Setu tool implementations (`src/tools/*`)
- Enforcement engine (`src/hooks/tool-execute.ts`, `src/enforcement/*`)
- Context and artifact persistence (`src/context/*`)
- Bootstrap/install lifecycle (`src/install/*`, `src/cli.ts`, `src/postinstall.ts`)

## Read Order Before Changing Code

1. `AGENTS.md` (this file)
2. `ROADMAP.md` (current direction and release scope)
3. `CHANGELOG.md` (what changed recently)

Deep context (internal, gitignored):

- `docs/internal/ARCHITECTURE.md`
- `docs/internal/PLAN.md`
- `docs/internal/RESEARCH.md`

Important: `docs/internal/` is gitignored. Do not stage or commit internal doc changes.

## Working Rules

- Start with architecture impact, not quick patches.
- Prefer minimal, reversible changes with tests.
- No dead code, no stale comments, no stale docs.
- Keep behavior deterministic and fail-safe for risky paths.

## Core Runtime Surfaces

- Plugin entry and state wiring: `src/index.ts`
- Enforcement chain: `src/hooks/tool-execute.ts`
- Prompt/system injection: `src/hooks/system-transform.ts`
- Lifecycle events: `src/hooks/event.ts`, `src/hooks/chat-message.ts`
- Tool APIs: `src/tools/*`
- Install/bootstrap lifecycle: `src/install/bootstrap.ts`, `src/cli.ts`, `src/postinstall.ts`

## Tool API Truth Source

When docs differ from code, `src/tools/*.ts` is canonical.

Current public tool surface:

- `setu_context`
- `setu_task`
- `setu_research`
- `setu_plan`
- `setu_verify`
- `setu_doctor`
- `setu_reset`

## Development Commands

Runtime requirements:
- Bun >= 1.0.0 (1.3.x recommended)
- Node.js >= 18.0.0 (24+ recommended)
- Verify with `bun --version` and `node --version`

```bash
bun install
bun run build
bun run lint
bun run typecheck
bun test
```

## Quality Bar For PRs

- `bun test` passes
- `bun run lint` passes
- `bun run typecheck` passes
- behavior changes include tests
- docs updated in same PR for API/install/workflow changes

## Documentation Policy

Public docs that must stay aligned with code:

- `README.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `CONTRIBUTING.md`

If you change install/bootstrap behavior, update docs immediately.
If you change tool signatures, update examples immediately.

## Commit Style

Prefer atomic commits by concern:

- `feat(...)` for new capability
- `fix(...)` for bug fixes
- `refactor(...)` for structural cleanup
- `test(...)` for test-only changes
- `docs(...)` for docs-only changes

## Safety Notes

- Avoid destructive git operations.
- Never force push to protected branches.
- Never leak secrets in fixtures, logs, or examples.
