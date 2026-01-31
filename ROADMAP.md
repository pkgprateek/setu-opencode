# setu-opencode Roadmap

> Pre-emptive discipline protocol for [OpenCode](https://opencode.ai) — think first, verify always.

## Vision

**Why Setu exists:** AI coding agents are reactive — they run first, fix later. This wastes tokens, produces broken code, and frustrates developers.

**What Setu does:** Enforce discipline *before* execution. Block wrong actions, force reflection, verify results. Transform OpenCode from "fast but unpredictable" to "fast AND correct."

**The core insight:** Setu is pre-emptive, not reactive.

**The experience:** Setu should feel like a thoughtful colleague, not a gatekeeper.

---

## Current State (v1.0 - Release Candidate)

### Implemented

**Core Infrastructure:**
- [x] Package structure (`src/`, `skills/`)
- [x] TypeScript configuration
- [x] Plugin entry point with state management

**Hooks:**
- [x] `config` hook — Sets Setu as default agent
- [x] `system-transform` hook — Injects lean persona (~500 tokens)
- [x] `chat.message` hook — Operational profile detection, agent tracking
- [x] `tool.execute.before` hook — Phase 0 blocking, context injection to subagents
- [x] `tool.execute.after` hook — Verification tracking, context collection
- [x] `event` hook — Session lifecycle, context loading on start

**Tools:**
- [x] `setu_verify` tool — Run verification protocol
- [x] `setu_context` tool — Confirm context, persist to `.setu/`
- [x] `setu_feedback` tool — Record user feedback

**Setu as Primary Agent (Movement 1):**
- [x] Agent registration (`.opencode/agents/setu.md` created on init)
- [x] Default on startup (`default_agent: "setu"` in config)
- [x] Mode-aware enforcement (Setu/Build/Plan awareness)
- [x] Agent file contains ONLY soul (identity, covenant, philosophy)
- [x] Plugin hooks enforce behavior (Phase 0, verification)

**Context Persistence (Movement 2):**
- [x] `.setu/` directory structure
- [x] `context.json` — Machine-parseable context
- [x] `active.json` — Current task, mode, constraints
- [x] `feedback.md` — User feedback mechanism
- [x] `verification.log` — Audit trail of build/test/lint results
- [x] Context collector (tracks reads/searches during Phase 0)
- [x] Context injection to subagent prompts
- [x] Lazy context loading (performance optimization)
- [x] File existence caching (5-second cache)

**Anthropic Alignment:**
- [x] Enhanced "why" reasoning in Phase 0 block messages
- [x] Priority hierarchy (Safe → Contextual → Efficient → Helpful)
- [x] Transparency/feedback mechanism

**Skills:**
- [x] 7 bundled skills (bootstrap, verification, rules-creation, code-quality, refine-code, commit-helper, pr-review)

**Safety Fixes:**
- [x] Removed `setu_mode` tool (agent cannot bypass Phase 0)
- [x] Graceful handling of missing `.setu/` files
- [x] Clear Phase 0 exit path (one-line block message)
- [x] Renamed "mode" → "Style" terminology

### Known Limitations

- **First-run restart required:** Setu appears in Tab cycle only after restarting OpenCode. This is because OpenCode scans agent files before plugins initialize. (Fix planned for v1.2)

### Not Yet Implemented

**Future Enhancements:**
- [ ] `session.idle` hook — Verification enforcement (waiting for API)
- [ ] Subagent tool interception — Defense in depth for child sessions

---

## Design Principles

| Principle | Why It Matters | Implementation |
|-----------|----------------|----------------|
| **Pre-emptive, not reactive** | Fixing mistakes costs more than preventing them | Phase 0 blocks tools until context confirmed |
| **Zero-config by default** | Friction kills adoption | Works out of box, config is optional override |
| **Thoughtful colleague, not gatekeeper** | Users should feel helped, not blocked | Clear messaging, smart questions, fast parallel reads |
| **Permission > Hooks** | CANNOT is stronger than DOES NOT | Setu agent uses permission system + hooks |
| **Context once, share everywhere** | Re-gathering wastes tokens | Persist context, inject into subagents |

---

## Terminology

To avoid confusion with OpenCode's Plan/Build modes:

| Term | Meaning | Examples |
| ------ | --------- | ---------- |
| **Mode** (OpenCode) | IDE-level agent selection via Tab | Plan, Build, Setu |
| **Style** (Setu) | Operational preset within Setu | ultrathink, quick, expert, collab |

---

## v1.0 Release Checklist

Before publishing:
- [x] Setu as primary agent (appears in Tab cycle, default on startup)
- [x] Context persistence (`.setu/context.json`, `.setu/active.json`)
- [x] Verification logging (`.setu/verification.log`)
- [x] Parallel execution guidance in persona
- [x] System directive prefix (`[Style: X]`)
- [x] Mode-aware enforcement (don't conflict with Plan mode)
- [x] Agent file contains ONLY soul (identity, covenant, philosophy)
- [x] Plugin hooks enforce behavior (no behavioral instructions in agent file)
- [x] Removed `setu_mode` tool (agent cannot bypass Phase 0)
- [x] Performance optimizations (lazy loading, file cache)
- [x] Security: Constraint bypass detection with warnings
- [ ] Build and test plugin end-to-end
- [ ] Publish to npm as `setu-opencode`
- [ ] Test all 4 operational styles
- [ ] Documentation (usage examples, configuration options)

### Anthropic Alignment Enhancements (Completed)
- [x] Enhanced "why" reasoning in Phase 0 block messages
- [x] Priority hierarchy (Safe → Contextual → Efficient → Helpful)
- [x] Character evaluation guidance in metrics
- [x] Transparency/feedback mechanism (`.setu/feedback.md`)

### Phase 0 Silent Reconnaissance (Required for v1.0)

> **Why:** Asking questions that `AGENTS.md` or `.setu/` already answers wastes tokens and frustrates users. Setu should "know" project context before speaking.

- [x] **Automatic Context Injection on Session Start**
    - **Why:** setu.md mandates parallel reads of context files before any user interaction. This ensures Setu starts informed, not ignorant. Hooks are reliable — the model cannot skip or forget.
    - **What:** On `session.created`, automatically read and inject project context.
    - **How:**
      1. In `src/hooks/event.ts`, on session start:
         - Read files synchronously: `.setu/active.json`, `.setu/context.json`, `AGENTS.md`, `CLAUDE.md`
         - If `.setu/active.json` has `status: "in_progress"`, prepare resume prompt
         - Store in ProjectRules state
      2. In `src/hooks/system-transform.ts`, inject project rules into system prompt
      3. In `src/context/project-rules.ts`, format rules for injection
    - **Trigger:** `session.created` event
    - **Implementation:** `src/hooks/event.ts`, `src/hooks/system-transform.ts`, `src/context/project-rules.ts`
    - **Reference:** setu.md lines 42-57

### Git Discipline (Required for v1.0)

> **Why:** The repository is sacred ground. Careless commits create chaos. Agents should never commit without explicit approval.

- [ ] **Git Repo Detection**
    - **Why:** Non-git projects shouldn't be nagged about commits. Ask once, remember forever.
    - **What:** Detect if current directory is a git repo; ask ONCE if user wants to initialize.
    - **How:**
      1. On session start, check if `.git/` exists
      2. If not, ask: "This project isn't a git repository. Would you like me to initialize one?"
      3. Store decision in `.setu/context.json` under `git.initialized: boolean`
      4. If user declines, skip all git discipline for this project permanently
    - **Trigger:** Session start (part of Silent Exploration)
    - **Implementation:** `src/hooks/event.ts`, `src/context/storage.ts`

- [ ] **Commit Approval Protocol**
    - **Why:** Agents commit without asking, creating messy histories.
    - **What:** Always ask before every commit and push.
    - **How:**
      1. Add to persona: "ALWAYS ask before EVERY commit. ALWAYS ask before push."
      2. Intercept `git commit` and `git push` in `tool.execute.before` to enforce
    - **Implementation:** `src/prompts/persona.ts`, `src/hooks/tool-execute.ts`
    - **Reference:** setu.md lines 345-358

- [ ] **Dependency Change Approval**
    - **Why:** Unreviewed dependency changes can introduce security risks, bloat, or breaking changes.
    - **What:** Always document approval before adding/removing dependencies to package.json.
    - **How:**
      1. Before modifying package.json dependencies or devDependencies, ask user for approval
      2. Document approval in PR description with approver and timestamp
      3. Example: "devDependencies approved by @user on 2026-01-29 14:30 UTC"
    - **Implementation:** `src/prompts/persona.ts` (guidance), `src/hooks/tool-execute.ts` (optional enforcement)

- [ ] **Branch Safety Warnings**
    - **Why:** Accidental commits to main on complex tasks cause problems.
    - **What:** Warn if on main/master and task is non-trivial.
    - **How:** Check current branch; if `main`/`master` + complex task, suggest feature branch
    - **Trigger:** Before commit in non-trivial tasks
    - **Implementation:** Part of commit approval flow in `src/hooks/tool-execute.ts`

### Skill Updates (Required for v1.0)

The bundled skills and local development skills need updates to reflect recent changes:

- [ ] **Update `project-patterns` skill** (`.claude/skills/`)
    - Add: config hook pattern
    - Add: context collector pattern  
    - Add: agent tracking pattern
    - Add: feedback mechanism pattern
    - Add: compaction hook pattern (new)

- [ ] **Update `setu-bootstrap` skill** (`skills/`)
    - Add: `.setu/` directory creation
    - Add: `active.json` initialization
    - Add: Check for existing context on new project

- [ ] **Update `setu-verification` skill** (`skills/`)
    - Add: Logging to `.setu/verification.log`
    - Add: Stack-specific verification commands

---

## The Path to v1.0

Three movements to production-ready.

### Movement 1: Setu as Primary Agent
*Goal: Make Setu a first-class mode, not just a layer.*

#### Setu Agent Registration

> **Why:** Users should start in Setu mode by default. Tab key lets them switch if needed.

- [x] **Create Setu Primary Agent**
    - **Why:** Setu as a layer conflicts with OpenCode's Plan mode. Setu as a mode is cleaner.
    - **What:** Create `.opencode/agents/setu.md` at plugin initialization
    - **How:** Use config hook to set `default_agent: "setu"`
    - **Implementation:** `src/agent/setu-agent.ts`

- [x] **Default on Startup**
    - **Why:** Users forget to switch, don't get benefits
    - **What:** Set Setu as default agent when plugin loads
    - **How:** In config hook: `config.default_agent = "setu"`
    - **Implementation:** `src/index.ts` config hook

- [x] **Mode-Aware Enforcement**
    - **Why:** When user Tabs to Plan/Build, Setu hooks shouldn't conflict
    - **What:** Detect current agent, adjust enforcement
    - **How:**
      - In Setu mode: Full Phase 0 + verification enforcement
      - In Plan mode: Defer to OpenCode (track context only)
      - In Build mode: Light enforcement (verification reminders)
    - **Implementation:** `src/hooks/tool-execute.ts` with `getEnforcementLevel()`

### Movement 2: Context Persistence
*Goal: Gather context once, use everywhere.*

#### The `.setu/` Directory

> **Why:** Context should survive sessions and flow to subagents without re-reading.

- [x] **Directory Structure**
    - **Path:** `.setu/` at project root
    - **Files:**
      ```
      .setu/
      ├── context.json      # Machine-parseable for injection
      ├── active.json       # Current task, mode, constraints
      ├── feedback.md       # User feedback on Setu behavior
      └── verification.log  # Build/test/lint results (append-only)
      ```
    - **Note:** `context.md` was deprecated — AGENTS.md serves as human-readable rules
    - **How:** Created on first `setu_context` call
    - **Implementation:** `src/context/storage.ts`

- [x] **Context Collection During Phase 0**
    - **Why:** Track what files were read, patterns found
    - **What:** Build context incrementally as agent explores
    - **How:** Track reads/greps in `tool.execute.after`
    - **Implementation:** `src/hooks/tool-execute.ts` - `createToolExecuteAfterHook`
    - **Data:**
      ```json
      {
        "version": "1.0",
        "project": { "type": "typescript", "runtime": "bun" },
        "filesRead": [{ "path": "src/index.ts", "readAt": "..." }],
        "searchesPerformed": [{ "pattern": "...", "tool": "grep" }],
        "patterns": [{ "name": "hook-based", "description": "..." }],
        "confirmed": true,
        "confirmedAt": "2025-01-20T10:30:00Z"
      }
      ```

- [x] **Context Persistence on Confirmation**
    - **Why:** Understanding shouldn't be lost
    - **What:** Write `.setu/context.json` when confirmed (human-readable rules in AGENTS.md)
    - **How:** Enhanced `setu_context` tool to persist
    - **Implementation:** `src/tools/setu-context.ts`, `src/context/storage.ts`

- [x] **Context Injection to Subagents**
    - **Why:** Subagents shouldn't re-read files
    - **What:** Inject context summary into subagent prompts
    - **How:** In `tool.execute.before` for `task` tool
    - **Implementation:** `src/hooks/tool-execute.ts` - `createToolExecuteBeforeHook`
    - **Format:**
      ```
      [SETU CONTEXT]
      Project: typescript, runtime: bun
      Files already read: src/index.ts, package.json (+5 more)
      Patterns: hook-based, state-isolation
      Task: Implement context persistence
      [/SETU CONTEXT]
      
      [TASK]
      <original prompt>
      ```

- [x] Context Continuity Across Sessions
    - **Why:** New session shouldn't start from scratch
    - **What:** Load existing context on session start
    - **How:** In `event` hook for `session.created`, load `.setu/context.json`
    - **Implementation:** `src/hooks/event.ts`

- [x] **Active Task Persistence**
    - **Why:** Context loss during compaction causes agents to "go rogue" — forgetting what user asked and executing unrelated or unwanted actions. This is a critical safety issue.
    - **What:** Track current task, mode, and constraints in `.setu/active.json`
    - **How:** 
      - Create on task start (when user provides task)
      - Update on status change
      - Check on session start (resume or new task?)
      - Inject into compaction summary
    - **Implementation:** `src/context/active.ts`, `src/hooks/event.ts`
    - **Format:**
      ```json
      {
        "task": "Upgrade ~/Nandaka/prompts/setu.md",
        "mode": "plan",
        "constraints": ["READ_ONLY"],
        "references": ["https://anthropic.com/news/claude-new-constitution"],
        "startedAt": "2025-01-24T...",
        "status": "in_progress"
      }
      ```

- [x] **Compaction Recovery Protocol**
    - **Why:** OpenCode's compaction summarizes conversation, potentially losing critical constraints and task details. This caused a session to "go rogue" during setu-opencode development.
    - **What:** Use `experimental.session.compacting` hook to inject active task into compaction summary
    - **How:** Plugin hook reads `.setu/active.json` and injects content into compaction prompt
    - **Implementation:** `src/hooks/compaction.ts`
    - **Reference:** [OpenCode Compaction Hooks](https://opencode.ai/docs/plugins#compaction-hooks)

- [x] **Pre-Action Alignment Check**
    - **Why:** Prevent executing actions that don't align with active task (especially after context loss/compaction)
    - **What:** Before side-effect tools, verify action matches `.setu/active.json` task
    - **How:** In `tool.execute.before`:
      - If active.json exists and has constraints (e.g., "READ_ONLY"), block side-effect tools
      - Supports: READ_ONLY, NO_PUSH, NO_DELETE, SANDBOX
    - **Implementation:** `src/hooks/tool-execute.ts`

### Movement 3: Parallel Execution & Efficiency
*Goal: Fast and efficient, not slow and wasteful.*

#### Parallel Execution Support

> **Why:** Senior devs and startup founders need speed. Serial reads waste time.

- [x] **Parallel Execution Audit Trail**
    - **Why:** Observability into whether agents are actually parallelizing
    - **What:** Log parallel execution batches in debug mode
    - **Implementation:** `src/hooks/tool-execute.ts` - `recordToolExecution()`
    - **Output:** `Parallel execution: 3 tools in batch [read, read, glob]`

- [x] **Persona Enhancement**
    - **Why:** Models need explicit guidance to use parallel tools
    - **What:** Add parallel execution section to persona
    - **Implementation:** `src/prompts/persona.ts` - `PARALLEL_GUIDANCE` constant
    - **Result:** System prompt includes efficiency rules with tool lists

- [x] **System Directive Prefix**
    - **Why:** Clear separation of Setu injections from user content
    - **What:** Prefix all Setu prompts with `[Style:]`
    - **Implementation:** `src/prompts/persona.ts` - `getStylePrefix()`

#### Pre-emptive Enforcement (Phase 0)

> **Why:** Block wrong actions before they happen.

- [x] **Phase 0 Hard Enforcement**
    - **Why:** Models ignore soft "wait" instructions
    - **What:** Block SIDE-EFFECT tools until context confirmed
    - **Allow:** `read`, `glob`, `grep`, `webfetch`, `todoread`
    - **Allow bash:** `ls`, `cat`, `head`, `tail`, `grep`, `find`, `pwd`, `echo`, `which`, `env`, `git status`, `git log`, `git diff`, `git branch`, `git show`
    - **Block:** `write`, `edit`, `todowrite`, `bash` (other), `git` (write)
    - **Unlock:** Agent calls `setu_context` tool

- [ ] **Subagent Tool Interception**
    - **Why:** Subagents in child sessions might bypass hooks
    - **What:** Both hook-based AND permission-based blocking
    - **How:** Setu agent has permission rules, hooks provide defense in depth

#### Verification Before "Done"

> **Why:** "Done" should mean "verified working."

- [ ] **Session Idle Enforcement**
    - **Why:** Agents claim "Done!" without running tests
    - **What:** Intercept before yield; force verification if incomplete
    - **How:** Use `session.idle` hook (when available)

- [ ] **Verification Logging**
    - **Why:** Audit trail of what was verified
    - **What:** Append to `.setu/verification.log`
    - **Format:** Markdown with timestamps
    - **Priority:** v1.1

#### Attempt Limits

> **Why:** When the approach is wrong, ask for help instead of retrying forever.

- [ ] **2-Tries-Then-Ask Pattern**
    - **Why:** Agents retry same failing approach forever
    - **What:** After 2 failures, stop and ask for guidance
    - **How:** Track in `tool.execute.after`, enforce in next tool call

---

## v1.1: Polish & Configuration

### Verbosity Toggle

> **Why:** Engineers want to see task reasoning, not meta-reasoning about Setu's instructions.

- [ ] **Verbosity Levels**
  - **Config:** `opencode.json` → `setu.verbosity: "minimal" | "standard" | "verbose"`
  - **Minimal:** Actions only, no reasoning shown
  - **Standard:** Actions + key task reasoning (default)
  - **Verbose:** Everything including meta-reasoning (for debugging Setu itself)
  - **Implementation:** Inject verbosity level into agent persona dynamically

### Parallel Subagents

> **Why:** Offload work to keep main context clean, run tasks in parallel.

- [ ] **Subagent Configuration**
  - **Config:** `opencode.json` → Define subagents with dedicated models
  - **Default Model:** `google/antigravity-gemini-3-flash` for all subagents
  - **Example subagents:** setu-explorer (read-only), setu-doc-writer
  - **Usage:** Setu spawns subagents via Task tool in parallel

Example configuration:
```json
{
  "agent": {
    "setu-explorer": {
      "description": "Context exploration and file discovery",
      "mode": "subagent",
      "model": "google/antigravity-gemini-3-flash",
      "tools": { "write": false, "edit": false }
    }
  }
}
```

### Setu Configuration File (`setu.json`)

> **Why:** OpenCode's `opencode.json` has strict schema validation that rejects unknown keys. Other plugins (e.g., `antigravity.json`, `sisyphus.json`) use separate config files with custom schemas.

- [ ] **Create `setu.json` Config File**
  - **Location:** Project root, alongside `opencode.json`
  - **Schema:** Publish `setu.schema.json` for validation
  - **Content:**
    ```json
    {
      "$schema": "https://raw.githubusercontent.com/pkgprateek/setu-opencode/main/assets/setu.schema.json",
      "debug": true,
      "verbosity": "standard",
      "subagent_model": "google/antigravity-gemini-3-flash"
    }
    ```
  - **Loading:** Plugin reads `setu.json` at init, merges with defaults
  - **Priority:** `setu.json` > env vars > defaults
  - **Implementation:** `src/config/setu-config.ts`

- [ ] **Publish JSON Schema**
    - Create `assets/setu.schema.json` with all config options
    - Host on GitHub raw URL for IDE autocompletion

### Session Resilience

- [ ] **Session Recovery**
    - **Why:** Thinking block errors and empty messages crash sessions
    - **What:** Auto-recover by extracting last user message
    - **How:** Catch specific error types, replay last prompt

- [ ] **Preemptive Compaction**
    - **Why:** Hitting hard token limits causes session failure
    - **What:** Compact proactively at 85% context usage
    - **How:** Monitor context depth, trigger compaction before limit

### Environment Health

> **Why:** Agents get stuck in "Ghost Loops" trying to fix code when the environment is broken. This wastes tokens and frustrates users.

- [ ] **Create `setu-environment-doctor` skill** (`skills/`)
    - **Why:** When build/test fails, the error might be environment (missing deps, wrong node version) not code. Setu should diagnose the root cause before attempting code fixes.
    - **What:** Diagnostic skill that checks runtime, dependencies, and config health.
    - **How:**
      - Check runtime versions (`node -v`, `bun -v`) against `package.json` engines
      - Compare `package.json` dependencies vs lockfile (missing installs?)
      - Validate `tsconfig.json` paths and references
      - Check for missing `node_modules` directory
      - Check for common env issues: wrong CWD, missing env vars
    - **Trigger:** Called by `setu-verification` ONLY when verification fails with environment-specific errors
    - **Error Classification:**
      | Pattern | Classification |
      |---------|---------------|
      | `ENOENT`, `command not found`, exit 127 | Environment |
      | `MODULE_NOT_FOUND`, `Cannot find module` | Environment |
      | `node: command not found`, `bun: command not found` | Environment |
      | `SyntaxError`, `TypeError`, test failures | Code |
    - **Implementation:** `skills/setu-environment-doctor/SKILL.md`

- [ ] **Update `setu-verification` skill for env-doctor routing**
    - **Why:** Verification skill needs to classify errors and route to env-doctor when appropriate.
    - **What:** Add error classification logic and conditional skill loading.
    - **How:**
      - Parse error output for environment patterns (see table above)
      - If environment error detected: `use_skill("setu-environment-doctor")`
      - If code error: proceed with normal fix flow
    - **Implementation:** `skills/setu-verification/SKILL.md`

### Verification & Regression

> **Why:** "Done" should mean "verified working." Audit trails and regression tests prevent bugs from returning.

- [x] **Verification Log** (moved from v1.1 — already implemented)
    - **Why:** Audit trail of build/test/lint results
    - **What:** Append to `.setu/verification.log`
    - **Implementation:** `src/context/storage.ts` - `logVerification()`

- [ ] **Gold Test Generation (Opt-in)**
    - **Why:** When a bug is fixed, that scenario becomes a valuable regression test. Capturing it prevents the same bug from returning. ("Freeze state" for reproducible benchmarks.)
    - **What:** After successful verification, offer to generate a regression test.
    - **How:**
      1. After `setu_verify` returns success, add follow-up prompt:
         > "✅ Verification passed. Would you like me to create a regression test for this fix?"
      2. If user agrees:
         - Capture: files changed, error that was fixed, expected behavior
         - Generate test case appropriate to project's test framework
         - Save to appropriate test directory
      3. This creates "gold" benchmarks for future model evaluation
    - **Trigger:** User opt-in after `setu_verify` success
    - **Implementation:** `src/tools/setu-verify.ts` (add follow-up prompt)
    - **Reference:** Report 1 "Creating Gold Tests"

### Pre-Commit Checklist (Hail Mary Prevention)

> **Why:** Users sometimes ask agents to fix problems they don't understand ("Hail Mary"). This leads to blind fixes. A checklist forces reflection.

- [ ] **Pre-Commit Verification Prompt**
    - **Why:** Ensures both user and agent understand what's being committed.
    - **What:** Before committing, verify understanding.
    - **How:**
      - Before `git commit`, prompt with checklist:
        > "Before committing, let's verify:
        > 1. Do you understand what was changed? [Y/N]
        > 2. Has the change been verified (build/test)? [Y/N]
        > 3. Is this the right branch? [branch name]"
      - If any N, pause and discuss
    - **Trigger:** Before any commit (part of Git Discipline)
    - **Implementation:** `src/prompts/persona.ts` (guidance), `src/hooks/tool-execute.ts` (enforcement)

### TOON Evaluation

- [ ] **Token-Oriented Object Notation**
    - **Why:** More compact than JSON, human-readable
    - **What:** Evaluate TOON for context.json replacement
    - **How:** Test with current models, measure token savings
    - **Decision:** Adopt if models handle well, defer if issues

---

## v1.2: Extended Context

### First-Run Agent Registration

> **Why:** Currently Setu requires a restart on first run because OpenCode scans agent files before plugins initialize.

- [ ] **Solve first-run issue**
    - **Problem:** OpenCode scans `.opencode/agents/` during `Config.get()` BEFORE `Plugin.init()` runs. Our plugin creates `setu.md` during init, but it's already too late.
    - **Options:**
      1. CLI init command: `npx setu-opencode init` (user runs before first use)
      2. Postinstall script: npm postinstall creates the agent file
      3. OpenCode API: Request a plugin hook for programmatic agent registration
    - **Implementation:** TBD based on feasibility analysis

### Context Auto-Injection

- [ ] **Auto-Inject AGENTS.md**
    - **Why:** Project rules should be known immediately
    - **What:** Inject AGENTS.md into system prompt
    - **How:** Enhance system-transform with project context

- [ ] **Auto-Inject README Summary**
    - **Why:** Project overview helps understanding
    - **What:** Inject README.md summary (first 50 lines or ## sections)

- [ ] **AGENTS.md Walker**
    - **Why:** Directory-specific rules matter
    - **What:** Walk upward from file, collect ALL AGENTS.md
    - **How:** Inject in order: root → src → components

### Git Safety

- [ ] **Git Smart Branching**
    - **Why:** Accidental commits to main on complex tasks
    - **What:** Warn if on main + complex task
    - **How:** Check branch + task complexity in bootstrap

### Scratchpad Profile

> **Why:** "Vibe coding" and disposable scripts shouldn't be blocked by strict verification. Sometimes users want to write one-off scripts without friction.

- [ ] **Add `scratchpad` style**
    - **Why:** Report 2 identifies "Disposable Software" as a valid use case. Setu's strictness is counterproductive for throwaway scripts.
    - **What:** 5th operational style that bypasses Setu's enforcement.
    - **How:**
      - `phase0: "bypass"` — No blocking, allow all tools immediately
      - `verification: "none"` — No build/test enforcement
      - `context: "persist"` — Still save to `.setu/` for future reference
    - **Behavior:**
      - Disables Phase 0 blocking completely
      - Disables verification prompts
      - Allows rapid iteration without ceremony
      - Still tracks files read and patterns found (in case script graduates to "real" software)
    - **Trigger:** User says "style: scratchpad", "vibe", "quick and dirty", "throwaway"
    - **Implementation:** `src/prompts/profiles.ts` (add scratchpad style)

### Context Hygiene (The Ralph Loop)

> **Why:** "Context Rot" makes agents dumber over time. Long chat histories pollute next-token prediction. Users dumping lots of info, agents trying to fix things — overall quality degrades. The most reliable workflow is: Task → Verify → Wipe Memory → Next Task.

- [ ] **Context Loop Protocol**
    - **Why:** Manually restarting sessions to clear context is high friction. Setu should manage its own memory hygiene proactively.
    - **What:** Automate the "Wipe & Reload" cycle while preserving project understanding in `.setu/`.
    - **How:**
      1. **Stash Good Context:** Before any reset, save critical info to `.setu/context.json`:
         - Files read and their summaries
         - Decisions made during the task
         - Patterns discovered
         - AGENTS.md rules applied
      2. **Trigger Reset:** After task completion + verification success:
         - Prompt: "Task complete. Verification passed. Shall I clear my short-term memory and reload project context for the next task?"
      3. **Execute Reset:** If user agrees:
         - Update `.setu/context.md` with task summary (append)
         - Clear `.setu/active.json` (task complete)
         - Trigger session compaction (aggressive summary) or session reset
         - Reload `.setu/context.json` for fresh start
      4. **Fresh Start:** Agent has full project context but zero conversation pollution
    - **Implementation:**
      - `src/hooks/compaction.ts` (enhanced compaction logic)
      - `src/tools/setu-verify.ts` (post-verification prompt)
      - `src/context/storage.ts` (context stashing helpers)
    - **Reference:** Report 2 "Ralph Loop" concept

- [ ] **Context Size Warning**
    - **Why:** If context is becoming too large despite hygiene, warn user.
    - **What:** Detect context bloat; suggest manual restart if needed.
    - **How:**
      - Monitor `.setu/context.json` size
      - If exceeding threshold (e.g., 50KB), prompt: "Context is getting large. Would you like to clean the rot and refresh?"
    - **Implementation:** `src/context/storage.ts`

---

## v1.3: Disciplined Delegation

### Fine-Grained Model Routing

> **Why:** Different tasks need different models. Research tasks can use cheaper models, implementation needs powerful ones.

- [ ] **Per-Subagent Model Configuration**
    - **What:** Each subagent type can have a dedicated model
    - **Example:**
      - `setu-explorer` → cheap/fast model (Gemini Flash)
      - `setu-implementer` → powerful model (Claude Sonnet)
    - **Config:** Via `opencode.json` agent definitions

- [ ] **Orchestration Layer**
    - **Why:** Central routing is more reliable than prompt-based model selection
    - **What:** Setu main agent delegates to orchestrator that routes to appropriate subagent/model
    - **Benefit:** Consistent model selection without relying on agent self-awareness
    - **Implementation:** `src/orchestration/router.ts`

### Batch Mode (Auto-Ralph at Scale)

> **Why:** For large tasks (refactoring 50 files, migrations), running the Context Loop automatically is more efficient than manual resets.

- [ ] **Batch Mode Orchestration**
    - **Why:** Users shouldn't have to manually trigger reset after each subtask.
    - **What:** High-level plan → Break into N tasks → Execute each with auto-reset between.
    - **How:**
      1. User provides high-level plan (or Setu generates from request)
      2. Setu breaks into discrete tasks (like roadmap or detailed spec)
      3. Execute Task 1 → Verify → Stash context → Auto-reset
      4. Reload `.setu/` → Execute Task 2 → ...
      5. Repeat until all tasks complete
    - **Value:** Virtually infinite context window for large projects
    - **Flow:**
      ```
      User Plan → [Task 1] → Verify → Stash → Reset
                         ↓
                  [Task 2] → Verify → Stash → Reset
                         ↓
                  [Task N] → Verify → Complete
      ```
    - **Implementation:** `src/orchestration/batch.ts` (new module)

### Communication & Visual Feedback

> **Why:** Setu (as the "Governor" for agents) should feel active and alive. Visual feedback makes blocking and success states clear.

- [ ] **Colored Terminal Output**
    - **Why:** Red for blocks, green for success, yellow for warnings makes Setu's state immediately visible.
    - **What:** Use ANSI colors in CLI output for key events.
    - **How:**
      - 🔴 Red: Phase 0 blocks, verification failures
      - 🟢 Green: Verification passed, context confirmed
      - 🟡 Yellow: Warnings, suggestions, asking for guidance
      - 🔵 Blue: Information, progress updates
    - **Implementation:** `src/utils/terminal.ts` (new utility)

- [ ] **Strict Edit Blocking**
    - **Why:** Agents should NEVER edit a file they haven't read recently.
    - **What:** Block edits to files not read in last N tool calls (unless user explicitly requested).
    - **How:**
      - Track files read in session state
      - Before `edit` tool, check if file was read recently
      - If not: Block with red message: "Cannot edit [file] — you haven't read it. Read first, then edit."
    - **Implementation:** `src/hooks/tool-execute.ts`

### Setu Subagents

> **Why:** Offload work to keep main context clean, run tasks in parallel.

- [ ] **setu-researcher Subagent**
    - **Purpose:** Deep research, returns summary
    - **Permissions:** Read-only (no edit, no write)
    - **Invocation:** By Setu main agent via `task` tool
    - **Returns:** Concise findings, not raw data
    - **Cost Optimization (Arbitrage Strategy):**
      - **Why:** Using expensive models for simple research wastes money. Report 2 identifies this as a key opportunity.
      - **What:** Simulate "cheap model" tier by restricting subagent capabilities.
      - **How:**
        - Shorter system prompt (reduce input tokens)
        - Limited tool access (read-only subset)
        - Lower output token limits
        - Focused task scope (one question at a time)
      - **Effect:** Tiered work distribution without requiring model routing control
    - **Reference:** Report 2 "Cost Arbitrage"

- [ ] **setu-reviewer Subagent**
    - **Purpose:** Code review, returns findings
    - **Permissions:** Read-only
    - **Invocation:** By Setu main agent
    - **Returns:** Issues found, suggestions

- [ ] **Parallel Subagent Execution**
    - **What:** Run multiple subagents simultaneously
    - **How:** Multiple `task` calls in single message
    - **Pattern:** `delegate_task(background=true)` equivalent

### Skills vs Subagents Architecture

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| **Skills** | Behavior guidance | Always (loaded on-demand) |
| **Subagents** | Offload work | Large tasks, parallel research |
| **Main Agent** | Orchestration | User interaction, decisions |

---

## v1.4: Visual Verification

### Agent Browser Integration

- [ ] **CLI + Skill Detection**
    - **What:** Detect if `agent-browser` is installed
    - **How:** Check `which agent-browser` and skill file

- [ ] **Visual-Verify Subagent**
    - **Purpose:** Take screenshots, analyze accessibility
    - **Permissions:** Bash (agent-browser only), no edit
    - **Returns:** PASS/FAIL + findings

- [ ] **E2E Testing (Opt-in)**
    - **What:** Visual verification for web projects
    - **When:** User requests or collab mode

---

## v2.0: Advanced Features

### LSP Integration

- [ ] **LSP Symbol Search** — Precision reading via code structure
- [ ] **Smart Context Extraction** — Use LSP for function signatures
- [ ] **Stack-Aware Verification** — Optimized error extraction

### Cross-Session Memory

- [ ] **Project Pattern Memory** — Remember patterns across sessions
- [ ] **RLM Integration** — Recursive context decomposition

---

## Interoperability

### Priority: OpenCode Compatibility (HIGH)

Setu as a primary agent means:
- User can Tab away if Setu causes issues
- OpenCode features (Plan/Build) remain accessible
- No breaking changes to OpenCode behavior

### Priority: Other Plugin Compatibility (MEDIUM)

When other discipline plugins are detected:
- Setu enters minimal mode
- Defers context injection (other plugin handles it)
- Focuses on Phase 0 and verification only
- Avoids conflicting with other plugin directories

### Detection Strategy

```typescript
// At plugin init - detect other plugins
const hasOtherPlugin = detectOtherPlugins(projectDir);
if (hasOtherPlugin) {
  console.log('[Setu] Other plugin detected - minimal mode');
  // Disable: context injection, auto-inject
  // Enable: Phase 0, verification, attempt limits
}
```

---

## Proof & Metrics

### Token Savings
- [ ] Baseline: Raw OpenCode session token count
- [ ] With Setu: Same task, measure difference
- [ ] Publish: "X% fewer tokens on average"

### Error Prevention
- [ ] Test: Session where agent claims "done" with broken build
- [ ] Record: Setu blocking completion, forcing verification

### Parallel Execution
- [ ] Test: Context gathering with serial vs parallel reads
- [ ] Record: Time savings with parallel

### Character Evaluation (Anthropic Alignment)

> *"Rigid rules might negatively affect a model's character more generally."* — Anthropic Constitution

Setu should feel like a "thoughtful colleague, not a gatekeeper." Evaluate:

- [ ] **Helpfulness vs Blocking**: Does Phase 0 feel helpful or frustrating?
  - Metric: User satisfaction after Phase 0 interactions
  - Test: Compare "blocked" messages vs "guided" messages
  
- [ ] **Explanation Quality**: Do "why" explanations improve compliance?
  - Metric: Fewer repeated blocking attempts after enhanced messages
  - Test: A/B test old vs new block message format
  
- [ ] **Priority Adherence**: Does the priority order (Safe → Contextual → Efficient → Helpful) lead to better outcomes?
  - Metric: Successful task completion rate
  - Test: Edge cases where priorities conflict
  
- [ ] **User Agency**: Does Setu respect user expertise?
  - Metric: Expert mode usage and satisfaction
  - Test: Senior developers' perception of Setu

---

## Target Audience Impact

| Persona | Risk Without Fix | v1.0 Solution |
|---------|------------------|---------------|
| Junior Dev | Feels blocked | Clear messaging, smart questions |
| Senior Dev | Feels slow | Parallel execution support |
| Startup Founder | Wastes time | Fast context, efficient reads |
| AI Engineer | Bypassed enforcement | Permission-based blocking |
| Tech Lead | Inconsistent behavior | Setu as default mode |
| PM | Features don't work | Verification before done |

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
