# Changelog

## [Unreleased]

### Changed
- **Hydration terminology standardized** — Internal/runtime references now consistently use Hydration Gate naming instead of legacy Phase 0 terms.
- **Decision gate is capability-aware** — Clarification/approval flows now resolve via native `question` tool when available, with `setu_context` fallback to avoid deadlocks.
- **User-facing enforcement guidance simplified** — Block messages now provide concise reason + next action without verbose internal policy text.

### Added
- **Plan contract validation** — `setu_plan` now enforces required sections/fields (goal, non-goals, assumptions, file edits, atomic steps, expected output, rollback, acceptance tests, verify protocol).
- **Artifact lifecycle policy** — Deterministic append vs remake behavior for research/plan artifact updates.
- **Research durability for oversized payloads** — Large research payloads are additionally persisted in `.setu/research_chunks/` to avoid silent loss.
- **New regression tests** — Added coverage for hydration enforcement naming, plan contract validation, research chunking, artifact policy, and gear-path handling.

## [1.2.1] - 2025-02-12

### Fixed
- **Phase 0 enforcement now active** — Side-effect tools (write, edit, bash) are properly gated until context is confirmed via `setu_context`
- **Read-before-write protection extended to edit** — Agent must read existing files before editing them, not just before writing
- **Safety confirmation flow implemented** — Production-impacting commands (npm publish, kubectl apply, etc.) now prompt for user confirmation instead of being hard-blocked
- **Question resolution moved to after hook** — Safety approvals/denials are now properly parsed from question tool responses after the question completes

### Added
- **Comprehensive test coverage** — 10 new unit tests for Phase 0, safety flow, and read-before-write guards (83 → 93 tests)
- **Action fingerprinting** — Safety confirmations are matched to specific actions and consumed after single use
- **Debug observability** — Added logging for enforcement decisions and safety classifications

### Documentation
- **Architecture diagram added** — README now references `assets/architecture.svg`, derived from the internal architecture model
- **Install path clarified** — README now distinguishes current manual `opencode.json` setup from planned `init` command UX
- **Roadmap wording tightened** — sequencing language cleaned up for first public release preparation

## [1.2.0] - 2025-02-10

### Added
- **Discipline guards**: Lightweight question/safety/overwrite blocking that operates independently of gears
  - `setQuestionBlocked()` / `clearQuestionBlocked()`: Force user interaction when research has open questions or plan needs approval
  - `setSafetyBlocked()` / `clearSafetyBlocked()`: Block until user confirms destructive actions
  - Overwrite protection requires prior read before file writes
- **Artifact archiving on new task**: `setu_task create` archives old RESEARCH.md and PLAN.md to `.setu/HISTORY.md`, resetting gear to scout
- **User interaction at gear transitions**: Research with open questions and plan creation trigger question blocking to ensure user alignment before proceeding
- **Gear-based system prompt injection**: System transform now injects per-gear workflow guidance (`[SETU: Gear] scout/architect/builder`) with gear-specific instructions
- **`setu_task` added to core tools list**: Task creation is now a recognized Setu tool in constants
- **`openQuestions` argument for `setu_research`**: Allows marking unresolved questions that require user input
- **Progress tracking and step completion system**
  - `advanceStep`: Automatically advance step counter after verification
  - `recordFailedApproach`: Track failed attempts to prevent repeated mistakes
  - `recordWorkedApproach`: Record successful approaches for reference
  - Results Pattern: Step completion tracked via `.setu/results/step-N.md` files with atomic writes and YAML sanitization
  - Integration with `setu_verify`: Auto-advance step and persist results
  - Integration with `setu_plan`: Clear old results on new plan creation
  - Attempt tracker persistence to prevent "ghost loops"
  - Comprehensive test suite (67 tests, 115 assertions)
  - Increased limits: 100KB result size, 2000 char YAML fields
- **Just-in-time context preparation for subagents** (see `prepareJITContext`)
  - Cleanse Protocol: JIT context preparation with token budgeting (< 2000 tokens)
  - Defense-in-depth: YAML sanitization, prompt truncation, constraint validation
  - Subagent support: JIT context injected for `explore` and `general` subagents
  - `getJITContextSummary`: Debug summary of current context state
- **Gearbox State Machine**: Artifact-driven state transitions (Scout/Architect/Builder)
  - Scout gear: read-only until RESEARCH.md created
  - Architect gear: can write to `.setu/` only until PLAN.md created
  - Builder gear: full access with verification enforcement
