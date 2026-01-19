# Project: setu-opencode

## Overview

An OpenCode plugin that enforces pre-emptive discipline for AI coding. Setu blocks side-effect tools until context is confirmed, verifies output before claiming "done," and stops infinite retry loops.

## Stack

- **Language**: TypeScript 5.x with strict mode
- **Runtime**: Node.js (OpenCode plugin)
- **Build**: Bun, TypeScript compiler
- **Testing**: Manual testing via OpenCode (automated tests planned)

## Architecture

### Plugin Structure

```
src/
├── index.ts          # Plugin entry point, hook registration
├── hooks/            # OpenCode hook implementations
│   ├── system-transform.ts   # Injects Setu persona
│   ├── chat-message.ts       # Mode detection
│   └── tool-execute.ts       # Verification tracking
├── tools/            # Custom tools exposed to agent
│   ├── setu-mode.ts          # Mode switching
│   └── setu-verify.ts        # Verification trigger
└── state/            # Session state management
    └── session.ts            # Mode, attempt tracking

skills/               # Bundled skills (loaded on-demand)
├── setu-bootstrap/
├── setu-verification/
├── code-quality/
└── ...
```

### Key Patterns

1. **Hook-based architecture**: All enforcement via OpenCode hooks
2. **State isolation**: Each session has independent mode/attempt state
3. **Progressive loading**: Skills load on-demand, not upfront
4. **Pre-emptive blocking**: Use `tool.execute.before` to block, not fix after

## Code Style

- Use `camelCase` for variables and functions
- Use `PascalCase` for types and interfaces
- Prefix interfaces with `I` only when necessary for clarity
- Use explicit return types on exported functions
- Prefer `const` over `let`
- Use template literals for string interpolation

### Naming Conventions

| Entity | Convention | Example |
|--------|------------|---------|
| Hook files | `kebab-case.ts` | `system-transform.ts` |
| Tool files | `kebab-case.ts` | `setu-mode.ts` |
| Types | `PascalCase` | `SetuMode`, `SessionState` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_MODE`, `MAX_ATTEMPTS` |

### Import Organization

1. Node.js built-ins
2. External packages
3. Internal modules (absolute paths)
4. Relative imports

## Common Commands

- **Build**: `bun run build`
- **Watch**: `bun run dev`
- **Lint**: `bun run lint`
- **Type check**: `bun run typecheck`
- **Test locally**: Load plugin in OpenCode via `opencode.json`

## Important Context

### The Core Insight

Setu is **pre-emptive**, not reactive. This means:
- Block side-effect tools BEFORE they execute (Phase 0)
- Allow read-only tools so agent can form smart questions
- Verify BEFORE claiming "done" (not after user discovers bugs)

### Phase 0 Rule

**Allow (read-only):** `read`, `glob`, `grep`
**Allow (bash read-only):** `ls`, `cat`, `head`, `tail`, `grep`, `find`, `pwd`, `echo`, `which`
**Block (side-effects):** `write`, `edit`, `bash` (other commands), `git` (write operations)

This lets the agent "look but don't touch" until context is confirmed.

### Modes

| Mode | Verification Level | Use Case |
|------|-------------------|----------|
| `default` | Full (build/test/lint) | Features, refactoring |
| `quick` | Minimal | Typos, comments |
| `expert` | User reviews | Trusted changes |
| `collab` | Discuss first | Architecture |

### State Management

- Mode persists for session until changed
- Attempt counter resets on success or user guidance
- After 2 failed attempts → ask for guidance, don't retry

## Git Workflow

- **Always ask before committing**: Do not commit without explicit user approval
- **Always ask before pushing**: Do not push without explicit user approval
- **Commit style**: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)

## Testing Strategy

1. Build plugin: `bun run build`
2. Add to local `opencode.json`: `{ "plugin": ["./path/to/dist"] }`
3. Start OpenCode session
4. Test each mode and enforcement behavior
5. Verify token efficiency (check persona size)

## Files to Never Modify Without Asking

- `package.json` (dependencies, versions)
- `tsconfig.json` (compiler settings)
- `.gitignore` (tracked files)

## Files Safe to Modify

- `src/**/*.ts` (implementation)
- `skills/**/*.md` (skill definitions)
- `README.md`, `ROADMAP.md` (documentation)
- `docs/**/*.md` (documentation)
