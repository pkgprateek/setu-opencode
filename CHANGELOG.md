# Changelog

All notable changes to setu-opencode will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-rc.3] - 2025-01-28

### Terminology
- **Renamed Profile to Style:** Operational presets are now called "styles" (ultrathink, quick, expert, collab) to avoid confusion with OpenCode's "modes" (Plan, Build, Setu).
- Supports both `style:` and legacy `mode:` prefixes for backwards compatibility.

### Response Discipline
- **No meta-reasoning:** Agent will no longer recite its instructions aloud or explain what styles mean.
- **Task-focused output:** Shows reasoning about the task, not self-reflection about persona.
- **Style switching without tools:** When user says "style: quick", agent just changes behavior - no tool/skill calls needed.

### Debug Improvements
- **File-based logging:** Debug output now writes to `.setu/debug.log` when enabled.
- **Environment variable:** Enable with `SETU_DEBUG=true opencode`
- **View logs in separate terminal:** `tail -f .setu/debug.log`
- **Note:** Config file support (`setu.json`) coming in v1.1

## [1.0.0-rc.2] - 2025-01-28

### Context Amnesia Fix (Critical)
- **Context now loads on session start:** Previously, context was detected but not loaded. Now `.setu/context.json` is fully loaded and injected into the system prompt.
- **Constraints survive restarts:** Rules like "sandbox only" are now properly remembered across OpenCode restarts.
- **Context content injection:** The `system-transform` hook now injects actual context content (summary, patterns, current task).

### UX Improvements
- **Response format enforcement:** Every response starts with `[Style: Ultrathink]` (or current style).
- **Debug mode toggle:** All internal logging gated behind `SETU_DEBUG=true` environment variable.
- **Natural error messages:** Phase 0 block message changed to: "I need to understand the context first before making changes."

### Efficiency Improvements
- **Glob-first guidance:** Agent instructed to use `glob` for file discovery, not `ls -R`.
- **Parallel read guidance:** Agent instructed to parallelize file reads in a single message.
- **Efficiency Rules section:** Added dedicated section in agent persona.

## [1.0.0-rc.1] - 2025-01-28

### Architecture Overhaul
- **Soul-Only Agent File:** Agent definition contains ONLY identity and philosophy. Behavioral instructions moved to plugin enforcement.
- **Plugin-Driven Enforcement:** Behavior enforced by hooks, not prompt instructions.
- **Dynamic Persona Injection:** Only dynamic state (style, context status) injected.

### Safety Fixes
- **Phase 0 Blocking:** Side-effect tools blocked by code until context confirmed.
- **Removed `setu_mode` Tool:** Style switching is user-controlled only. Agent cannot bypass safety.
- **Graceful Failure:** Silent handling of missing `.setu/` files.

### Performance Improvements
- **Lazy Loading:** Context loaded only when needed.
- **File Cache:** File existence checks cached for 5 seconds.

## [0.1.0-alpha] - 2025-01-24

### Added
- Initial plugin structure with TypeScript
- Phase 0 blocking enforcement
- Context persistence (`.setu/context.md`, `.setu/context.json`)
- Setu as primary agent (Tab-accessible, default on startup)
- 4 operational styles: Ultrathink, Quick, Expert, Collab
- Custom tools: `setu_verify`, `setu_context`, `setu_feedback`
- 7 bundled skills

---

## Roadmap

### v1.1 - Polish & Configuration
- Verbosity toggle (minimal/standard/verbose)
- Parallel subagents with configurable model
- Active task persistence

### v1.2 - Extended Context
- Auto-inject AGENTS.md summary
- Scratchpad style for disposable code

### v1.3 - Disciplined Delegation
- Fine-grained model routing per subagent
- Orchestration layer for intelligent model selection

### v2.0 - Advanced Features
- LSP integration
- Cross-session memory
