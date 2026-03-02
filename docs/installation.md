---
title: Installation
description: Install and bootstrap setu-opencode globally with deterministic plugin wiring.
---

# Installation

`setu-opencode` is published on npm and supports npm, pnpm, and bun.

## Recommended: Global install

### npm

```bash
npm install -g setu-opencode && setu init
```

### pnpm

```bash
pnpm add -g setu-opencode && setu init
```

### bun

```bash
bun add -g setu-opencode && setu init
```

`setu init` normalizes plugin wiring and creates/updates the Setu agent profile.

## Fallback

If `setu` is not on your PATH:

```bash
npx setu-opencode init
```

## What `setu init` changes

- Updates global OpenCode config (`$XDG_CONFIG_HOME/opencode/opencode.json` or `~/.config/opencode/opencode.json` on macOS/Linux; `%APPDATA%\\opencode\\opencode.json` on Windows)
- Ensures plugin entry uses canonical deterministic spec: `setu-opencode@<version>`
- Creates/updates global Setu agent file under OpenCode config
- Cleans legacy managed Setu agent files that can shadow updates

## Postinstall behavior

- Global installs attempt bootstrap automatically.
- Non-global installs do not mutate global OpenCode configuration.
- `setu init` is the authoritative, explicit bootstrap step.

## Manual plugin wiring (last resort)

If you must edit OpenCode config manually:

```json
{
  "plugin": ["setu-opencode"]
}
```

Then run `setu init` once to normalize to canonical spec.

## Uninstall

```bash
setu uninstall && npm uninstall -g setu-opencode
```

Also supported:

```bash
setu uninstall && pnpm remove -g setu-opencode
setu uninstall && bun remove -g setu-opencode
```

## Validation

After install:

1. Restart OpenCode.
2. Confirm Setu appears in agent cycle.
3. Run a short prompt and verify Setu enforcement messages appear.
