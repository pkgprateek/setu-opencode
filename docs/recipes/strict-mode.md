---
title: Strict Safety Workflow
description: Run Setu with maximum safety and minimal operational risk.
---

# Strict Safety Workflow

Use this recipe when you want conservative execution (production-adjacent changes, high risk areas, or regulated workflows).

## Create a strict task boundary

```text
setu_task({
  action: "create",
  task: "Patch auth token rotation without breaking compatibility",
  constraints: ["NO_PUSH", "NO_DELETE", "SANDBOX"]
})
```

## Suggested flow

1. Run `setu_doctor({ verbose: true })`
2. Complete Scout and Architect artifacts
3. Execute only planned steps
4. Run `setu_verify({})`
5. Manually inspect diffs and runtime behavior

## Extra controls

- Keep commits local until tests and review are complete.
- Keep scope narrow: one objective per task boundary.
- Use `setu_task(action="reframe")` instead of creating drift in the same task.
