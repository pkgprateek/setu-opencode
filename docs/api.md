---
title: API Surface
description: Public plugin API surface for setu-opencode.
---

# API Surface

`setu-opencode` is an OpenCode plugin that exposes a tool API and hook-driven runtime behavior.

## Public surfaces

Setu exposes three user-facing surfaces:

1. Tools API (`setu_*` tools used inside OpenCode)
2. CLI API (`setu init`, `setu uninstall`)
3. Runtime integration through OpenCode plugin hooks

## Tools API

The canonical public tools are documented in [Tools Reference](./reference/tools.md).

## CLI API

CLI entry points and command behavior are documented in [CLI Reference](./reference/cli.md).

## Runtime lifecycle API

Setu integrates through OpenCode plugin hooks. See [Runtime Lifecycle](./reference/runtime-lifecycle.md).

## Operational references

- [Security Model](./reference/security-model.md)
- [Artifacts and State](./reference/artifacts.md)
- [Auto Update](./reference/auto-update.md)

## Stability expectations

- Tool names listed in docs are considered public surface.
- Argument semantics follow implementation in `src/tools/*.ts`.
- Installation behavior follows `setu init` and `setu uninstall` contracts.
