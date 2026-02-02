# Changelog

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
