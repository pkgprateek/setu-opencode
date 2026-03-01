# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [1.3.4] - 2026-03-01

### Changed

- Normalize `setu init` plugin wiring to a canonical deterministic spec (`setu-opencode@<running-version>`) by migrating legacy entries like `setu-opencode` and `setu-opencode@latest` while preserving non-Setu plugin order.
- Expand `setu uninstall` plugin cleanup to remove all Setu spec variants (`setu-opencode` and `setu-opencode@...`) without touching unrelated plugins.
- Bump package and agent metadata version to `1.3.4` for release consistency.

### Fixed

- Make legacy OpenCode home config root validation platform-aware so Windows absolute paths are accepted during legacy cleanup resolution.

## [1.3.3] - 2026-03-01

### Fixed

- Clean legacy managed Setu agent files from `~/.opencode/{agent,agents}/setu.md` during `setu init` to prevent stale shadowing of global agent updates.
- Expand `setu uninstall` cleanup to remove managed Setu wiring from both global config and legacy home `.opencode` roots while preserving unmanaged custom agent files.
- Harden global OpenCode config root resolution for cross-platform installs (`APPDATA` on Windows, `XDG_CONFIG_HOME` fallback on non-Windows).

### Changed

- Clarify and enforce task lifecycle semantics so `setu_task(action="update_status")` remains progress-only and does not imply automatic `clear`.
- Bump package and agent metadata version to `1.3.3` for release consistency.

## [1.3.2] - 2026-02-26

### Documentation

- Update installation guidance to use deterministic one-liners across npm/pnpm/bun with `setu init`.
- Add explicit uninstall section for clean global removal from OpenCode config.

### Changed

- Bump package and agent metadata version to `1.3.2` for release consistency.

## [1.3.1] - 2026-02-25

### Documentation

- Clarify top-level README naming and positioning for `setu-opencode`.
- Improve release metadata alignment across docs.

### Changed

- Bump package version to `1.3.1` for npm republish.

## [1.3.0] - 2026-02-25

### Documentation

- Rewrite root and internal docs for clarity, persona fit, and API correctness.
- Remove stale references to removed tools and deprecated signatures.

### Added

- Global CLI lifecycle:
  - `setu init` for global bootstrap
  - `setu uninstall` for global cleanup
- Explicit global-install detection for postinstall bootstrap.
- `prepack` build script to prevent stale tarball output.

### Changed

- BREAKING: Install/bootstrap model simplified:
  - global bootstrap is explicit and idempotent
  - non-global installs do not mutate global OpenCode config
  - `setu init --global` is no longer required; use `setu init`
- `.setu/` initialization is now lazy:
  - created on first Setu message in a session when missing
  - no eager creation at plugin startup
- Typecheck setup aligned for Bun test typings (`bun-types` in TypeScript config).
- BREAKING: `setu_task` action parameters updated:
  - `update` replaced by `update_status`
  - `reframe` added to update task intent/constraints without resetting artifacts

### Removed

- BREAKING: `setu_feedback` tool and feedback persistence subsystem removed.
- Automatic `.setu/.gitignore` setup logic from agent bootstrap path.
- BREAKING: Project-scope bootstrap path in install flow removed (global bootstrap is primary path).

### Fixed

- Postinstall loader path resolution now uses script-relative path, not `process.cwd()`.
- Bootstrap error handling now consistently returns user-safe warnings for write/permission failures.

## [1.2.1] - 2026-02-18

### Added

- Artifact lifecycle policy for append/remake behavior.
- Research chunk persistence under `.setu/research_chunks/` for very large payloads.

### Changed

- Hydration terminology standardized.
- Decision gate made capability-aware (`question` tool when available, `setu_context` fallback).

### Fixed

- Hydration enforcement wiring for side-effect tools.
- Read-before-write protection for edit operations.
- Safety confirmation flow and question resolution timing.

## [1.2.0] - 2026-02-10

### Highlights

- Unified gear-driven enforcement as the primary workflow authority.
- Removed competing in-memory workflow state machine.
- Added discipline guards for question/safety/overwrite flows.
- Added `setu_task`, `setu_research`, `setu_plan`, `setu_reset`, and `setu_doctor` to the core workflow.
