# setu-opencode Roadmap

> Pre-emptive discipline protocol for [OpenCode](https://opencode.ai) — think first, verify always.

## Vision

**Why Setu exists:** AI coding agents are reactive — they run first, fix later. This wastes tokens, produces broken code, and frustrates developers.

**What Setu does:** Enforce discipline *before* execution. Block wrong actions, force reflection, verify results. Transform OpenCode from "fast but unpredictable" to "fast AND correct."

**The core insight:** Setu is proactive. Other tools are reactive.

---

## Design Principles

These guide every feature decision:

| Principle | Why It Matters | Implementation |
|-----------|----------------|----------------|
| **Pre-emptive, not reactive** | Fixing mistakes costs more than preventing them | Phase 0 blocks tools until context confirmed |
| **Zero-config by default** | Friction kills adoption | Works out of box, config is optional override |
| **Discipline layer, not replacement** | Users have existing tools they love | Detect OMOC/others, adapt, enhance |
| **Intent-driven** | Models perform better when they know "why" | Every feature documents its purpose |

---

## The Path to v1.0

Three movements to production-ready.

### Movement 1: The Foundation (Enforcement)
*Goal: Make Setu strict via pre-emptive blocking.*

#### Phase 0: Pre-emptive Context Gate

> **Intent:** The #1 cause of wasted work is wrong assumptions. Block execution until context is confirmed.

- [ ] **Phase 0 Hard Enforcement**
    - **Why:** Models ignore soft "wait" instructions to be helpful. They dive in anyway.
    - **What:** Block ALL tools (except `ls`) until user responds to context question.
    - **How:** Use `tool.execute.before` hook to intercept and block.
    - **Proof:** Screenshot showing blocked tool call before user responds.
    - **Difference from OMOC:** OMOC lets agent run, then fixes. Setu blocks first.

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

#### Attempt Limits

> **Intent:** When the approach is wrong, retrying wastes tokens. Ask for help instead.

- [ ] **Attempt Tracking**
    - **Why:** Agents retry same failing approach forever (wrong import, it was a config issue).
    - **What:** After 2 failures, stop and ask for guidance.
    - **How:** Track in `tool.execute.after` (check exit code), enforce in `session.idle`.
    - **Proof:** Recording showing "I've tried X and Y..." after 2 failures.
    - **Difference from OMOC:** OMOC's "bouldering" keeps going. Setu stops and reflects.

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

- [ ] **OMOC Detection**
    - **Why:** If OMOC is present, Setu should enhance, not conflict.
    - **What:** Detect OMOC installation; adapt behavior accordingly.
    - **How:** Check for OMOC hooks/tools in plugin registry; load after OMOC.
    - **Behavior when OMOC present:**
      - Skip duplicate hooks (let OMOC handle todo enforcement)
      - Use OMOC's LSP tools if available
      - Wrap OMOC's agents with Phase 0 and verification

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

### v1.1: Extended LSP
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
- [ ] **oh-my-opencode**: Full Setu + OMOC workflow documented
- [ ] **context7 MCP**: Official docs integration
- [ ] **grep.app MCP**: GitHub code search

### Detection Strategy
- [ ] Auto-detect installed plugins at startup
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
