# setu-opencode Roadmap

> OpenCode plugin implementation of [Setu](https://github.com/pkgprateek/setu) — the master craftsman persona.

## Vision

To transform the OpenCode agent from a "tool user" into a "thoughtful colleague" (Setu). We achieve this by enforcing a strict **Covenant of Craftsmanship** directly in the plugin code, ensuring that every interaction follows a disciplined protocol of planning, execution, and verification.

---

## The Path to v1.0 (The Implementation Plan)

We are executing a 3-movement strategy to elevate the plugin from "Alpha" to "Setu-Compliant".

### Movement 1: The Foundation (Enforcement & API)
*Goal: Make Setu "strict" and "aware" by wiring up the newly discovered APIs.*

- [ ] **Hard Enforcement of Phase 0**
    > **Intent**: Models often ignore soft "wait" instructions to be helpful. This wastes tokens.
    > **Spec**: Block all tools except `ls` until user replies to first message.
    > **Technical**: Use `event` hook to track `session.created` vs first user message.

- [ ] **Session Idle Enforcement**
    > **Intent**: Implement the "conscience" of Setu. Prevents the agent from lazily saying "Done!" without running tests.
    > **Spec**: Intervene before yield if `VerificationState` is incomplete or `AttemptTracker` > 2.
    > **Technical**: Use `session.idle` hook (recently discovered in API).

- [ ] **Todo List Access**
    > **Intent**: Setu cannot "Obsess Over Details" if it can't see the user's todo list.
    > **Spec**: Create `setu_todos_read` tool.
    > **Technical**: Wrap `client.session.todo({ id: sessionID })`.

- [ ] **Attempt Tracking Wiring**
    > **Intent**: Enforce the "2 attempts then ask" rule (Reality Distortion Field limit).
    > **Spec**: Count failures; intervene after 2.
    > **Technical**: Connect `AttemptTracker` to `tool.execute.after` (exit code check) and `session.idle`.

### Movement 2: The Craftsman's Tools (Skills & Context)
*Goal: Reduce the friction of doing things the "right" way.*

- [ ] **Skill Management Tools**
    > **Intent**: Manually writing files is error-prone. Capture knowledge ("Leave It Better") with one-shot, low-friction actions.
    > **Spec**: Create `setu_skill_create` and `setu_skill_update` tools.
    > **Technical**: Dedicated functions handling `.opencode/skills` paths and YAML frontmatter.

- [ ] **Context Injection**
    > **Intent**: "Phase 1: Discovery" currently costs tokens/time. Pre-injecting this makes Setu smart from the very first token.
    > **Spec**: Read `AGENTS.md` and `package.json` at startup; inject summary into system prompt.
    > **Technical**: Enhance `system-transform` hook using `ctx.project` and `ctx.directory`.

- [ ] **Skill Path Unification**
    > **Intent**: Align with OpenCode platform while maintaining Setu ecosystem compatibility.
    > **Spec**: Support `.opencode/skills` (primary) and `.claude/skills` (compat).

- [ ] **"Inception" via setu-bootstrap (The "Why" Enforcement)**
    > **Intent**: Ensure *users* of Setu also define their "Why", making Setu a craftsman for everyone, not just us.
    > **Spec**: Update `setu-rules-creation` skill to mandate an "Intent & Philosophy" section in `AGENTS.md`.
    > **Technical**: Modify `skills/setu-rules-creation/SKILL.md` template.

- [ ] **Git "Smart Branching" Strategy**
    > **Intent**: Prevent accidental commits to `main` while respecting user autonomy.
    > **Spec**: Warn if user on `main` + complex task + no override. If on feature branch, check semantic alignment (e.g., working on DB in feat/ui). Warn if task diverges significantly from branch intent.
    > **Technical**: Update `setu-bootstrap` skill to include this logic in `AGENTS.md`.

- [ ] **Session Compaction Strategy (Context Hygiene)**
    > **Intent**: Prevent context rot and degradation in long sessions.
    > **Spec**: Monitor context depth. Trigger `/compact` (via `session.compacting` hook or prompt) when heavy.
    > **Technical**: Investigate `client` API for compaction triggers or use `client.promptAsync`.

### Movement 3: The Lens (LSP & Verification)
*Goal: Give Setu "sight" into the code structure.*

- [ ] **LSP Symbol Search**
    > **Intent**: Grep is "blind". LSP allows Setu to find "Definition of X" instantly.
    > **Spec**: Implement `lsp_symbols` tool.
    > **Technical**: Wrap `client.find.symbols`.

- [ ] **Investigation: Smart Context Extraction (LSP/AST)**
    > **Intent**: Reading 100 lines for a signature is wasteful. Use structural tools to save tokens.
    > **Spec**: Investigate `ast_grep`, `lsp_hover` or `lsp_definition` (or combination of any) for precision reading.
    > **Technical**: Evaluate `ast-grep` integration or native LSP capabilities.

- [ ] **Stack-Aware Verification**
    > **Intent**: "Extract only what's needed." Sending 2000 lines of build logs is wasteful.
    > **Spec**: `setu_verify` detects stack (Node/Python/Go) and runs optimized commands (grep/tail).
    > **Technical**: Auto-detect based on `package.json` / `go.mod` etc.

---

## Future Horizons (v1.1+)

### v1.1: Extended LSP
- [ ] **Diagnostics**: Investigate consuming `lsp.client.diagnostics` events to catch errors before building.
- [ ] **Rename**: Investigate `lsp_rename` for safe refactoring.

### v2.0: Advanced Architecture
- [ ] **RLM Integration**: Recursive Context Decomposition for infinite sessions.
- [ ] **Internal Delegation**: Spawning sub-agents for specific tasks while maintaining the Setu persona.
- [ ] **Multi-Model Support**: Delegating specific reasoning steps to the best model for the job.

---

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License
Apache 2.0
