---
name: setu-rules-creation
description: Create AGENTS.md rules file for a project. Analyzes codebase and generates project-specific rules. Use when initializing a new project, asked to create "AGENTS.md", "rules", or "project guidelines".
---

# Rules File Creation

Create lean, effective AGENTS.md files that help AI understand your project.

## Principles

1. **Be specific** — "Use 2-space indentation" > "Format code properly"
2. **Keep it lean** — Target ~500 tokens, not a novel
3. **Reference, don't duplicate** — Point to files, don't copy their content
4. **Focus on the non-obvious** — Skip things AI already knows

## Template Structure

```markdown
# Project: [name]

## Overview
[1-2 sentences — what this project does and its primary purpose]

## Stack
- **Language**: [e.g., TypeScript 5.x with strict mode]
- **Framework**: [e.g., Next.js 14 with App Router]
- **Build**: [e.g., pnpm, Turborepo]
- **Testing**: [e.g., Vitest, Playwright]

## Architecture
[Key patterns — 2-4 bullet points]
- [e.g., Feature-based directory structure]
- [e.g., Server components by default]
- [e.g., API routes in /api with tRPC]

## Code Style
- [Naming conventions specific to this project]
- [Import organization if non-standard]
- [Component patterns if unique]
- [State management approach]

## Common Commands
- **Dev**: `pnpm dev`
- **Build**: `pnpm build`
- **Test**: `pnpm test`
- **Lint**: `pnpm lint`
- **Type check**: `pnpm typecheck`

## Important Context
[Critical information that affects how to work on this project]
- [e.g., Uses Stripe for payments - see /docs/payments.md]
- [e.g., Multi-tenant architecture - always filter by org_id]
- [e.g., i18n via next-intl - all strings go in /messages]
```

## Analysis Process

Before writing AGENTS.md:

1. **Scan package.json / pyproject.toml / Cargo.toml**
   - Identify framework, dependencies, scripts
   - Note testing framework
   - Check for linting tools

2. **Review directory structure**
   - Identify organizational pattern (feature-based, layer-based, etc.)
   - Note any non-standard directories

3. **Sample existing code**
   - Read 2-3 files to identify naming conventions
   - Check import patterns
   - Look for common abstractions

4. **Check for existing documentation**
   - README.md for project overview
   - CONTRIBUTING.md for conventions
   - Existing CLAUDE.md or other AI instructions

## What NOT to Include

- **Generic best practices** — AI already knows these
- **Full style guides** — Use linters instead
- **Every possible command** — Only the common ones
- **Implementation details** — They change too often
- **Secrets or credentials** — Obviously

## Examples

### Good: Specific and Useful

```markdown
## Code Style
- Components use `ComponentName.tsx` (PascalCase)
- Hooks use `useHookName.ts` with `use` prefix
- API routes follow REST: GET /api/users, POST /api/users
- All database queries go through Prisma client in /lib/db
```

### Bad: Vague and Obvious

```markdown
## Code Style
- Write clean code
- Follow best practices
- Use meaningful names
- Handle errors properly
```

## File Naming Conventions

| Platform | Filename | Notes |
|----------|----------|-------|
| OpenCode | `AGENTS.md` | Primary, recommended |
| Claude Code | `CLAUDE.md` | Fallback, compatible |
| Cursor | `.cursor/rules/` | Different format |

OpenCode reads both `AGENTS.md` and `CLAUDE.md`. Prefer `AGENTS.md` for new projects.

## Updating Rules

Rules should evolve with the project:

1. **Add patterns as they emerge** — Don't front-load everything
2. **Remove outdated information** — Stale rules mislead
3. **Keep commands current** — Test that they still work
4. **Review quarterly** — Or when major changes occur
