---
title: Runtime Lifecycle
description: Hook lifecycle and mode-aware behavior inside the Setu OpenCode plugin.
---

# Runtime Lifecycle

Setu combines agent permissions and runtime hooks to enforce disciplined execution.

## Key hooks

- `config`: sets Setu as default agent when user default is not set
- `experimental.chat.system.transform`: injects state, contracts, and context
- `chat.message`: tracks active agent and session-level Setu initialization
- `tool.execute.before`: hydration, safety, constraints, and gear enforcement
- `tool.execute.after`: verification and context tracking
- `event`: session lifecycle, context loading, rule injection
- `experimental.session.compacting`: compaction safety for task continuity

## Session lifecycle

On session start, Setu:

1. Resets verification and attempt trackers
2. Loads project rules (Silent Exploration)
3. Loads persisted context when available
4. Marks hydration confirmed when persisted context is loaded

## Mode-aware behavior

- **Setu mode**: full discipline and enforcement (`tool.execute.before/after` active)
- **Build mode**: Setu runtime enforcement hooks do not gate tool execution
- **Plan mode**: Setu runtime enforcement hooks do not gate tool execution

Note: system/context injection may still appear in non-Setu agents, but hard execution gating is Setu-agent scoped.

## Enforcement ordering (before tool execution)

1. Question block / unresolved decision checks
2. Hydration gate
3. Overwrite guard
4. Safety classification and confirmation flow
5. Git discipline checks (verification before commit/push)
6. Path validation and secrets detection
7. Task constraint enforcement
8. Gear enforcement

## Persistence model

Setu stores continuity artifacts under `.setu/` and uses them to survive restarts and compaction.