- `setu_research` tool for saving research findings to `.setu/RESEARCH.md`
- `setu_plan` tool for creating execution plans in `.setu/PLAN.md`
- `setu_reset` tool for resetting step progress
- `setu_doctor` tool for environment health checks (git, deps, runtime)
- Progress tracking fields in `active.json` schema (`progress.lastCompletedStep`)
- Learning persistence fields (`learnings.worked/failed`) for ghost loop prevention
- `MAX_LEARNINGS` constant (20) for capping approach history
- Configuration system with `setu.json` (project and global config support)
- JSON schema for config validation (`assets/setu.schema.json`)
- Atomic write pattern (temp file + fsync + rename) in context storage
- Control character rejection in config validation and prompt sanitization
- Enhanced attempt tracking with persistent failure counter
- Config validation at each merge step (global and project)
- Pre-commit checklist with branch detection

### Fixed
- **Path validation**: Checks traversal patterns before normalization (defense-in-depth)
- **Atomic writes**: Enhanced error handling with temp file cleanup on failure, using 32-char entropy for collision resistance
- **Error handling**: Standardized error message extraction with `getErrorMessage` helper
- **Size limits**: Increased from 50KB to 100KB for realistic usage
- **Context injection**: Added error handling with `debugLog()` (no empty catch blocks)
- **Subagent detection**: Extended to include `explore` and `general` subagents for context
- **Context size limit**: Reduced from 512KB to 50KB per policy (prevents token bloat)
- **Step validation**: Added `Number.isInteger()` check for progress steps
- **setu-doctor indentation**: Fixed try-catch alignment in lockfile check
- **setu-doctor nullish coalescing**: Use `??` instead of `||` for exit code fallback
- **setu-doctor git-head**: Added healthy state reporting for consistent coverage
- **setu-doctor TypeScript check**: Wrapped in try-catch for parity with Node.js check
- **Key collision logging**: Added debug warning when sanitization causes key collision
- Serialization fallback tracking prevents re-stringifying broken objects
- Pretty-print now parses from safe JSON string, not raw context object
- Input sanitization rejects all control characters (0x00-0x1F, 0x7F)
- Compaction hook validates constraints array before use
- Environment doctor handles non-zero exit codes from git/node commands
- Type safety: `wrapHook` return type includes undefined for error cases
- Empty catch blocks now discriminate ENOENT from other errors
- SetuError prototype chain fixed for post-transpilation instanceof checks
- Command detection regex escapes properly (`\\s`, `\\w`)

### Changed
- **Unified workflow enforcement to gear-based state machine**: Gears (Scout/Architect/Builder) are now the single workflow authority. Removed competing in-memory state machine that duplicated gear logic and caused conflicts on session restart
- **Rewritten tool-execute enforcement hook**: Removed ~318 lines of legacy complexity (enforcement levels, heuristic gates, fallback blocks). Kept: gear enforcement, discipline guards, git discipline, dependency safety, path security, secrets detection, constraints, context injection
- **`todowrite` reclassified as read-only**: Moved from side-effect tools to read-only tools since it manages OpenCode internal state, not filesystem
- **Renamed state API**: `getSetuState` → `getDisciplineState`, `setSetuState` → `setDisciplineState`, `clearSetuState` → `clearDisciplineState` to reflect actual purpose
- **System transform uses gear-based guidance**: Replaced in-memory state injections with gear-aware workflow instructions from `determineGear()`
- **Persona optimization**: Reduced token overhead from ~1,100 to ~400 tokens (64% reduction)
- Agent version aligned to package version (1.2.0)
- Removed legacy preset system; consolidated to a single default behavior
- Runtime guidance changed to descriptive-only (removed behavioral directives)
- Removed parallel execution guidance from persona (enforcement via hooks instead)

### Removed
- **In-memory workflow state machine**: `SetuPhase` type and all transition functions (`transitionSetuPhase`, `setSetuState`, `getSetuState`). Gears handle workflow via artifact existence
- **`EnforcementLevel` type and related functions**: `getSetuEnforcementLevel()`, `getEnforcementLevel()`, `skipGearEnforcement`, `policyExemptBash` — replaced by direct gear checks
- **Legacy attempt tracker factory**: `createAttemptTracker()` and `AttemptTracker`/`AttemptState` type exports
- **`logExecutionPhase()`**: 33-line function only used by the removed state machine
- **Deprecated `isReadOnlyToolName()`**: Replaced by direct constant lookups
- **Dead code files**: `src/templates/plan.ts`, `src/templates/research.ts` (never imported), `src/config/setu-config.ts`, `src/config/index.ts` (full config system, never imported)
- **Net reduction**: -627 lines of code

