# Contributing to setu-opencode

Thanks for your interest in contributing to setu-opencode!

## Quick Start

```bash
# Clone the repository
git clone https://github.com/pkgprateek/setu-opencode.git
cd setu-opencode

# Install dependencies
bun install

# Build
bun run build
```

## Development Setup

### Prerequisites

- **Bun** (latest version) — Package manager and runtime
- **TypeScript 5.x** — Type checking
- **OpenCode** — For testing the plugin

### Testing Locally

After making changes, test your local build:

1. Build the project:
   ```bash
   bun run build
   ```

2. Update your OpenCode config (`~/.config/opencode/opencode.json`):
   ```json
   {
     "plugin": [
       "file:///path/to/setu-opencode/dist/index.js"
     ]
   }
   ```

3. Restart OpenCode to load the changes.

## Project Structure

```
setu-opencode/
├── src/
│   ├── index.ts           # Plugin entry point
│   ├── prompts/           # Persona and style definitions
│   ├── hooks/             # OpenCode lifecycle hooks
│   └── tools/             # Custom tools (setu_verify, setu_context, LSP)
├── skills/                # Bundled skills
├── package.json
└── tsconfig.json
```

## Making Changes

### Code Style

- Use TypeScript for all source files
- Prefer Bun over npm/yarn
- Keep functions small and focused
- Add types to function signatures

### Adding a New Skill

1. Create a directory in `skills/`
2. Add `SKILL.md` with frontmatter and content
3. Document the skill in README.md

### Adding a New Hook

1. Create a file in `src/hooks/`
2. Export the hook function
3. Register it in `src/index.ts`

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test locally with OpenCode
5. Commit with clear messages
6. Push and create a Pull Request

### PR Checklist

- [ ] Code builds without errors
- [ ] Tested with OpenCode locally
- [ ] Updated documentation if needed
- [ ] No version changes in `package.json`

## Areas Needing Help

- Testing on diverse projects
- Additional skills
- Documentation improvements
- Performance optimization
- Bug reports and fixes

## Questions?

Open an issue on GitHub for questions or discussions.

---

Thank you for contributing to Setu!
