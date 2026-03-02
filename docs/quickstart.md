---
title: Quickstart
description: Run a complete Setu session from objective to verified completion.
---

# Quickstart

This walkthrough shows one complete Setu session from objective to verified completion.

## Objective

Use a scoped objective with existing pattern alignment.

Example objective:

```text
Add a new healthcheck endpoint and tests, following existing route patterns.
```

## What to expect

### 1) Scout

Setu explores relevant files and captures findings.

Output:

- Reads relevant files
- Searches for patterns
- Produces `RESEARCH.md` via `setu_research`

### 2) Architect

Setu turns findings into an actionable plan.

Output:

- Produces `PLAN.md` via `setu_plan`
- Breaks work into atomic steps
- Includes verification intent per step

### 3) Builder

Setu executes the plan.

Output:

- Implements in small units
- Uses constraints if task requires (for example `NO_PUSH`)
- Avoids unsafe/destructive operations

### 4) Verify

Run verification before marking the task complete:

```text
setu_verify({})
```

If auto-execution is unavailable in your runtime, Setu returns the runnable verification commands instead.

Typical result:

```text
Verification Results
- build: PASS
- test: PASS
- lint: PASS
```

## Useful checks

```text
setu_task({ action: "get" })
setu_doctor({ verbose: true })
```

## Next steps

- If blocked by guardrails, read [Guardrails](./concepts/guardrails.md)
- If verification fails, use [Troubleshooting](./troubleshooting.md)
- For higher-risk changes, use [Strict Safety Workflow](./recipes/strict-mode.md)