### Security
- YAML injection prevention with control char removal
- Status runtime validation with type guards
- Context size enforcement at 50KB (down from 512KB)
- Fail-closed unknown tool handling with whitelist
- Log rotation at 1MB with 3-file retention
- Path traversal prevention in gear checks and config loading
- Double-encoding attack prevention in path validation

---

## [1.0.0] - 2025-02-03

### Fixed
- Fixed CodeRabbit configuration (`knowledge_base.learnings` schema error)
- Fixed comment numbering in styles.ts ("3. Aliases" → "2. Aliases")

### Security
- Added audit logging with severity levels (critical/high/medium/low/info)
- Implemented path validation preventing directory traversal attacks
- Added secrets detection for API keys, tokens, and credentials
- Added prompt sanitization with configurable length limits
- Added automatic redaction of sensitive data from debug logs
- Fixed log injection prevention (sanitize CRLF in event details)
- Fixed path containment check using `path.relative()` instead of broken `startsWith()`
- Fixed cross-platform path validation using `path.sep` for Windows compatibility
- Fixed null safety for sessionID using optional chaining
- Fixed secret leakage in debug logging when JSON.stringify fails
- Improved pattern matching for sensitive files (basename + normalized path)
- Added feedback rate limiting (10 submissions per session)

### Added
- Task management tool (`setu_task`) with constraint enforcement (READ_ONLY, NO_PUSH, NO_DELETE, SANDBOX)
- Active task persistence in `.setu/active.json` surviving session restarts
- Compaction recovery protocol injecting active task into session compaction
- Verification tracking with multi-ecosystem support (npm/yarn/pnpm/bun/cargo/go/uv/pip)
- Git discipline enforcement blocking commit/push without verification
- Native git repo detection on session start
- Protected branch warnings (main/master/production/prod)
- Dependency safety hook blocking edits to package manifests
- Parallel execution audit trail tracking batch execution
- Type-safe tool classification with `ReadOnlyTool` type guard
- Token status tracking with thresholds (70% warning, 85% critical, 95% emergency)
- Silent Exploration: automatic reading of AGENTS.md and context files on session start
- File-based debug logging to `.setu/debug.log`

### Changed
- Reduced agent persona from ~800 to ~400 tokens (50% reduction)
- Consolidated legacy preset system before single-default rollout
- Moved unit tests to `src/hooks/__tests__/` (Jest/Vitest convention)
- Centralized security logging through `logSecurityEvent()` API
- Enhanced tool execute hook with secrets detection, path validation, and audit logging
- Improved native tool guidance (prefer `glob` over `ls`, `read` over `cat`)
- Removed `PARALLEL_GUIDANCE` from dynamic injection (~300 tokens saved)
- Architecture: moved behavioral rules from agent file to hook enforcement

### Fixed
- Removed duplicate path logic in `validateFilePath`
- Removed double redaction in debug logging (50% reduction in overhead)
- Fixed runtime terminology in persona prefix
- Added constraint bypass detection for bash commands (`$`, backticks, `eval`, etc.)
- Removed duplicate tool classification constants
- Removed unused exports from `persona.ts`
- Fixed Setu-only tracking to only run in Setu mode
- Fixed markdownlint MD007 indentation in documentation

## [1.0.0-rc.3] - 2025-01-28

- Renamed runtime terminology (legacy release note)
- Eliminated meta-reasoning in agent responses
- Added file-based debug logging with `SETU_DEBUG=true`

## [1.0.0-rc.2] - 2025-01-28

- Fixed context loading on session start (was detected but not loaded)
- Added constraints survival across restarts
- Enforced runtime prefix in all responses
- Added glob-first and parallel read guidance

## [1.0.0-rc.1] - 2025-01-28

- Architecture overhaul: soul-only agent file, plugin-driven enforcement
- Added Phase 0 blocking for side-effect tools
- Removed `setu_mode` tool (user-controlled only)
- Added lazy loading and file caching

## [0.1.0-alpha] - 2025-01-24

- Initial plugin structure with TypeScript
- Phase 0 blocking enforcement
- Context persistence (`.setu/context.md`, `.setu/context.json`)
- Setu as primary agent
- Initial multi-preset runtime (legacy)
- Custom tools: `setu_verify`, `setu_context`, `setu_feedback`
- 7 bundled skills
