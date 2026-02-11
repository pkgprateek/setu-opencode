# Contributing to setu-opencode

## Requirements

- **Bun** (latest) — Runtime and package manager
- **TypeScript 5.x** — Strict mode required
- **OpenCode** — For end-to-end testing

## Setup

```bash
git clone https://github.com/pkgprateek/setu-opencode.git
cd setu-opencode
bun install
bun run build
```

## Development

### Local Testing

1. Build: `bun run build`
2. Configure OpenCode (`~/.config/opencode/opencode.json`):
   ```json
   {
     "plugin": ["file:///path/to/setu-opencode/dist/index.js"]
   }
   ```
3. Restart OpenCode

### Code Standards

See [AGENTS.md](AGENTS.md) for:
- TypeScript strict requirements
- Naming conventions
- Import organization
- Security guidelines

Key points:
- Explicit return types on all exports
- No `any` without justification
- Fail-closed security (block by default)
- Pure functions when possible

## Pull Requests

1. Create feature branch: `git checkout -b feature/description`
2. Make changes following AGENTS.md standards
3. Test with OpenCode locally
4. Commit using conventional format: `type(scope): description`
5. Push and open PR

### PR Requirements

- [ ] Builds without errors (`bun run build`)
- [ ] Type-checks clean (`bun run typecheck`)
- [ ] Tested in OpenCode
- [ ] No modifications to `package.json`, `tsconfig.json`, `.gitignore` (unless discussed)
- [ ] Follows security patterns (path validation, input sanitization, audit logging)

## Architecture

Key directories:
- `src/hooks/` — OpenCode lifecycle interception
- `src/enforcement/` — Gear state machine, Phase 0 context gate, discipline guards
- `src/security/` — Path validation, secrets detection, audit logging
- `src/tools/` — Agent-facing tools
- `skills/` — On-demand skill definitions

## Questions

Open an issue on GitHub.
