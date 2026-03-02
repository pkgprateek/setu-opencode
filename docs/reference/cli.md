---
title: CLI Reference
description: Command reference for the setu and setu-opencode CLI entry points.
---

# CLI Reference

Setu exposes these equivalent entry points:

- `setu`
- `setu-opencode`

## Commands

### `init`

Configure Setu globally for OpenCode:

```bash
setu init
```

Behavior:

- Normalizes plugin entry to canonical `setu-opencode@<running-version>`
- Creates/updates managed Setu agent profile
- Cleans legacy managed Setu agent files that can shadow updates

### `uninstall`

Remove Setu global wiring:

```bash
setu uninstall
```

Behavior:

- Removes Setu plugin specs from OpenCode config
- Removes managed Setu agent files
- Preserves unrelated plugins and unmanaged custom agent files

## Usage

```bash
setu init
setu uninstall
setu-opencode init
setu-opencode uninstall
```

## Help and invalid commands

- `setu --help` prints usage
- Unknown commands print usage and return non-zero exit code
