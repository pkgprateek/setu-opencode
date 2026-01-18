# setu-opencode Roadmap

> OpenCode plugin implementation of [Setu](https://github.com/pkgprateek/setu) — the master craftsman persona.

## Current State (v0.1 - Alpha)

### Plugin Architecture
- [x] Package structure (src/, skills/)
- [x] TypeScript configuration
- [x] Basic plugin entry point

### Hooks (Implemented)
- [x] `system-transform` — Inject lean persona (~500 tokens) via `experimental.chat.system.transform`
- [x] `chat-message` — Mode detection from keywords via `chat.message`
- [x] `tool-execute` — Verification tracking via `tool.execute.after`
- [x] `event` — Session lifecycle handling
- [ ] Enforcement before completion — Waiting for `session.idle` hook in OpenCode API

### Custom Tools
- [x] `setu_mode` — Switch operating modes
- [x] `setu_verify` — Run verification protocol
- [ ] `lsp_diagnostics` — Get errors/warnings before build (⚠️ API investigation needed)
- [ ] `lsp_rename` — Safe symbol renaming (⚠️ API investigation needed)

### Skills (Bundled)
- [x] `setu-bootstrap` — Project initialization protocol
- [x] `setu-verification` — Verification steps and mode-specific behavior
- [x] `setu-rules-creation` — AGENTS.md generation guidelines
- [x] `code-quality` — Naming, error handling, testing patterns
- [x] `refine-code` — Transform code to match standards
- [x] `commit-helper` — Conventional commit messages
- [x] `pr-review` — Security, performance, quality review

---

## v1.0 (Target: MVP)

### Core Functionality
- [ ] Build and test plugin end-to-end
- [ ] Publish to npm as `setu-opencode`
- [ ] Verify installation process works
- [ ] Test all 4 operating modes

### Mode Implementation
- [ ] **Ultrathink** (default): Full protocol — plan → implement → verify
- [ ] **Quick**: Skip ceremony, execute directly, minimal verification
- [ ] **Expert**: Trust user judgment, propose but don't block
- [ ] **Collab**: Discuss options before implementing

### Mode Behavior
- [ ] Persistent mode switching: `mode: quick` persists until changed
- [ ] Temporary mode: "quick fix this" applies to single task only
- [ ] Mode indicator: Every response starts with `[Mode: X (Default)]`

### Enforcement Mechanisms
- [ ] Todo continuation — Don't stop with incomplete tasks
- [ ] Verification enforcement — Run checks before "done" (Ultrathink mode)
- [ ] Attempt limiter — 2 tries then ask for guidance

### Documentation
- [ ] CONTRIBUTING.md
- [ ] Usage examples
- [ ] Configuration options

---

## v1.1 (Extended Features)

### LSP Tools Investigation
> **Note:** The `ctx.lsp` API is not documented in OpenCode's plugin docs.
> These tools are implemented but need validation. Priority for v1.1.

- [ ] Investigate if `ctx.lsp` exists in plugin context
- [ ] Test `lsp_diagnostics` tool
- [ ] Test `lsp_rename` tool
- [ ] Document LSP integration if working
- [ ] Remove or mock if not available

### Extended LSP Tools
- [ ] `lsp_references` — Find all symbol references
- [ ] `lsp_definition` — Go to definition
- [ ] `lsp_hover` — Get type information
- [ ] AST-grep integration for pattern matching

### MCP Integrations
- [ ] Documentation lookup (Context7-style)
- [ ] GitHub code search (grep.app-style)
- [ ] Web search (evaluate options)

### Background Task Support
- [ ] Parallel agent execution
- [ ] Task delegation patterns
- [ ] Progress tracking

---

## v2.0 (Advanced)

### Multi-Agent Delegation
- [ ] Setu delegates internally to specialized models
- [ ] Fallback chain if preferred model unavailable
- [ ] Transparent option: Show delegation in UI

### RLM Integration
- [ ] Context decomposition
- [ ] Recursive sub-queries
- [ ] Infinite context handling

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Key areas needing help:
- Testing on diverse projects
- Additional skills
- Documentation improvements
- Performance optimization

---

## License

Apache 2.0 — See [LICENSE](./LICENSE)
