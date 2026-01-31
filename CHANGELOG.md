# Changelog

All notable changes to setu-opencode will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Terminology: Profile → Style:** Fixed `[Profile: X]` prefix to `[Style: X]` in `persona.ts` to match agent file instructions and user expectations
- **Security: Constraint Bypass Detection:** Added warning logs when bash commands contain potential bypass patterns (`$`, backticks, `$(`, `eval`, `source`, `exec`)
- **Code Quality: Removed Duplicates:** Removed duplicate tool classification constants from `phase-zero.ts` (now imports from `constants.ts`)
- **Code Quality: Removed Legacy Exports:** Removed unused `SETU_PERSONA`, `MODE_DESCRIPTIONS`, and `getInitialPrompt` exports from `persona.ts`
- **Documentation: ROADMAP Accuracy:** Updated ROADMAP.md to accurately reflect implementation status:
  - Marked Persona Enhancement as complete
  - Marked System Directive Prefix as complete  
  - Marked Verification Logging as complete
  - Fixed context.md discrepancy (deprecated in favor of AGENTS.md)
  - Updated file structure documentation

### Added
- **Parallel Execution Enforcement:** System prompt now includes explicit efficiency rules
  - Mandates parallel tool calls for independent read-only operations
  - Explicitly lists allowed tools: read, glob, grep, webfetch, todoread
  - Explicitly lists blocked tools: write, edit, bash
  - References Priority Order (Safe > Efficient) to prevent safety bypass
  - Tool list derived from `READ_ONLY_TOOLS` constant (single source of truth)

- **Parallel Execution Audit Trail:** Logs parallel tool execution batches
  - Tracks read-only tools executed within 100ms window
  - Logs batch stats when 2+ tools execute in parallel
  - Session-scoped to prevent cross-session state leakage
  - Debug output: `Parallel execution: 3 tools in batch [read, read, glob]`

- **Type-Safe Tool Classification:**
  - Added `ReadOnlyTool` type derived from `READ_ONLY_TOOLS` constant
  - Added `isReadOnlyTool()` type guard for safe tool classification
  - Exported from `enforcement` module for reuse

- **Active Task Persistence:** Track current task, mode, and constraints in `.setu/active.json`
  - Survives session restarts and OpenCode restarts
  - Atomic write pattern prevents corruption
  - Predefined constraint types: `READ_ONLY`, `NO_PUSH`, `NO_DELETE`, `SANDBOX`
  
- **Compaction Recovery Protocol:** Hook into `experimental.session.compacting` to inject active task into compaction summary
  - Prevents "going rogue" after context compression
  - Injects task description, mode, and constraints
  - Ensures agent remembers what it was doing
  
- **Constraint Enforcement:** Before side-effect tools, check active task constraints
  - `READ_ONLY`: Blocks write/edit tools
  - `NO_PUSH`: Blocks git push commands
  - `NO_DELETE`: Blocks rm, git reset --hard
  - `SANDBOX`: Blocks operations outside project directory

- **Token Status Tracking:** Read context usage from OpenCode's session history
  - Calculate percentage of context window used
  - Thresholds: 70% warning, 85% critical, 95% emergency
  - Foundation for proactive context hygiene (v1.1)

- **Silent Exploration:** Setu now automatically reads project rules (AGENTS.md, CLAUDE.md) and context files (.setu/active.json, .setu/context.json) on session start
- Project rules are injected into system prompt so Setu starts informed rather than asking questions that documentation already answers
- Active task resume: If a task was in progress when session ended, Setu automatically resumes it instead of starting fresh
- File size limits: Large files are truncated to 50KB (~12,500 tokens) to prevent token bloat
- New modules: `src/context/active.ts`, `src/context/token.ts`, `src/hooks/compaction.ts`

### Changed
- Event hook now performs Silent Exploration on `session.created` event
- System transform hook injects project rules before context (rules are foundational)
- Project rules injection happens only when in Setu agent mode (silent in Build/Plan)
- Tool execute before hook now enforces active task constraints

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
