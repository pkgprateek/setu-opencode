# Changelog

## [Unreleased]

### Added
- **Progress tracking and step completion system**
  - `advanceStep`: Automatically advance step counter after verification
  - `recordFailedApproach`: Track failed attempts to prevent repeated mistakes
  - `recordWorkedApproach`: Record successful approaches for reference
  - Results Pattern: Atomic file writes with YAML sanitization
  - `prepareJITContext`: Just-in-time context preparation for subagents
  - `getJITContextSummary`: Debug summary of current context state
  - Integration with `setu_verify`: Auto-advance step and persist results
  - Integration with `setu_plan`: Clear old results on new plan creation
  - Attempt tracker persistence to prevent "ghost loops"
  - Comprehensive test suite (67 tests, 115 assertions)
  - Increased limits: 100KB result size, 2000 char YAML fields
- **Just-in-time context preparation for subagents**
  - Results Pattern: Step completion tracked via `.setu/results/step-N.md` files
  - Cleanse Protocol: JIT context preparation with token budgeting (< 2000 tokens)
  - Defense-in-depth: YAML sanitization, prompt truncation, constraint validation
  - Subagent support: JIT context injected for `explore` and `general` subagents
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
- **Security**: Path validation checks traversal patterns before normalization
- **Atomic writes**: Enhanced error handling with temp file cleanup on failure
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
- Atomic writes prevent corruption under concurrent saves
- Input sanitization rejects all control characters (0x00-0x1F, 0x7F)
- Compaction hook validates constraints array before use
- Environment doctor handles non-zero exit codes from git/node commands
- Type safety: `wrapHook` return type includes undefined for error cases
- Empty catch blocks now discriminate ENOENT from other errors
- SetuError prototype chain fixed for post-transpilation instanceof checks
- Style detection regex escapes properly (`\\s`, `\\w`)

### Changed
- **Persona optimization**: Reduced token overhead from ~1,100 to ~400 tokens (64% reduction)
- Agent version updated to 2.7.0
- Removed `expert` style, merged into `collab` (now 3 styles: ultrathink, quick, collab)
- Style guidance changed to descriptive-only (removed behavioral directives)
- Removed parallel execution guidance from persona (enforcement via hooks instead)

### Security
- Atomic writes with 32-char entropy (16 bytes) for collision resistance
- Path traversal validation with pre-normalization checks
- YAML injection prevention with control char removal
- Status runtime validation with type guards
- Context size enforcement at 50KB (down from 512KB)
- Fail-closed unknown tool handling with whitelist
- Log rotation at 1MB with 3-file retention
- Path traversal prevention in gear checks and config loading
- Defense-in-depth: sanitization + validation + atomic writes
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
- Consolidated styles from 4 to 3 (removed `expert`, merged into `collab`)
- Moved unit tests to `src/hooks/__tests__/` (Jest/Vitest convention)
- Centralized security logging through `logSecurityEvent()` API
- Enhanced tool execute hook with secrets detection, path validation, and audit logging
- Improved native tool guidance (prefer `glob` over `ls`, `read` over `cat`)
- Removed `PARALLEL_GUIDANCE` from dynamic injection (~300 tokens saved)
- Architecture: moved behavioral rules from agent file to hook enforcement

### Fixed
- Removed duplicate path logic in `validateFilePath`
- Removed double redaction in debug logging (50% reduction in overhead)
- Fixed `Profile` → `Style` terminology in persona prefix
- Added constraint bypass detection for bash commands (`$`, backticks, `eval`, etc.)
- Removed duplicate tool classification constants
- Removed unused exports from `persona.ts`
- Fixed Setu-only tracking to only run in Setu mode
- Fixed markdownlint MD007 indentation in documentation

## [1.0.0-rc.3] - 2025-01-28

- Renamed Profile to Style (ultrathink, quick, expert, collab)
- Eliminated meta-reasoning in agent responses
- Added file-based debug logging with `SETU_DEBUG=true`

## [1.0.0-rc.2] - 2025-01-28

- Fixed context loading on session start (was detected but not loaded)
- Added constraints survival across restarts
- Enforced `[Style: X]` prefix in all responses
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
- 4 operational styles: Ultrathink, Quick, Expert, Collab
- Custom tools: `setu_verify`, `setu_context`, `setu_feedback`
- 7 bundled skills
