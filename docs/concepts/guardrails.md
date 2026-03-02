---
title: Guardrails
description: How Setu enforces safe, ordered execution before and during implementation.
---

# Guardrails

Setu guardrails are runtime enforcement, not prompt-only advice.

## Core guardrails

### Hydration gate

Before context is confirmed, mutating actions are blocked. This forces understanding before edits.

### Read-before-write

If a target file already exists, Setu requires a read before editing to reduce accidental overwrite risk.

### Constraint enforcement

Active task constraints (`READ_ONLY`, `NO_PUSH`, `NO_DELETE`, `SANDBOX`) are enforced before tool execution.

### Safety confirmation and hard blocks

Setu classifies risky actions and either:

- asks for explicit user confirmation, or
- hard-blocks destructive paths.

### Verification before commit/push

In Setu mode, commit/push is blocked until verification is complete.

## Why this matters

Without guardrails, model quality alone cannot prevent unsafe or out-of-order actions.
Setu makes safe behavior the default path.

For implementation-level details, see [Security Model](../reference/security-model.md).
