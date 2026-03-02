---
title: Monorepo Setup
description: Use Setu in monorepos without losing sandbox boundaries or workflow clarity.
---

# Monorepo Setup

Setu works well in monorepos when task scope is explicit.

## Recommended pattern

1. OpenCode from repo root.
2. Create task with explicit package scope in task text.
3. Keep `SANDBOX` enabled unless cross-package edits are required.

Example:

```text
setu_task({
  action: "create",
  task: "Update auth middleware in packages/api only",
  constraints: ["SANDBOX", "NO_PUSH", "NO_DELETE"]
})
```

## Tips

- Put package path in objective text.
- Ask Setu to list affected files before edits.
- Use `setu_doctor` before large refactors.

## Verification

If your monorepo has scoped scripts, run verification in package-aware form after Setu checks.
