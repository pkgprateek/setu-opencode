---
title: FAQ
description: Frequently asked questions about Setu behavior, safety, and workflow.
---

# FAQ

## How does Setu reduce hallucination risk?

Setu combines runtime enforcement (hook-level blocking and gating) with structured research/plan contracts. The model is guided to reason better and blocked from unsafe sequencing.

## Is Setu only prompt engineering?

No. Prompt guidance exists, but core protection comes from runtime hooks and constraints.

## Does Setu replace OpenCode Plan/Build modes?

No. Setu works with OpenCode modes and adds guardrails, continuity, and verification discipline.

## Where does Setu store context and artifacts?

Under `.setu/` in your project, including task state, context, research, plans, and verification logs.

## When should I use `setu_task(reframe)` instead of `create`?

Use `reframe` when the objective is the same but scope/detail changed. Use `create` when the objective itself is new and should reset task boundary and artifacts.

## What is the difference between `setu_task(create)` and `setu_task(reframe)`?

- `create`: new objective, replaces task boundary, archives previous artifacts
- `reframe`: same objective evolving, keeps current artifacts

## Why is Setu asking for read-before-write?

To prevent accidental overwrite of existing files. Read first, then edit.

## Can I use Setu with other plugins?

Yes. See [Interoperability](./INTEROPERABILITY.md). Setu is designed as a discipline layer that can coexist with other orchestration plugins.

## Does Setu force me to use all tools every time?

No. Setu enforces sequencing and safety, not unnecessary ceremony. Use only the tools needed for your objective.

## How do docs auto-update to getsetu.dev?

Use the deploy-hook pattern documented in [Docs Publishing Pipeline](./recipes/docs-publishing.md).
