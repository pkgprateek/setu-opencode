---
title: Auto Update
description: Runtime auto-update behavior, conditions, and operator expectations.
---

# Auto Update

Setu includes a runtime update check for npm-installed environments.

## When update checks run

- On root `session.created` event
- Once per runtime process
- Only when Setu is running from a node_modules/npm-style runtime path

## Update behavior

When a newer version is available, Setu attempts to:

1. Update the cached Setu package
2. Re-run `setu init` to refresh canonical wiring
3. Show a restart notice

## Requirements and caveats

- Designed around Bun runtime execution paths
- Failures are non-fatal and do not block normal usage
- Restart is required to apply updated runtime in current session

## Operational guidance

- Keep global install and plugin config canonical via `setu init`
- If update behavior seems stale, re-run `setu init` and restart OpenCode
