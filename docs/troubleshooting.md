---
title: Troubleshooting
description: Diagnose and fix common Setu install, workflow, and docs-publishing issues.
---

# Troubleshooting

Use this page for quick diagnosis. For setup details, go back to [Installation](./installation.md) or [Configuration](./configuration.md).

## Setu is missing from agent cycle

Checklist:

1. Re-run `setu init`.
2. Restart OpenCode.
3. Confirm plugin entry exists in OpenCode config.

## `setu init` warns about config parse failure

Cause: invalid JSON in OpenCode config.

Fix:

- Correct JSON syntax in `opencode.json`.
- Re-run `setu init`.

## Setu blocks edit/write unexpectedly

Likely causes:

- Hydration not confirmed
- Overwrite guard waiting for read of target file
- Active task constraints
- Current gear does not allow action

Fix:

1. Confirm context with `setu_context`.
2. Read target file before mutating it.
3. Check active task via `setu_task({ action: "get" })`.

## Commit or push blocked

Cause: verification incomplete in Setu mode.

Fix:

- Run `setu_verify({})` and resolve failures.

## Docs merge did not update getsetu.dev/docs

Triage in order:

1. Check GitHub Action run in `setu-opencode`.
2. Check deploy hook secret is present and valid.
3. Check Cloudflare build log started after action.
4. Check docs pull/copy step in `getsetu.dev` build.
5. Validate output using hard refresh/incognito.

## Build command blocked due to active dev server

Cause: environment conflict guard detected a likely running dev server.

Fix:

1. Stop the active dev server.
2. Re-run verification/build command.

## Auto-update did not apply

Checklist:

1. Restart OpenCode after update notification.
2. Re-run `setu init` to normalize wiring.
3. Confirm installed Setu version.

## Quick symptom map

| Symptom | Most likely cause | First action |
|---|---|---|
| Edit/write blocked | Hydration/overwrite/constraint/gear guard active | Check `setu_task({ action: "get" })` and read target file |
| Commit blocked | Verification incomplete | Run `setu_verify({})` |
| `setu init` warning | Invalid OpenCode config JSON or permission issue | Fix config, rerun `setu init` |
| Docs stale on website | Action/hook/build ingest mismatch | Follow docs pipeline triage above |

## Wrong files modified in a large repo

Use stricter boundary for next run:

```text
setu_task({
  action: "create",
  task: "<specific objective and path>",
  constraints: ["SANDBOX", "NO_PUSH", "NO_DELETE"]
})
```

## Need deeper diagnostics

Enable debug logging for a session:

```bash
SETU_DEBUG=true opencode
```

Then inspect `.setu/debug.log` for hook and enforcement traces.
