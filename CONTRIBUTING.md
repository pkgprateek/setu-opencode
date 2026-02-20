# Contributing to setu-opencode

Thanks for contributing.

## Prerequisites

- Bun (current)
- Node.js 24+
- OpenCode (for manual smoke tests)

## Setup

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

## Local Plugin Testing

Configure OpenCode to load local dist output:

```json
{
  "plugin": ["file:///absolute/path/to/setu-opencode/dist/index.js"]
}
```

Then restart OpenCode.

## Engineering Standards

- Keep changes atomic and reviewable.
- Avoid `any` unless justified in code comments.
- Fail closed for security-sensitive behavior.
- Preserve backward compatibility only when it has clear user value.
- Prefer explicit error handling over silent failure.

## Docs Parity Rule

If you change any of these, update docs in the same PR:

- tool signatures in `src/tools/*.ts`
- install/bootstrap behavior (`src/install/*`, `src/cli.ts`, `src/postinstall.ts`)
- workflow semantics (gears, hydration, verification)

Minimum docs touched when relevant:

- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`

## Pull Request Checklist

- [ ] `bun test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] docs updated for behavior/API changes
- [ ] no dead code or stale references introduced

## Commit Style

Use conventional commits:

```text
type(scope): short summary
```

Examples:

- `feat(bootstrap): add explicit global uninstall flow`
- `refactor(hooks): move lazy .setu init to first Setu message`
- `docs(readme): simplify install and first-run guidance`

## Need Help

Open an issue at:

- https://github.com/pkgprateek/setu-opencode/issues
