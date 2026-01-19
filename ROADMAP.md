# setu-opencode Roadmap

> Pre-emptive discipline protocol for [OpenCode](https://opencode.ai) — think first, verify always.

## Vision

**Why Setu exists:** AI coding agents are reactive — they run first, fix later. This wastes tokens, produces broken code, and frustrates developers.

**What Setu does:** Enforce discipline *before* execution. Block wrong actions, force reflection, verify results. Transform OpenCode from "fast but unpredictable" to "fast AND correct."

**The core insight:** Setu is proactive. Other tools are reactive.

---

## Current State (v0.1 - Alpha)

### Implemented
- [x] Package structure (`src/`, `skills/`)
- [x] TypeScript configuration
- [x] Basic plugin entry point
- [x] `system-transform` hook — Injects lean persona (~500 tokens)
- [x] `chat.message` hook — Mode detection from keywords
- [x] `tool.execute.after` hook — Verification tracking
- [x] `event` hook — Session lifecycle handling
- [x] `setu_mode` tool — Switch operating modes
- [x] `setu_verify` tool — Run verification protocol
- [x] 7 bundled skills (bootstrap, verification, rules-creation, code-quality, refine-code, commit-helper, pr-review)

### Not Yet Implemented
- [ ] `tool.execute.before` hook — Phase 0 blocking (**API confirmed available**)
- [ ] `session.idle` hook — Verification enforcement (waiting for API)
- [ ] LSP tools — API investigation needed

---

## Design Principles

These guide every feature decision:

| Principle | Why It Matters | Implementation |
|-----------|----------------|----------------|
| **Pre-emptive, not reactive** | Fixing mistakes costs more than preventing them | Phase 0 blocks tools until context confirmed |
| **Zero-config by default** | Friction kills adoption | Works out of box, config is optional override |
| **Discipline layer, not replacement** | Users have existing tools they love | Detect other plugins, adapt, enhance |
| **Intent-driven** | Models perform better when they know "why" | Every feature documents its purpose |

---

## v1.0 Release Checklist

Before publishing:
- [ ] Build and test plugin end-to-end
- [ ] Publish to npm as `setu-opencode`
- [ ] Verify installation process works
- [ ] Test all 4 operating modes
- [ ] Mode persistence (`mode: quick` persists until changed)
- [ ] Temporary mode ("quick fix this" applies to single task only)
- [ ] Mode indicator (every response starts with `[Mode: X]`)
- [ ] **Verify subagent tool interception** (Phase 0 blocks tools in child sessions)
- [ ] Documentation (usage examples, configuration options)

---

## The Path to v1.0

Three movements to production-ready.

### Movement 1: The Foundation (Enforcement)
*Goal: Make Setu strict via pre-emptive blocking.*

#### Phase 0: Pre-emptive Context Gate

> **Intent:** The #1 cause of wasted work is wrong assumptions. Block execution until context is confirmed.

- [ ] **Phase 0 Hard Enforcement**
    - **Why:** Models ignore soft "wait" instructions to be helpful. They dive in anyway.
    - **What:** Block SIDE-EFFECT tools until user responds to context question. Allow read-only tools so agent can form smart questions.
    - **How:** Use `tool.execute.before` hook to intercept and block.
    - **Allow:** `read`, `glob`, `grep` (read-only — "look but don't touch")
    - **Allow:** `bash` when command starts with: `ls`, `cat`, `head`, `tail`, `grep`, `find`, `pwd`, `echo`, `which`, `env`
    - **Block:** `write`, `edit`, `bash` (other commands), `git` (write operations)
    - **Proof:** Screenshot showing blocked write attempt before user responds.

- [ ] **Subagent Tool Interception (Defense in Depth)**
    - **Why:** Subagents create child sessions. It's undocumented whether `tool.execute.before` hooks fire for child session tool calls. If not, Phase 0 has a backdoor.
    - **Risk:** User says "@general edit that file" → subagent runs in child session → hook doesn't fire → Phase 0 bypassed.
    - **What:** Implement both hook-based blocking AND tool wrapper pattern for complete coverage.
    - **How:**
      1. Primary: `tool.execute.before` hook (elegant, fires for most cases)
      2. Fallback: Wrap tool definitions at plugin startup:
         ```javascript
         const originalExec = tool.execute;
         tool.execute = async (args) => {
             if (isPhase0() && isSideEffectTool(tool.name, args)) {
                 throw new Error("Phase 0: Confirm context before modifying files.");
             }
             return originalExec(args);
         };
         ```
    - **Verification:** Test explicitly with subagent invocation to confirm coverage.
    - **Proof:** Recording showing Phase 0 blocking a subagent's write attempt.

#### Verification Before "Done"

> **Intent:** "Done" should mean "verified working," not "I think it's done."

- [ ] **Session Idle Enforcement**
    - **Why:** Agents claim "Done!" without running tests. Broken code reaches production.
    - **What:** Intercept before yield; force verification if incomplete.
    - **How:** Use `session.idle` hook.
    - **Proof:** GIF showing Setu blocking completion until tests pass.

- [ ] **Todo List Access**
    - **Why:** Can't enforce task completion without seeing the list.
    - **What:** Create `setu_todos_read` tool.
    - **How:** Wrap `client.session.todo({ id: sessionID })`.

- [ ] **Session Cost Audit**
    - **Why:** Cost is a metric of completion. "Did I finish? Yes. How much did it cost?"
    - **What:** Log token usage and estimated cost at session end.
    - **How:** Track tokens in `tool.execute.after`, output summary in `session.idle`.
    - **Output:** "Session complete. Tokens used: 4,500. Estimated cost: $0.04."

#### Attempt Limits

> **Intent:** When the approach is wrong, retrying wastes tokens. Ask for help instead.

- [ ] **Attempt Tracking**
    - **Why:** Agents retry same failing approach forever (wrong import, it was a config issue).
    - **What:** After 2 failures, stop and ask for guidance.
    - **How:** Track in `tool.execute.after` (check exit code), enforce in `session.idle`.
    - **Proof:** Recording showing "I've tried X and Y..." after 2 failures.

#### Session Resilience

> **Intent:** Sessions shouldn't crash. Recover gracefully.

- [ ] **Session Recovery**
    - **Why:** Thinking block errors and empty messages crash sessions.
    - **What:** Auto-recover by extracting last user message and continuing.
    - **How:** Catch specific error types, replay last prompt.

- [ ] **Preemptive Compaction**
    - **Why:** Hitting hard token limits causes session failure.
    - **What:** Compact proactively at 85% context usage.
    - **How:** Monitor context depth, trigger compaction before limit.

---

### Movement 2: The Context Layer
*Goal: Smart context handling that adapts to environment.*

#### Zero-Config Design

> **Intent:** Plugin should work instantly. Configuration is optional override.

- [ ] **Zero-Config Defaults**
    - **Why:** JSON configuration is friction. Most users want sensible defaults.
    - **What:** All features work out of box. Config file only for overrides.
    - **How:** Hardcode sensible defaults; load config only if present.

#### Adaptive Context Injection

> **Intent:** Inject right context, detect environment, play nice with others.

- [ ] **Plugin Detection**
    - **Why:** If other plugins are present, Setu should enhance, not conflict.
    - **What:** Detect other plugin installations; adapt behavior accordingly.
    - **How:** Check for known hooks/tools in plugin registry; load after them.
    - **Behavior when other plugins present:**
      - Skip duplicate hooks (avoid conflicts)
      - Use their LSP tools if available
      - Wrap their agents with Phase 0 and verification

- [ ] **Context Injection**
    - **Why:** Phase 1 discovery costs tokens/time.
    - **What:** Pre-inject `AGENTS.md` and `package.json` summary at startup.
    - **How:** Enhance `system-transform` hook using `ctx.project`.
    - **Proof:** Before/after token count comparison.

- [ ] **AGENTS.md Walker**
    - **Why:** Single AGENTS.md at root misses directory-specific context.
    - **What:** Walk upward from file to root, collect ALL AGENTS.md files.
    - **How:** Inject in order: root → src → components (most specific last).

#### Skill & Tool Management

> **Intent:** Make doing the right thing easier than the wrong thing.

- [ ] **Skill Management Tools**
    - **Why:** Manually writing skill files is error-prone.
    - **What:** Create `setu_skill_create` and `setu_skill_update` tools.
    - **How:** Handle `.opencode/skills` paths and YAML frontmatter.

- [ ] **Skill Path Unification**
    - **Why:** Multiple conventions (`.opencode/skills`, `.claude/skills`) confuse users.
    - **What:** Support both; `.opencode/skills` as primary.

- [ ] **Empty Response Detection**
    - **Why:** Task tool sometimes returns empty; agent waits forever.
    - **What:** Detect empty responses, warn user.
    - **How:** Check tool output in `tool.execute.after`.

#### Git Safety

> **Intent:** Prevent catastrophic mistakes on main branch.

- [ ] **Git Smart Branching**
    - **Why:** Accidental commits to `main` on complex tasks cause problems.
    - **What:** Warn if on `main` + complex task + no override.
    - **How:** Check branch + task complexity in bootstrap skill.
    - **Proof:** Screenshot of warning when on main.

---

### Movement 3: The Lens (Structural Awareness)
*Goal: Give Setu understanding of code structure, not just text.*

> **Intent:** Grep finds text. LSP/AST finds code patterns. Precision saves tokens.

- [ ] **LSP Symbol Search**
    - **Why:** Grep is blind to code structure.
    - **What:** Implement `lsp_symbols` tool.
    - **How:** Wrap `client.find.symbols`.
    - **Proof:** Comparison of grep vs symbol search accuracy.

- [ ] **Smart Context Extraction**
    - **Why:** Reading 100 lines for a function signature wastes tokens.
    - **What:** Use LSP/AST for precision reading.
    - **How:** Evaluate `ast-grep` or native LSP hover/definition.

- [ ] **AST-grep Integration**
    - **Why:** Grep finds text, not code patterns.
    - **What:** Add AST-aware search and replace (25 languages).
    - **How:** Integrate `ast-grep` CLI or library.

- [ ] **Stack-Aware Verification**
    - **Why:** Sending 2000 lines of build logs wastes context.
    - **What:** Auto-detect stack (Node/Python/Go); run optimized error extraction.
    - **How:** Detect via `package.json` / `go.mod` / etc.
    - **Proof:** Before/after log extraction size.

---

## Proof & Metrics

> **Intent:** Show, don't tell. Screenshots and metrics prove value.

### Token Savings
- [ ] Baseline: Raw OpenCode session token count for standard task
- [ ] With Setu: Same task, measure token difference
- [ ] Publish: "X% fewer tokens on average"

### Error Prevention
- [ ] Test: Session where agent claims "done" with broken build
- [ ] Record: Setu blocking completion, forcing verification
- [ ] Count: Number of prevented "false done" claims

### Wrong Assumption Prevention
- [ ] Test: Ambiguous task where context matters
- [ ] Record: Phase 0 asking for context vs raw agent diving in
- [ ] Document: Work saved by clarification

### Infinite Loop Prevention
- [ ] Test: Task that fails repeatedly (wrong approach)
- [ ] Record: Setu stopping at 2 attempts, asking for guidance
- [ ] Compare: vs agent spinning indefinitely

---

## Future Horizons

### v1.1: Visual Verification & Agent Browser Integration

> **Intent:** AI agents can finally *see* what they build. Visual verification closes the loop.

#### Agent Browser Detection

- [ ] **CLI + Skill Detection**
    - **Why:** Smart behavior without bundling. If user has agent-browser, Setu adapts.
    - **What:** Detect if `agent-browser` CLI exists AND skill file is present.
    - **How:** 
      1. Check CLI: `which agent-browser` or check in `node_modules/.bin/`
      2. Check skill: Look for `node_modules/agent-browser/skills/agent-browser/SKILL.md`
    - **If detected:** Inject prompt: "Visual verification available via agent-browser."
    - **If not detected:** Normal Setu behavior, no mention.

#### Visual Verification in Default Mode

- [ ] **Conditional Visual Check**
    - **Why:** "Please verify the UI" is a cop-out. Setu should actually look.
    - **What:** When agent-browser detected + web project, include visual verification.
    - **How:** 
      1. Detect web project (package.json has `dev` script, uses React/Vue/Next/etc.)
      2. In `setu-verification` skill, add visual check step if conditions met
      3. Use `agent-browser snapshot -i` for accessibility tree
      4. Use `agent-browser screenshot` for visual proof
    - **Proof:** Screenshot stored as verification artifact.

#### Visual-Verify Subagent

- [ ] **Token-Efficient Visual Checks**
    - **Why:** Screenshots are 5-10k tokens. Don't pollute main session context.
    - **What:** Define `visual-verify` subagent that handles all visual verification.
    - **How:** Create subagent config (via `.opencode/agents/visual-verify.md`):
      ```yaml
      ---
      description: Visual verification using agent-browser. Takes screenshots and accessibility snapshots.
      mode: subagent
      hidden: true  # Only invoked programmatically
      tools:
        bash: true  # For agent-browser CLI
        write: false
        edit: false
      permission:
        bash:
          "agent-browser *": allow
          "*": deny
      ---
      
      You are a visual verification agent. Use agent-browser to:
      1. Take accessibility snapshot: `agent-browser snapshot -i`
      2. Take screenshot if needed: `agent-browser screenshot`
      3. Analyze and report: PASS/FAIL + specific findings
      
      Return a concise summary (under 100 tokens) to the main agent.
      ```
    - **Result:** Main agent gets "PASS: Login button found, form accessible" instead of raw screenshot data.

#### E2E Testing (Opt-in)

- [ ] **Web Project Smoke Tests**
    - **Why:** For web projects, visual verification can include basic E2E checks.
    - **What:** Ask user if they want E2E verification after code changes.
    - **When:** Collab mode OR explicit user request.
    - **Flow:**
      1. Detect dev server running (port 3000, 5173, 8080, etc.)
      2. Ask: "Would you like me to verify the UI after changes?"
      3. If yes, spawn visual-verify subagent
    - **Not automatic:** E2E is opt-in, not forced.

### v1.1: Extended LSP (Lower Priority)

- [ ] Diagnostics: Pre-build error detection
- [ ] Rename: Safe refactoring via `lsp_rename`

### v1.2: Claude Code Compatibility

- [ ] Hook compatibility: Load Claude Code's settings.json hooks
- [ ] Skill compatibility: Load skills from `.claude/skills/`
- [ ] Command compatibility: Load commands from `.claude/commands/`

### v2.0: Disciplined Delegation

- [ ] Multi-agent: Setu spawns sub-agents but enforces verification on results
- [ ] Model routing: Delegate to best model for task type
- [ ] Transparent mode: Show delegation in UI

### v2.1: Infinite Context

- [ ] RLM Integration: Recursive context decomposition
- [ ] Cross-session memory: Remember project patterns

---

## Interoperability

> **Intent:** Be a good citizen. Enhance, don't replace.

### Tested With
- [ ] **Other OpenCode plugins**: Document coexistence workflow
- [ ] **agent-browser**: Visual verification and E2E testing
- [ ] **context7 MCP**: Official docs integration (preferred for docs)
- [ ] **grep.app MCP**: GitHub code search

### Detection Strategy
- [ ] Auto-detect installed plugins at startup
- [ ] Auto-detect agent-browser CLI + skill file
- [ ] Adapt hooks based on what's already registered
- [ ] Load after detected plugins (don't interfere)

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
