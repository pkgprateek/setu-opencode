---
title: Artifacts and State
description: Complete reference for .setu artifacts, lifecycle, and operational meaning.
---

# Artifacts and State

Setu persists task context and execution evidence under `.setu/`.

## Core files

- `context.json`: confirmed context summary and read/search history
- `active.json`: active task, constraints, progress, learnings
- `RESEARCH.md`: research artifact
- `PLAN.md`: implementation plan artifact
- `HISTORY.md`: archived previous research/plan artifacts
- `verification.log`: verification step logs
- `security.log`: safety/security audit events

## Result and chunk directories

- `results/step-<n>.md`: step verification records
- `research_chunks/research.part-*.md`: chunked research payloads for large content

## Lifecycle notes

- `setu_task(action="create")` archives old `RESEARCH.md`/`PLAN.md` into `HISTORY.md`.
- `setu_research` in `auto` mode appends when `RESEARCH.md` exists.
- `setu_plan` requires `RESEARCH.md` and can append/remake.
- `setu_verify` records verification outcomes and advances step state.
