---
title: Getting Started
description: Install Setu, initialize OpenCode, and run your first disciplined task.
---

# Getting Started

This page gets you to a working Setu session fast.

## Prerequisites

- OpenCode installed and working
- Node.js 18+ (24+ recommended)
- Bun 1.0+ (1.3.x recommended)

## 1) Install and bootstrap

```bash
npm install -g setu-opencode && setu init
```

For full install variants and uninstall steps, see [Installation](./installation.md).

## 2) Start OpenCode in your project directory

```bash
cd /path/to/your/project
opencode
```

Setu should appear in the agent cycle as the default discipline mode.

## 3) Give Setu a concrete objective

Example:

```text
Add request logging for all API routes without changing response formats.
```

Expected flow:

1. Scout (research)
2. Architect (plan)
3. Builder (implementation)

## 4) Verify before completion

When implementation is done:

```text
setu_verify({})
```

`setu_verify` runs project-appropriate build, test, and lint checks when execution is available; otherwise it prints a runnable verification protocol.

## Next

- [Quickstart](./quickstart.md) for a full end-to-end session walkthrough
- [Configuration](./configuration.md) for constraints and persistence model
- [Tools Reference](./reference/tools.md) for tool signatures and semantics
