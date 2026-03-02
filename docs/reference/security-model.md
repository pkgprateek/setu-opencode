---
title: Security Model
description: Safety gates, hard blocks, confirmation flow, and audit artifacts in Setu.
---

# Security Model

Setu enforces safety at runtime before mutating tools execute.

## Security layers

1. Hydration gate
2. Question/decision block
3. Overwrite guard (read-before-write)
4. Safety classifier (ask vs hard block)
5. Path and sensitive-file validation
6. Secret detection on write/edit payloads
7. Task constraints (`READ_ONLY`, `NO_PUSH`, `NO_DELETE`, `SANDBOX`)

## Hydration gate

Before context confirmation, Setu blocks side-effect tools and allows read-only discovery tools.

## Confirmation flow

For risky but potentially valid actions, Setu requests explicit user confirmation.
For destructive actions, Setu hard-blocks execution.

## Overwrite guard

If a target file already exists, Setu requires reading that file before editing to reduce accidental overwrite risk.

## Path and content protections

- Path validation blocks traversal and sensitive-path writes.
- Secret scanning blocks writes/edits containing high-severity credentials.

## Git safety and verification

In Setu mode, commit/push is blocked until verification is complete.

## Security logs

Security-relevant decisions are recorded under `.setu/security.log`.
