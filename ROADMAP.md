# setu-opencode Roadmap

> Pre-emptive discipline protocol for [OpenCode](https://opencode.ai) — think first, verify always.

## Vision

**Why Setu exists:** AI coding agents are reactive — they run first, fix later. This wastes tokens, produces broken code, and frustrates developers.

**What Setu does:** Enforce discipline *before* execution. Block wrong actions, force reflection, verify results. Transform OpenCode from "fast but unpredictable" to "fast AND correct."

**The core insight:** Setu is pre-emptive, not reactive.

**The experience:** Setu should feel like a thoughtful colleague, not a gatekeeper.

---

## Current State (v0.1 - Alpha)

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
- [x] `setu_mode` tool — Switch operational profiles
- [x] `setu_verify` tool — Run verification protocol
- [x] `setu_context` tool — Confirm context, persist to `.setu/`
- [x] `setu_feedback` tool — Record user feedback

**Setu as Primary Agent (Movement 1):**
- [x] Agent registration (`.opencode/agents/setu.md` created on init)
- [x] Default on startup (`default_agent: "setu"` in config)
- [x] Mode-aware enforcement (Setu/Build/Plan awareness)

**Context Persistence (Movement 2):**
- [x] `.setu/` directory structure
- [x] `context.json` — Machine-parseable context
- [x] `context.md` — Human-readable context
- [x] `feedback.md` — User feedback mechanism
- [x] Context collector (tracks reads/searches during Phase 0)
- [x] Context injection to subagent prompts
- [x] Context loading on session start

**Anthropic Alignment:**
- [x] Enhanced "why" reasoning in Phase 0 block messages
- [x] Priority hierarchy (Safe → Contextual → Efficient → Helpful)
- [x] Transparency/feedback mechanism

**Skills:**
- [x] 7 bundled skills (bootstrap, verification, rules-creation, code-quality, refine-code, commit-helper, pr-review)

### Not Yet Implemented

**Active Task Persistence (Movement 3 — Critical for Safety):**
- [ ] `.setu/active.json` — Track current task, mode, constraints
- [ ] `session.compacting` hook — Inject active task into compaction summary
- [ ] Pre-action alignment check — Verify action matches active task

**Future Enhancements:**
- [ ] `session.idle` hook — Verification enforcement (waiting for API)
- [ ] Subagent tool interception — Defense in depth for child sessions
- [ ] Verification logging to `.setu/verification.log`

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
|------|---------|----------|
| **Mode** (OpenCode) | IDE-level agent selection via Tab | Plan, Build, Setu |
| **Operational Profile** (Setu) | Verification/behavior level within Setu | ultrathink, quick, expert, collab |

---

## v1.0 Release Checklist

Before publishing:
- [x] Setu as primary agent (appears in Tab cycle, default on startup)
- [x] Context persistence (`.setu/context.md`, `.setu/context.json`)
- [x] Parallel execution guidance in persona
- [x] Mode-aware enforcement (don't conflict with Plan mode)
- [ ] Build and test plugin end-to-end
- [ ] Publish to npm as `setu-opencode`
- [ ] Test all 4 operational profiles
- [ ] Documentation (usage examples, configuration options)

### Anthropic Alignment Enhancements (Completed)
- [x] Enhanced "why" reasoning in Phase 0 block messages
- [x] Priority hierarchy (Safe → Contextual → Efficient → Helpful)
- [x] Character evaluation guidance in metrics
- [x] Transparency/feedback mechanism (`.setu/feedback.md`)

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
      ├── context.md     # Human-readable understanding
      ├── context.json   # Machine-parseable for injection
      ├── feedback.md    # User feedback on Setu behavior
      └── verification.log  # Build/test/lint results (append-only)
      ```
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
    - **What:** Write both `.setu/context.md` and `.setu/context.json` when confirmed
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

- [x] **Context Continuity Across Sessions**
    - **Why:** New session shouldn't start from scratch
    - **What:** Load existing context on session start
    - **How:** In `event` hook for `session.created`, load `.setu/context.json`
    - **Implementation:** `src/hooks/event.ts`

- [ ] **Active Task Persistence**
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
        "constraints": ["READ-ONLY"],
        "references": ["https://anthropic.com/news/claude-new-constitution"],
        "startedAt": "2025-01-24T...",
        "status": "in_progress"
      }
      ```

- [ ] **Compaction Recovery Protocol**
    - **Why:** OpenCode's compaction summarizes conversation, potentially losing critical constraints and task details. This caused a session to "go rogue" during setu-opencode development.
    - **What:** Use `experimental.session.compacting` hook to inject active task into compaction summary
    - **How:** Plugin hook reads `.setu/active.json` and injects content into compaction prompt
    - **Implementation:** `src/hooks/compaction.ts`
    - **Reference:** https://opencode.ai/docs/plugins#compaction-hooks
    - **Code Pattern:**
      ```typescript
      "experimental.session.compacting": async (input, output) => {
        const activeTask = loadActiveTask(projectDir);
        if (activeTask) {
          output.context.push(`## Active Task (CRITICAL)
Task: ${activeTask.task}
Mode: ${activeTask.mode}
Constraints: ${activeTask.constraints.join(', ')}
IMPORTANT: Resume this task. Do NOT start unrelated work.`);
        }
      }
      ```

### Movement 3: Parallel Execution & Efficiency
*Goal: Fast and efficient, not slow and wasteful.*

#### Parallel Execution Support

> **Why:** Senior devs and startup founders need speed. Serial reads waste time.

- [ ] **Persona Enhancement**
    - **Why:** Models need explicit guidance to use parallel tools
    - **What:** Add parallel execution section to persona
    - **Addition:**
      ```markdown
      ## Efficiency: Parallel Execution

      When gathering context or running independent operations:
      - Use PARALLEL tool calls (multiple tools in single message)
      - DO: Read multiple files at once
      - DO: Run independent searches in parallel
      - DON'T: Serial reads one file at a time (wastes time)
      ```

- [ ] **System Directive Prefix**
    - **Why:** Clear separation of Setu injections from user content
    - **What:** Prefix all Setu prompts with `[SETU:]`
    - **How:** Wrap all persona/context injections

#### Pre-emptive Enforcement (Phase 0)

> **Why:** Block wrong actions before they happen.

- [x] **Phase 0 Hard Enforcement**
    - **Why:** Models ignore soft "wait" instructions
    - **What:** Block SIDE-EFFECT tools until context confirmed
    - **Allow:** `read`, `glob`, `grep`, `webfetch`, `todoread`
    - **Allow bash:** `ls`, `cat`, `head`, `tail`, `grep`, `find`, `pwd`, `echo`, `which`, `env`, `git status`, `git log`, `git diff`, `git branch`, `git show`
    - **Block:** `write`, `edit`, `todowrite`, `bash` (other), `git` (write)
    - **Unlock:** Agent calls `setu_context` tool

- [ ] **Pre-Action Alignment Check**
    - **Why:** Prevent executing actions that don't align with active task (especially after context loss/compaction)
    - **What:** Before side-effect tools, verify action matches `.setu/active.json` task
    - **How:** In `tool.execute.before`:
      - If active.json exists and action seems unrelated to task, ask user
      - If active.json has constraints (e.g., "READ-ONLY"), block side-effect tools
      - If no active.json exists for a significant operation, prompt to create one
    - **Implementation:** `src/hooks/tool-execute.ts`

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

## v1.1: Polish & Recovery

### Session Resilience

- [ ] **Session Recovery**
    - **Why:** Thinking block errors and empty messages crash sessions
    - **What:** Auto-recover by extracting last user message
    - **How:** Catch specific error types, replay last prompt

- [ ] **Preemptive Compaction**
    - **Why:** Hitting hard token limits causes session failure
    - **What:** Compact proactively at 85% context usage
    - **How:** Monitor context depth, trigger compaction before limit

### Verification Logging

- [ ] **Verification Log**
    - **Why:** Audit trail of build/test/lint results
    - **What:** Append to `.setu/verification.log`
    - **Format:** Markdown with timestamps

### TOON Evaluation

- [ ] **Token-Oriented Object Notation**
    - **Why:** More compact than JSON, human-readable
    - **What:** Evaluate TOON for context.json replacement
    - **How:** Test with current models, measure token savings
    - **Decision:** Adopt if models handle well, defer if issues

---

## v1.2: Extended Context

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

---

## v2.0: Disciplined Delegation

### Setu Subagents

> **Why:** Offload work to keep main context clean, run tasks in parallel.

- [ ] **setu-researcher Subagent**
    - **Purpose:** Deep research, returns summary
    - **Permissions:** Read-only (no edit, no write)
    - **Invocation:** By Setu main agent via `task` tool
    - **Returns:** Concise findings, not raw data

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

## v2.1: Visual Verification

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

## v3.0: Advanced Features

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
