# Changelog

All notable changes to this project are documented here.

## [Unreleased]

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
