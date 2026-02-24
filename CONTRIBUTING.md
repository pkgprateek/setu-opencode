# Contributing to setu-opencode

Thanks for helping improve Setu.

## Runtime Requirements

- Bun >= 1.0.0 (1.3.x recommended)
- Node.js >= 18.0.0 (24+ recommended)
- OpenCode for local smoke testing

Quick check:

```bash
bun --version
node --version
```

## Local Setup

```bash
git clone https://github.com/pkgprateek/setu-opencode.git
cd setu-opencode
bun install
bun run build
```

## Core Commands

```bash
bun test
bun run typecheck
bun run lint
bun run build
```

## Local Plugin Testing (Use Local Build, Not npm)

To test your branch, point OpenCode to local dist output:

```json
{
  "plugin": ["file:///absolute/path/to/setu-opencode/dist/index.js"]
}
```

Important:

- avoid package-name plugin entries like `"setu-opencode"` while local testing
- avoid loading Setu from both global and project config at the same time
- restart OpenCode after changing plugin config

## Contribution Workflow

1. Create a branch from `main`.
2. Keep changes small and atomic.
3. Add or update tests for behavior changes.
4. Run lint, typecheck, tests, and build locally.
5. Open a PR with a clear problem statement and verification notes.

## Pull Request Checklist

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] `bun run build` passes
- [ ] behavior changes include tests
- [ ] docs updated for API/workflow/install changes
- [ ] no dead code or stale references introduced

## Engineering Standards

- Architecture first, then implementation.
- Fail closed for security-sensitive behavior.
- Prefer explicit error handling to silent failure.
- Avoid `any` unless justified.
- Keep naming clear and intent-driven.

## Docs Parity Rule

Update docs in the same PR when you change:

- tool signatures in `src/tools/*.ts`
- install/bootstrap behavior (`src/install/*`, `src/cli.ts`, `src/postinstall.ts`)
- workflow semantics (gears, hydration, verification)

Common docs to update:

- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `ROADMAP.md`

## Commit Style

Use conventional commits:

```text
type(scope): short summary
```

Examples:

- `feat(bootstrap): add explicit global uninstall flow`
- `fix(hydration): sync persisted confirmation fallback`
- `docs(readme): simplify install and first-run guidance`

## Need Help

- Open an issue: `https://github.com/pkgprateek/setu-opencode/issues`
- For sensitive security reports, use private advisory flow in `SECURITY.md`
