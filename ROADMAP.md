# setu-opencode Roadmap

> Pre-emptive discipline protocol for [OpenCode](https://opencode.ai) — think first, verify always.

**Updated:** 2026-02-02

---

## Vision

**Why Setu exists:** AI coding agents are reactive — they run first, fix later. This wastes tokens, produces broken code, and frustrates developers.

**What Setu does:** Enforce discipline *before* execution. Block wrong actions, force reflection, verify results. Transform OpenCode from "fast but unpredictable" to "fast AND correct."

**The core insight:** Setu is pre-emptive, not reactive.

**The experience:** Setu should feel like a thoughtful colleague, not a gatekeeper.

---

## Version Overview

| Version | Codename | Theme | Key Deliverable |
|---------|----------|-------|-----------------|
| **v1.0** | Foundation | Ship Core | Working plugin, npm publish |
| **v1.1** | Gearbox | Artifact-Driven State | RESEARCH.md/PLAN.md enforcement |
| **v1.2** | Swarm | DAG-Based Execution | Parallel execution, Context Cleanse |
| **v2.0** | Synthesis | Goal-Backward Verification | Verify outcomes, not tasks |
| **v3.0** | Expansion | Multi-Platform | Setu Lite, MCP integration |

---

## Terminology

| Term | Scope | Meaning | Examples |
|------|-------|---------|----------|
| **Mode** | OpenCode | IDE-level agent selection via Tab | Plan, Build, Setu |
| **Style** | Setu | Operational preset within Setu | ultrathink, quick, collab |
| **Gear** | Setu v1.1+ | State determined by artifact existence | scout, architect, builder |

---

## Design Principles

| Principle | Why It Matters | Implementation |
|-----------|----------------|----------------|
| **Pre-emptive, not reactive** | Fixing mistakes costs more than preventing them | Phase 0 blocks tools until context confirmed |
| **Zero-config by default** | Friction kills adoption | Works out of box, config is optional |
| **Thoughtful colleague, not gatekeeper** | Users should feel helped, not blocked | Clear messaging, smart questions |
| **Permission > Hooks** | CANNOT is stronger than DOES NOT | Setu agent uses permission system + hooks |
| **Context once, share everywhere** | Re-gathering wastes tokens | Persist context, inject into subagents |

---

## Current State (v1.0 - Release Candidate)

### Implemented

**Core Infrastructure:**
- [x] Package structure (`src/`, `skills/`)
- [x] TypeScript configuration with strict mode
- [x] Plugin entry point with state management

**Hooks:**
- [x] `config` hook — Sets Setu as default agent
- [x] `system-transform` hook — Injects lean persona (~500 tokens)
- [x] `chat.message` hook — Style detection, agent tracking
- [x] `tool.execute.before` hook — Phase 0 blocking, context injection
- [x] `tool.execute.after` hook — Verification tracking, context collection
- [x] `event` hook — Session lifecycle, context loading
- [x] `session.compacting` hook — Injects active task on compaction

**Tools:**
- [x] `setu_verify` — Run verification protocol
- [x] `setu_context` — Confirm context, persist to `.setu/`
- [x] `setu_feedback` — Record user feedback
- [x] `setu_task` — Create active task with constraints

**Primary Agent:**
- [x] Agent registration (`.opencode/agents/setu.md` created on init)
- [x] Default on startup (`default_agent: "setu"` in config)
- [x] Mode-aware enforcement (Setu/Build/Plan awareness)
- [x] Agent file contains ONLY soul (identity, covenant, philosophy)
- [x] Plugin hooks enforce behavior (Phase 0, verification)

**Context Persistence:**
- [x] `.setu/` directory structure
- [x] `context.json` — Machine-parseable context
- [x] `active.json` — Current task, mode, constraints
- [x] `feedback.md` — User feedback mechanism
- [x] `verification.log` — Audit trail of build/test/lint results
- [x] Context collector (tracks reads/searches during Phase 0)
- [x] Context injection to subagent prompts
- [x] Lazy context loading (performance optimization)

**Security:**
- [x] Path traversal prevention with robust validation
- [x] Secrets detection (15 patterns, severity levels)
- [x] Constraint bypass detection with warnings
- [x] Rate limiting on `setu_feedback` tool
- [x] Audit logging for security events

**Skills:**
- [x] 7 bundled skills (bootstrap, verification, rules-creation, code-quality, refine-code, commit-helper, pr-review)

### Known Limitations

- **First-run restart required:** Setu appears in Tab cycle only after restarting OpenCode. This is because OpenCode scans agent files before plugins initialize. (Fix planned for v1.2)

### v1.0 Release Checklist

- [x] Setu as primary agent (appears in Tab cycle, default on startup)
- [x] Context persistence (`.setu/context.json`, `.setu/active.json`)
- [x] Verification logging (`.setu/verification.log`)
- [x] DAG execution guidance in persona
- [x] System directive prefix (`[Style: X]`)
- [x] Mode-aware enforcement (don't conflict with Plan mode)
- [x] Agent file contains ONLY soul (no behavioral instructions)
- [x] Plugin hooks enforce behavior
- [x] Removed `setu_mode` tool (agent cannot bypass Phase 0)
- [x] Performance optimizations (lazy loading, file cache)
- [x] Security: Constraint bypass detection with warnings
- [ ] Build and test plugin end-to-end
- [ ] Publish to npm as `setu-opencode`
- [ ] Test all 3 styles (ultrathink, quick, collab)
- [ ] Documentation (usage examples, configuration options)
- [ ] Update README with quick start guide

---

## v1.1: Gearbox — Artifact-Driven State

> **Theme:** Replace binary Phase 0 with artifact-existence Gearbox. State is determined by which files exist.

### Gearbox Architecture

The Gearbox is a state machine where transitions are triggered by artifact creation:

| Gear | Goal | Trigger | Permissions | Blocked |
|------|------|---------|-------------|---------|
| **Scout** | "Compress Truth" | `!exists(RESEARCH.md)` | Read-only | write, edit, bash (non-read) |
| **Architect** | "Compress Intent" | `exists(RESEARCH.md)` AND `!exists(PLAN.md)` | Meta-write (.setu/ only) | Source writes |
| **Builder** | "Execute & Verify" | `exists(PLAN.md)` | Full (with verification gate) | None |

```
Session Start
     │
     ▼
Check: Does .setu/RESEARCH.md exist?
     │
  NO ────────────────────────────────────────┐
     │                                        │
     ▼                                        ▼
  SCOUT Gear                            Check: PLAN.md?
  • Block: write, edit, bash                  │
  • Allow: read, glob, grep, task        NO ──┘    YES
  • Goal: Research, write RESEARCH.md         │      │
                                              ▼      ▼
                                         ARCHITECT  BUILDER
                                         • Write .setu/  • Full access
                                         • Create PLAN   • Verify gate
```

### Core Features

- [ ] **Gear Type System** — `src/enforcement/gears.ts`
  - Type-safe gear definitions (scout, architect, builder)
  - `determineGear()` function based on artifact existence
  - `shouldBlock()` function for permission enforcement

- [ ] **Artifact Templates** — `src/templates/research.ts`
  - RESEARCH.md template with sections: Findings, Constraints, Patterns, Next Steps
  - PLAN.md template with YAML frontmatter for task metadata

- [ ] **Artifact Tools**
  - `setu_research` — Save research findings, transition scout → architect
  - `setu_plan` — Create execution plan, transition architect → builder

- [ ] **Hook Integration** — Update `src/hooks/tool-execute.ts`
  - Replace `getPhase0State()` with `determineGear()`
  - Gear-aware blocking messages
  - Constraint enforcement orthogonal to gears

### Attempt Limits with Gear Shifting

> **Why:** When an approach fails repeatedly, the agent should learn and adapt, not retry blindly.

- [ ] **Smart Retry System** — `src/enforcement/attempts.ts`
  - Track attempts per task (default: 3, configurable via `setu.json`)
  - After N failures, suggest gear shift to update PLAN.md or RESEARCH.md
  - Persist learnings (what worked, what didn't) to avoid repeating mistakes
  - Configuration hierarchy: `.setu/setu.json` (project) > `~/.config/opencode/setu.json` (global)

### Pre-Commit Checklist

> **Why:** Prevent "Hail Mary" commits where neither user nor agent understands the change.

- [ ] **Verification Prompt** — Before git commit:
  - "Do you understand what was changed?"
  - "Has the change been verified (build/test)?"
  - "Is this the right branch?"
  - If any concern, pause and discuss

### Environment Health

- [ ] **Environment Doctor Tool** — `src/tools/setu-doctor.ts`
  - Check git status (uncommitted changes)
  - Check dependencies (node_modules exists, lockfile sync)
  - Check runtime versions (Node/Python match engines)
  - Check port conflicts (dev server already running)
  - Check disk space (low disk causes cryptic failures)
  - Leverage OpenCode's LSP integration for diagnostics

### Security Enhancements

- [ ] **Context Size Limits**
  - Cap `context.json` at 50KB
  - Cap context injection to subagents at 8000 chars (~2000 tokens)
  - Truncate gracefully with `[TRUNCATED]` marker

- [ ] **Input Sanitization**
  - Validate `output.args` before use in hooks
  - Prevent injection via tool arguments

- [ ] **Bypass Detection Solution**
  - Log unknown tools at WARNING level (not just debug)
  - Consider fail-closed with whitelist for new tools

- [ ] **Audit Log Rotation**
  - Rotate `.setu/verification.log` at 1MB
  - Keep last 3 log files

### Configuration

- [ ] **Setu Configuration File** — `setu.json`
  - Schema: `assets/setu.schema.json`
  - Locations: `.setu/setu.json` (project) or `~/.config/opencode/setu.json` (global)
  - Options: `maxAttempts`, `verbosity`, `contextSizeLimit`, feature flags
  
- [ ] **Verbosity Toggle**
  - `verbosity: "minimal" | "standard" | "verbose"`
  - Minimal: Actions only
  - Standard: Actions + key reasoning (default)
  - Verbose: Everything including meta-reasoning

### v1.1 Success Criteria

- [ ] Gearbox determines gear from artifacts in <10ms
- [ ] Gear transitions happen atomically (no race conditions)
- [ ] Attempt limits prevent infinite retry loops
- [ ] Pre-commit checklist catches blind commits
- [ ] Environment Doctor prevents Ghost Loops
- [ ] README updated with v1.1 features

---

## v1.2: Swarm — DAG-Based Execution

> **Theme:** Enable true parallel execution. Independent tasks run simultaneously.

### DAG Execution Model

**Why DAG over Wave-based:**
- Wave-based: Tasks grouped into waves, parallel only within wave
- DAG-based: Any independent nodes can execute in parallel
- DAG provides true parallelism, waves are artificially sequential

```
       ┌─── Task A ───┐
       │              │
Start ─┼─── Task B ───┼─── End
       │              │
       └─── Task C ───┘

A, B, C have no dependencies → execute in parallel
```

### Core Features

- [ ] **Task Swarm Tool** — `src/tools/setu-swarm.ts`
  - Execute multiple tasks in parallel using subagents
  - Aggregate results from all tasks
  - Error isolation (one failure doesn't crash others)
  - Dependency analysis for wave ordering when needed

### Context Cleanse Protocol (JIT Loading)

**The Problem with Full Context Loading:**
1. **Token Waste:** Paying for "Step 10" details while executing "Step 1"
2. **Distraction:** Model sees future steps, may hallucinate needing them now
3. **Scalability Cap:** A 1,000-step plan breaks context window; JIT is infinite

**The Solution: Just-In-Time Context**

- [ ] **Context Cleanse Tool** — `src/context/cleanse.ts`
  - Prepare minimal, focused context for subagents
  - Extract summary from RESEARCH.md (not full content)
  - Extract current objective from PLAN.md
  - Provide `setu_consult_research(query)` for on-demand lookups

- [ ] **Context Size Warning**
  - Monitor `.setu/context.json` size
  - Warn at 50KB threshold
  - Suggest manual cleanup if needed

### Multi-Session Artifact Management

> **Why:** Users may have multiple sessions working on different aspects of a project.

- [ ] **Session-Aware Artifacts** — `.setu/artifacts/` structure
  ```
  .setu/
  ├── setu.json              # Per-project config
  ├── context.json           # Project-level context (shared)
  ├── verification.log       # Audit trail
  ├── feedback.md
  ├── active.json            # Now includes session_id, task_id
  ├── RESEARCH.md            # Current session's research
  ├── PLAN.md                # Current session's plan
  └── archive/               # Completed session artifacts
      └── {timestamp}-{task-slug}/
          ├── RESEARCH.md
          ├── PLAN.md
          └── summary.md
  ```

### First-Run Agent Registration

- [ ] **Solve first-run issue**
  - Options: CLI init command, postinstall script, or OpenCode API request
  - Goal: Setu appears in Tab cycle without restart

### Gold Test Generation (Opt-in)

> **Why:** When a bug is fixed, that scenario becomes a valuable regression test.

- [ ] **Post-Verification Test Capture**
  - After `setu_verify` returns success, offer to generate regression test
  - Capture: files changed, error that was fixed, expected behavior
  - Generate test case appropriate to project's test framework
  - Save to appropriate test directory

### Visual Enhancements (Luxury)

- [ ] **Colored Terminal Output** — `src/utils/terminal.ts`
  - 🔴 Red: Phase 0 blocks, verification failures
  - 🟢 Green: Verification passed, context confirmed
  - 🟡 Yellow: Warnings, suggestions, asking for guidance
  - 🔵 Blue: Information, progress updates

### v1.2 Success Criteria

- [ ] DAG-based parallel execution working (measure time savings)
- [ ] Independent tasks run simultaneously
- [ ] Context Cleanse (JIT reload) working
- [ ] Subagents get fresh, focused context
- [ ] Results aggregated correctly
- [ ] Multi-session artifacts managed correctly
- [ ] README updated with v1.2 features

---

## v2.0: Synthesis — Goal-Backward Verification

> **Theme:** Verify outcomes, not just task completion.

### Goal-Backward Verification

**The insight:** "I completed the task" is not the same as "the feature works."

```typescript
interface MustHaves {
  truths: string[];           // Observable behaviors ("User can see messages")
  artifacts: ArtifactSpec[];  // Files that must exist
  key_links: KeyLink[];       // Critical connections between components
}
```

### Core Features

- [ ] **Goal-Backward Verification** — `src/verification/goal-backward.ts`
  - Verify truths (observable behaviors)
  - Verify artifacts exist with minimum content
  - Verify key links (component wiring)

- [ ] **Workflow Commands**
  - `/setu-new-project` — Initialize project structure
  - `/setu-plan-phase` — Create phase plans
  - `/setu-execute-phase` — Run DAG-based parallel execution
  - `/setu-verify-work` — Goal-backward verification

### Verification Proof Requirement

```typescript
interface VerificationProof {
  step: 'build' | 'test' | 'lint' | 'typecheck';
  command: string;
  exitCode: number;
  output: string;
  timestamp: string;
}
```

- Never trust "I fixed it!" — demand proof (exit code 0)

### Architecture Improvements

- [ ] **Plugin Metrics** — `src/utils/metrics.ts`
  - Track: blocks issued, verifications completed, gear transitions
  - Expose via debug mode for troubleshooting
  - No external telemetry (privacy-first)

- [ ] **Health Check Endpoint**
  - Verify plugin is functioning correctly
  - Check hook registration, tool availability

- [ ] **Error Handling Layer**
  - Graceful degradation when hooks fail
  - Clear error messages for users

### v2.0 Success Criteria

- [ ] Goal-backward verification working
- [ ] Workflow commands available
- [ ] Verification proof required before "done" claims
- [ ] Metrics available in debug mode
- [ ] README updated with v2.0 features

---

## v3.0: Expansion — Multi-Platform

> **Theme:** Extend Setu to other platforms and tools.

### Setu Lite for Claude Code

- [ ] **Claude Code Version** — `setu-lite-claude/`
  - Port Setu persona as `.claude/agents/setu.md`
  - Port workflow templates (no enforcement, just guidance)
  - Port commands as `.claude/commands/setu/`
  - Clear documentation of "Lite" vs "Full" differences

**Limitation:** Claude Code lacks `tool.execute.before` hook, so no blocking. Setu Lite is prompt-ware only.

### MCP Tool Integration

- [ ] **MCP Integration** — `src/mcp/integration.ts`
  - Detect available MCP tools (browser, database, etc.)
  - Enhance verification when tools available
  - Graceful degradation when tools missing

### Cross-Session Memory (Deferred)

> **Note:** This is complex and requires prerequisites (v1.2 artifacts, v2.0 verification). Deferred until foundations are solid.

- [ ] **Pattern Memory Across Sessions**
  - Use diff/Wasserstein distance for context similarity
  - Identify reusable patterns from past sessions
  - Suggest relevant past learnings for current task

### Deferred Features

- [ ] **Visual Verification** (requires `agent-browser`)
  - Take screenshots, analyze accessibility
  - E2E testing for web projects

- [ ] **Scratchpad Style**
  - Bypass all enforcement for disposable scripts
  - Still tracks context for future reference

- [ ] **Other Plugin Detection**
  - Detect conflicting discipline plugins
  - Enter minimal mode to avoid conflicts

### v3.0 Success Criteria

- [ ] Setu Lite works in Claude Code
- [ ] MCP tools enhance verification
- [ ] Plugin conflicts handled gracefully
- [ ] README updated with v3.0 features

---

## Deprecation Policy

Features may be deprecated with one minor version warning before removal. Deprecated features will be documented in release notes.

---

## Proof & Metrics

### Token Savings
- [ ] Baseline: Raw OpenCode session token count
- [ ] With Setu: Same task, measure difference
- [ ] Publish: "X% fewer tokens on average"

### Error Prevention
- [ ] Test: Session where agent claims "done" with broken build
- [ ] Record: Setu blocking completion, forcing verification

### DAG Execution
- [ ] Test: Context gathering with serial vs parallel reads
- [ ] Record: Time savings with parallel execution

---

## Interoperability

### Priority: OpenCode Compatibility (HIGH)

Setu as a primary agent means:
- User can Tab away if Setu causes issues
- OpenCode features (Plan/Build) remain accessible
- No breaking changes to OpenCode behavior

### Priority: Other Plugin Compatibility (v3.0)

When other discipline plugins are detected:
- Setu enters "minimal mode" (reduced functionality)
- Defers context injection to other plugin
- Focuses on Phase 0 and verification only

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

Priority areas:
- Testing enforcement on diverse projects
- Additional verification patterns
- Documentation with real examples

---

## License

Apache 2.0 — See [LICENSE](./LICENSE)
