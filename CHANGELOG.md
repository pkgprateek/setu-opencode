# Changelog

All notable changes to setu-opencode will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Complete Security Infrastructure** (`src/security/`)
  - **Audit Logging:** Security events tracked to `.setu/security.log` with severity levels (critical/high/medium/low/info)
  - **Path Validation:** Prevents path traversal attacks and blocks access to sensitive files (.env, SSH keys, credentials)
  - **Secrets Detection:** Scans file content for API keys, tokens, and credentials before write/edit
  - **Prompt Sanitization:** Blocks prompt injection attempts in user inputs with configurable max lengths
  - **Redaction:** Automatically redacts secrets from debug logs using pattern matching

- **Task Management Tool (`setu_task`)**
  - Create, update, and clear active tasks in `.setu/active.json`
  - Constraint enforcement: READ_ONLY, NO_PUSH, NO_DELETE, SANDBOX
  - Survives context compaction and session restarts
  - Integrated with verification state reset on task changes

- **Enhanced Verification Tracking**
  - Verification state now logs to `.setu/verification.log`
  - Multi-ecosystem support (npm/yarn/pnpm/bun/cargo/go/uv/pip)
  - Typecheck and lint detection patterns added

### Fixed

- **Security: Log Injection Prevention** (audit-log.ts:70-95)
  - Sanitize newlines (CRLF/CR/LF) in event details before logging
  - Prevents attackers from injecting fake log entries via malicious input
  
- **Security: Path Containment Check** (path-validation.ts:60-66)
  - Replaced broken `startsWith()` logic with robust `path.relative()` check
  - Fixes root path edge cases and Windows case-sensitivity issues
  - Prevents path traversal bypasses on Windows

- **Code Quality: Eliminated Duplicate Path Logic** (path-validation.ts:117-136)
  - Refactored `validateFilePath` to reuse `isPathWithinProject` for consistency
  - Removed unused `sep` import

- **Security: Null Safety for sessionID** (setu-context.ts:99)
  - Use optional chaining (`context?.sessionID`) to prevent runtime errors
  - Handles cases where context object lacks sessionID property

- **Performance: Removed Double Redaction** (debug.ts:88-92)
  - Eliminated redundant `redactSensitive()` call in `writeToLogFile`
  - Args already redacted by `debugLog()` caller - 50% reduction in redaction overhead

- **Security: Debug Logging Secret Leak** (debug.ts:126-128)
  - Redact `String()` fallback for non-serializable objects
  - Prevents secret leakage when objects fail JSON.stringify

- **Security: Cross-Platform Path Validation** (path-validation.ts:65,108 & tool-execute.ts:238-248)
  - Use `path.sep` instead of hardcoded `/` for Windows compatibility
  - Normalize path separators before pattern matching
  - Fixes bypass where `.husky\\` and `.git\\hooks\\` weren't matched on Windows

- **Security: Type Safety in Error Handling**
  - Handle undefined `line` property in SecretMatch error output (tool-execute.ts:308)
  - Add runtime type validation after JSON.parse in feedback metadata (feedback.ts:174-191)
  - Return empty string for falsy inputs in redaction (redaction.ts:49-52)

- **Security: Pattern Matching Improvements**
  - Check both basename and normalized path in `isSensitiveFile` (path-validation.ts:74-81)
  - Implement `requiresContext` flag for AWS secret pattern to reduce false positives (secrets-detection.ts:157-218)
  - Account for suffix length in truncation to prevent DoS (prompt-sanitization.ts:85-93)
  - Reset regex `lastIndex` to prevent stale state bugs (prompt-sanitization.ts:69-76)

- **Security: Feedback Rate Limiting Race Condition** (feedback.ts)
  - Eliminate race condition by loading metadata once per operation
  - Reduce I/O by 50% with single metadata load
  - Atomic write pattern for feedback metadata

### Changed

- **Security Logging:** All security events now centralized through `logSecurityEvent()` API
- **Tool Execute Hook:** Enhanced with secrets detection, path validation, and audit logging
- **Feedback Tool:** Now rate-limited to 10 submissions per session to prevent abuse

- **Git Discipline Enforcement:** Hook-based blocking of git commit/push without verification
  - Detects `git commit` and `git push` commands in bash
  - Blocks with clear message if verification is not complete
  - Shows current verification status (which steps have been run)
  - Enforced in Ultrathink style only (Quick/Expert bypass)

- **Native Git Repo Detection:** Silent detection of git repository state on session start
  - Checks for `.git` directory existence
  - Detects current branch via `git branch --show-current`
  - Identifies protected branches (main, master, production, prod)
  - Zero token cost — runs synchronously at session start

- **Protected Branch Warnings:** System prompt injection for protected branch awareness
  - If on main/master/production/prod, injects warning into context
  - Suggests creating feature branch for non-trivial changes
  - If not a git repo, suggests `git init`

- **Dependency Safety Hook:** Blocks direct edits to package manifests
  - Blocks `write`/`edit` to: package.json, package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb
  - Clear message explaining why and suggesting package manager commands
  - Enforced in Ultrathink style only

- **Enhanced Native Tool Guidance:** Improved efficiency rules in persona
  - Explicit preference for native tools over bash equivalents
  - `list` over `bash ls` — structured output, no shell spawn
  - `read` over `bash cat` — handles large files properly
  - `glob` over `bash find` — faster pattern matching

### Changed

- **Tool Execute Hook:** Now accepts `getVerificationState` accessor for git discipline enforcement
- **Project Rules Interface:** Added `GitState` interface with `initialized`, `branch`, and `isProtectedBranch` fields
- **System Prompt:** Git status now appears in Silent Exploration header

### Fixed
- **Terminology: Profile → Style:** Fixed `[Profile: X]` prefix to `[Style: X]` in `persona.ts` to match agent file instructions and user expectations
- **Security: Constraint Bypass Detection:** Added warning logs when bash commands contain potential bypass patterns (`$`, backticks, `$(`, `eval`, `source`, `exec`)
- **Code Quality: Removed Duplicates:** Removed duplicate tool classification constants from `phase-zero.ts` (now imports from `constants.ts`)
- **Code Quality: Removed Legacy Exports:** Removed unused `SETU_PERSONA`, `MODE_DESCRIPTIONS`, and `getInitialPrompt` exports from `persona.ts`
- **Architecture: Efficiency Rules Location:** Moved "Efficiency Rules" from agent file (soul) to `persona.ts` (behavioral injection) — agent file now contains only identity/philosophy
- **Markdownlint: MD007 Indentation:** Fixed nested list indentation in ROADMAP.md (4-space → 2-space)
- **Phase 0 Allowlist:** Trimmed `READ_ONLY_BASH_COMMANDS` to strict allowlist (removed `glob`, `rg`, `file`, `stat`, `wc`, `tree`, `less`, `more`, `printenv`)
- **Setu-Only Tracking:** `recordToolExecution` now only runs in Setu mode (was running for all modes)
- **Documentation: ROADMAP Accuracy:** Updated ROADMAP.md to accurately reflect implementation status:
  - Marked Persona Enhancement as complete
  - Marked System Directive Prefix as complete  
  - Marked Verification Logging as complete
  - Fixed context.md discrepancy (deprecated in favor of AGENTS.md)
  - Updated file structure documentation

### Changed
- **Agent Version:** Bumped to v2.4.0 (soul-only, behavioral rules in hooks)
- **Efficiency Guidance:** Enhanced `PARALLEL_GUIDANCE` with explicit `glob > ls` preference and full efficiency rules

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
