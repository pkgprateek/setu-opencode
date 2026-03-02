---
title: Docs Publishing Pipeline
description: Auto-publish setu-opencode docs to getsetu.dev/docs via Cloudflare Pages rebuild hooks.
---

# Docs Publishing Pipeline

This recipe implements a no-manual-step docs publishing pipeline:

`setu-opencode/docs` -> merge to `main` -> GitHub Action triggers Cloudflare deploy hook -> `getsetu.dev` rebuild pulls docs -> `getsetu.dev/docs` updates.

## Source of truth

- Source docs: `setu-opencode/docs`
- Published docs: `getsetu.dev/docs`

Do not hand-edit mirrored docs in `getsetu.dev` once pipeline is active.

## Deployment contract

- A docs change merged to `main` must trigger a rebuild automatically.
- A release publish can also trigger a rebuild (optional but recommended).
- Production should reflect merged docs within minutes.

## 1) Add deploy hook secret in setu-opencode

In GitHub repo settings for `setu-opencode`, create:

- `CF_PAGES_DEPLOY_HOOK`

Value: Cloudflare Pages deploy hook URL for `getsetu.dev`.

Security guidance:

- Store the full hook URL only in GitHub secrets.
- Rotate the hook if exposed in logs or screenshots.

## 2) Add GitHub Action in setu-opencode

Create `.github/workflows/docs-sync.yml` in your implementation branch (outside this docs-only task):

```yaml
name: Trigger getsetu docs rebuild

on:
  push:
    branches: [main]
    paths:
      - "docs/**"
  release:
    types: [published]

jobs:
  trigger-cloudflare:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cloudflare Pages deploy hook
        run: |
          curl -fsS -X POST "$CF_PAGES_DEPLOY_HOOK"
        env:
          CF_PAGES_DEPLOY_HOOK: ${{ secrets.CF_PAGES_DEPLOY_HOOK }}
```

If you want every merge to `main` to trigger rebuild, remove the `paths` filter.

Optional hardening:

- Add `workflow_dispatch` for manual emergency retrigger.
- Keep job minimal: one outbound hook call and fail-fast behavior.

## 3) Configure getsetu.dev build to pull docs

In `getsetu.dev` build process, pull docs from `setu-opencode` and copy into website docs content path before site build.

Implementation notes for `getsetu.dev` side:

- Pull from the expected ref (`main` or release ref strategy).
- Replace target docs directory atomically during build.
- Ensure stale docs are not reused from prior build cache.

## 4) Smoke test

1. Change one line in `setu-opencode/docs`.
2. Merge to `main`.
3. Confirm GitHub Action succeeded.
4. Confirm Cloudflare build started.
5. Confirm content appears on `getsetu.dev/docs` within minutes.

Recommended acceptance criteria:

- Action succeeded in `setu-opencode`
- Cloudflare build log includes docs ingest step
- Updated content is visible on production URL

## Failure checks

- Action did not run: event filters or paths mismatch.
- Action failed: missing or invalid deploy hook secret.
- Build ran but docs stale: pull/copy step failed or cache stale.

## Rollback playbook

If a bad docs merge lands:

1. Revert the docs commit in `setu-opencode`.
2. Merge revert to `main`.
3. Confirm pipeline triggers rebuild and restores expected docs.

See [Troubleshooting](../troubleshooting.md) for a full triage matrix.
