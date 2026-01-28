# Changelog

All notable changes to setu-opencode will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### In Progress: fix/stability-and-safety

**Critical Safety Fixes (Phase A - P0):** ✅ COMPLETED
- [x] **Fix 1:** Removed `setu_mode` tool - profile switching is now user-only via message keywords
- [x] **Fix 2:** Graceful handling of missing .setu files - silent existence checks, no errors on first run
- [x] **Fix 3:** Clear Phase 0 exit path - simplified block messages, explicit `setu_context` instructions
- [x] **Fix 14:** Renamed "mode" → "profile" throughout codebase for terminology consistency
- [x] **Fix 8:** Added `#f27435` to agent frontmatter

**UX Fixes (Phase C - P1):** ✅ COMPLETED  
- [x] **Fix 7:** Simplified error messages (covered by Fix 3)
- [x] **Fix 9:** Removed auto-profile triggers (covered by Fix 1)  
- [x] **Fix 10:** User-only profile switching (covered by Fix 1)

**Architecture Fixes (Phase D - P2):**
- [x] **Fix 13:** Persona separate from AGENTS.md - already correct, no changes needed

**Performance Fixes (Phase B - P1):** ⏸️ NOT STARTED
- [ ] **Fix 4:** Lazy-load context (don't read on startup)
- [ ] **Fix 5:** Cache file existence checks
- [ ] **Fix 6:** Research configurable model selection for subagents
- [ ] **Fix 12:** Optimize context storage (compact JSON, subagent writes)

**Architecture Fixes (Phase D - P2):** ⏸️ NOT STARTED  
- [ ] **Fix 11:** Research parallel agent architecture
- [ ] **Fix 15:** Consolidate enforcement (Setu agent > Setu profile)
- [ ] **Fix 16:** AGENTS.md checked BEFORE context files

**Additional Findings:**
- **Fix 17:** Tool calling issue - NOT A BUG, documentation only (tools called by agent, not via `/` or `@`)

---

## [0.1.0-alpha] - 2025-01-24

### Added
- Initial plugin structure with TypeScript
- Phase 0 blocking enforcement (side-effect tools blocked until context confirmed)
- Context persistence (`.setu/context.md`, `.setu/context.json`)
- Setu as primary agent (Tab-accessible, default on startup)
- Mode-aware enforcement (Setu/Build/Plan)
- Context injection to subagents
- 4 operational profiles: Ultrathink, Quick, Expert, Collab
- Custom tools: `setu_verify`, `setu_context`, `setu_feedback`
- 7 bundled skills: setu-bootstrap, setu-verification, setu-rules-creation, code-quality, refine-code, commit-helper, pr-review
- Feedback mechanism (`.setu/feedback.md`)
- Session lifecycle handling (context loading on start)

### Fixed (as of 2025-01-28)
- ~~Agent can self-override safety by switching to Expert/Quick mode~~ - `setu_mode` tool removed, user-only control
- ~~Phase 0 infinite loop on first run (missing .setu files)~~ - Silent file existence checks implemented
- ~~Verbose error messages look like system failures~~ - Simplified to 1-line messages
- ~~Auto-profile detection triggers incorrectly~~ - Removed temporary triggers, persistent only

### Known Issues (Remaining)
- Heavy startup (20-30K tokens before first prompt) - Fix 4 pending
- No caching of file existence checks - Fix 5 pending

---

## Project Milestones

### v1.0 - Production Ready (Target: TBD)
**Requirements:**
- All Phase A safety issues resolved
- All Phase B performance issues resolved
- All Phase C UX issues resolved
- End-to-end testing completed
- Documentation complete
- Published to npm

### v1.1 - Polish & Recovery
- Active task persistence (`.setu/active.json`)
- Context loss recovery (compaction hooks)
- Git discipline (commit approval, branch safety)
- Environment health checks (setu-environment-doctor skill)

### v1.2 - Extended Context
- Auto-inject AGENTS.md summary
- Directory-specific rules (walk up tree)
- Scratchpad profile (for disposable code)

### v1.3 - Disciplined Delegation
- Batch mode orchestration
- Parallel subagents
- Cost arbitrage (tiered model usage)

### v2.0 - Advanced Features
- LSP integration
- Cross-session memory
- Visual verification (agent-browser)

### v3.0 - Intelligent Automation
- Auto-profile detection (with guardrails)
- Smart mode switching
- Predictive context gathering

---

## Notes

**Philosophy:**
- **Necessities** must work flawlessly before luxuries are added
- **Luxuries** are delayed until core features are stable
- If a feature exists, it cannot fail

**Current Branch:** `fix/stability-and-safety`

**Testing Environment:** `./tests/` with `opencode/big-pickle` model
