---
title: Tools Reference
description: Public Setu tool surface, signatures, and intended usage.
---

# Tools Reference

Setu's public tool surface:

- `setu_context`
- `setu_task`
- `setu_research`
- `setu_plan`
- `setu_verify`
- `setu_doctor`
- `setu_reset`

## At a glance

| Tool | Primary purpose | Typical phase |
|---|---|---|
| `setu_context` | Confirm understanding and unlock side effects | Scout -> Architect transition |
| `setu_task` | Create/reframe/update task boundaries and constraints | Any |
| `setu_research` | Persist structured research to `RESEARCH.md` | Scout |
| `setu_plan` | Persist executable plan to `PLAN.md` | Architect |
| `setu_verify` | Run verification protocol | Builder |
| `setu_doctor` | Preflight environment checks | Before complex work |
| `setu_reset` | Reset plan progress state | Builder recovery |

## `setu_context`

Confirm that context has been gathered and understood.

Required args:

- `summary: string`
- `task: string`

Optional args:

- `plan: string`

## `setu_task`

Manage active tasks and constraints.

Actions:

- `create`
- `reframe`
- `update_status`
- `clear`
- `get`

Optional args:

- `constraints?: string[]`
- `status?: "in_progress" | "completed" | "blocked"`
- `references?: string[]` (URLs or relative file paths)

Important semantics:

- `create` replaces task boundary and archives prior artifacts
- `reframe` updates intent/constraints without resetting artifacts
- `update_status` tracks progress only
- `clear` is a manual reset action for explicit cancellation/reset flows

Constraint note:

- Reframe flows preserve existing stronger constraints when a downgrade is attempted.

## `setu_research`

Create comprehensive `RESEARCH.md`.

Args:

- `content: string` (required)
- `openQuestions?: string`
- `mode?: "append" | "remake" | "auto"`

Large payload handling:

- Very large research payloads are chunked under `.setu/research_chunks/` and summarized in `RESEARCH.md`.

## `setu_plan`

Create detailed `PLAN.md` with atomic execution steps.

Args:

- `content: string` (required)
- `objective?: string`
- `mode?: "append" | "remake" | "auto"`

Precondition: `RESEARCH.md` must exist.

## `setu_verify`

Run build/test/lint verification protocol.

Args:

- `steps?: string[]`
- `skipSteps?: string[]`

Auto-detects build ecosystem (npm/yarn/pnpm/bun, cargo, go, uv/pip).
Default required checks are build/test/lint when available.

Execution behavior:

- Runs checks directly when execution context supports it.
- Falls back to a runnable protocol output when auto-exec is unavailable.
- Writes verification records for executed checks.
- Writes step result artifacts when checks pass and step state can advance.

## `setu_doctor`

Run preflight health checks for environment quality.

Args:

- `verbose?: boolean`

Checks git status, dependencies, runtime binaries, and project rules.

## `setu_reset`

Reset plan progress to step 0.

Args:

- `clearLearnings?: boolean`
