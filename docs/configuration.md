---
title: Configuration
description: Configure setu-opencode plugin wiring, task constraints, and workflow expectations.
---

# Configuration

Setu configuration is primarily done through OpenCode plugin wiring plus runtime task constraints.

## Plugin wiring

Setu should be present in your OpenCode config plugin list.

```json
{
  "plugin": ["setu-opencode@1.3.4"]
}
```

Notes:

- `setu init` writes the canonical spec with the running Setu version.
- Legacy entries like `setu-opencode` are normalized by `setu init`.

## Default behavior

- Setu is configured as default agent if user default is not already set.
- Runtime tool enforcement runs when the active agent is `setu`.
- Build/Plan behavior is primarily governed by native OpenCode mode controls.

## Task constraints

Use `setu_task` constraints to enforce local policy for a task:

- `READ_ONLY`: block write/edit tools
- `NO_PUSH`: block git push
- `NO_DELETE`: block `rm` and destructive git commands
- `SANDBOX`: block operations outside project directory

Example:

```text
setu_task({
  action: "create",
  task: "Refactor logging middleware",
  constraints: ["NO_PUSH", "NO_DELETE", "SANDBOX"]
})
```

## Persistence and artifacts

Setu stores session/task artifacts under `.setu/`:

- `active.json`: active task and constraints
- `context.json`: confirmed context
- `RESEARCH.md`: scout output
- `PLAN.md`: architect output
- `HISTORY.md`: archived artifacts
- `verification.log`: check history
- `results/`: step-level result records

For full lifecycle details, see [Artifacts and State](./reference/artifacts.md).

## Task lifecycle semantics

- `setu_task(action="create")`: new objective; replaces prior task boundary
- `setu_task(action="reframe")`: same objective; updates intent/constraints without resetting artifacts
- `setu_task(action="update_status")`: progress tracking only

## Mode behavior summary

- **Setu mode**: full enforcement
- **Build mode**: no Setu tool enforcement; OpenCode controls apply
- **Plan mode**: no Setu tool enforcement; OpenCode controls apply

See [Runtime Lifecycle](./reference/runtime-lifecycle.md) for details.
