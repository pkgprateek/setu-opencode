---
title: Gear Workflow
description: Scout, Architect, and Builder phases and how Setu transitions between them.
---

# Gear Workflow

Setu enforces a three-phase workflow:

1. Scout
2. Architect
3. Builder

## Scout

Goal: understand the codebase and task boundaries.

- Read/search tools are expected.
- Research is captured with `setu_research`.
- Generic implementation edits are intentionally constrained.

## Architect

Goal: design a high-confidence execution path.

- Convert research into an actionable plan via `setu_plan`.
- Define atomic steps, verification intent, and rollback thinking.

## Builder

Goal: execute plan safely and verify outcomes.

- Implement planned changes.
- Run `setu_verify` before claiming completion.

## How gear is determined

Setu derives gear from artifacts:

- Missing `RESEARCH.md` => Scout
- `RESEARCH.md` exists, `PLAN.md` missing => Architect
- Both exist => Builder

## Task boundary rule

When objective changes, create a new task boundary with `setu_task(action="create")`.
This resets workflow artifacts for the new objective.
