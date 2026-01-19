# setu-opencode Roadmap

> Agent discipline protocol for [OpenCode](https://opencode.ai) — think first, verify always.

## Vision

Transform OpenCode from "fast but unpredictable" to "fast AND correct." We achieve this by enforcing discipline protocols directly in the plugin, ensuring every interaction follows: **Ask → Plan → Execute → Verify**.

---

## The Path to v1.0

We're executing a 3-movement strategy to reach production-ready status.

### Movement 1: The Foundation (Enforcement & API)
*Goal: Make Setu strict and aware via OpenCode's hook APIs.*

- [ ] **Phase 0 Hard Enforcement**
    > **Problem**: Models ignore soft "wait" instructions to be helpful. Wastes tokens.
    > **Solution**: Block all tools except `ls` until user replies to first message.
    > **Technical**: Use `event` hook to track `session.created` vs first user message.
    > **Proof**: Screenshot showing blocked tool call before user responds.

- [ ] **Session Idle Enforcement**
    > **Problem**: Agent says "Done!" without running tests.
    > **Solution**: Intervene before yield if verification is incomplete.
    > **Technical**: Use `session.idle` hook.
    > **Proof**: GIF showing Setu blocking completion until tests pass.

- [ ] **Todo List Access**
    > **Problem**: Can't enforce task completion without seeing the list.
    > **Solution**: Create `setu_todos_read` tool.
    > **Technical**: Wrap `client.session.todo({ id: sessionID })`.

- [ ] **Attempt Tracking**
    > **Problem**: Agent retries same failing approach forever.
    > **Solution**: Count failures; intervene after 2.
    > **Technical**: Connect to `tool.execute.after` (exit code check) and `session.idle`.
    > **Proof**: Recording showing "I've tried X and Y..." after 2 failures.

- [ ] **Session Recovery** *(learned from OMOC)*
    > **Problem**: Session crashes on thinking block errors, empty messages.
    > **Solution**: Auto-recover by extracting last user message and continuing.
    > **Technical**: Catch specific error types, replay last prompt.

- [ ] **Preemptive Compaction** *(learned from OMOC)*
    > **Problem**: Hitting hard token limits causes session failure.
    > **Solution**: Compact proactively at 85% context usage.
    > **Technical**: Monitor context depth, trigger compaction before limit.

### Movement 2: The Craftsman's Tools (Skills & Context)
*Goal: Reduce friction for doing things the "right" way.*

- [ ] **Skill Management Tools**
    > **Problem**: Manually writing skill files is error-prone.
    > **Solution**: Create `setu_skill_create` and `setu_skill_update` tools.
    > **Technical**: Handle `.opencode/skills` paths and YAML frontmatter.

- [ ] **Context Injection**
    > **Problem**: Phase 1 discovery costs tokens/time.
    > **Solution**: Pre-inject `AGENTS.md` and `package.json` summary at startup.
    > **Technical**: Enhance `system-transform` hook using `ctx.project`.
    > **Proof**: Before/after token count comparison.

- [ ] **AGENTS.md Walker** *(learned from OMOC)*
    > **Problem**: Single AGENTS.md at root misses directory-specific context.
    > **Solution**: Walk upward from file to root, collect ALL AGENTS.md files.
    > **Technical**: Inject in order: root → src → components (most specific last).

- [ ] **Empty Response Detection** *(learned from OMOC)*
    > **Problem**: Task tool sometimes returns empty, agent waits forever.
    > **Solution**: Detect empty responses, warn user.
    > **Technical**: Check tool output in `tool.execute.after`.

- [ ] **Skill Path Unification**
    > **Problem**: Multiple conventions (`.opencode/skills`, `.claude/skills`).
    > **Solution**: Support both, `.opencode/skills` as primary.

- [ ] **Git Smart Branching**
    > **Problem**: Accidental commits to `main` on complex tasks.
    > **Solution**: Warn if on `main` + complex task + no override.
    > **Technical**: Check branch + task complexity in bootstrap skill.
    > **Proof**: Screenshot of warning when on main.

- [ ] **Session Compaction Trigger**
    > **Problem**: Context rot in long sessions.
    > **Solution**: Monitor context depth; trigger `/compact` when heavy.
    > **Technical**: Use `session.compacting` hook or `client.promptAsync`.

### Movement 3: The Lens (LSP & Verification)
*Goal: Give Setu structural awareness of code.*

- [ ] **LSP Symbol Search**
    > **Problem**: Grep is blind to code structure.
    > **Solution**: Implement `lsp_symbols` tool.
    > **Technical**: Wrap `client.find.symbols`.
    > **Proof**: Comparison of grep vs symbol search accuracy.

- [ ] **Smart Context Extraction**
    > **Problem**: Reading 100 lines for a signature wastes tokens.
    > **Solution**: Use LSP/AST for precision reading.
    > **Technical**: Evaluate `ast-grep` or native LSP hover/definition.

- [ ] **AST-grep Integration** *(learned from OMOC)*
    > **Problem**: Grep finds text, not code patterns.
    > **Solution**: Add AST-aware search and replace (25 languages).
    > **Technical**: Integrate `ast-grep` CLI or library.

- [ ] **Stack-Aware Verification**
    > **Problem**: Sending 2000 lines of build logs is wasteful.
    > **Solution**: Auto-detect stack (Node/Python/Go); run optimized commands.
    > **Technical**: Detect via `package.json` / `go.mod` / etc.
    > **Proof**: Before/after log extraction size.

---

## Proof & Metrics (For Documentation)

These items generate the screenshots, GIFs, and metrics for README and marketing:

### Token Savings
- [ ] **Baseline measurement**: Raw OpenCode session token count for standard task
- [ ] **Setu measurement**: Same task with Setu, measure token difference
- [ ] **Publish**: "X% fewer tokens on average"

### Error Prevention
- [ ] **Test case**: Session where agent would normally claim "done" with broken build
- [ ] **Record**: Setu blocking completion, forcing verification
- [ ] **Count**: Number of prevented "false done" claims

### Wrong Assumption Prevention
- [ ] **Test case**: Ambiguous task where context matters
- [ ] **Record**: Phase 0 asking for context vs raw agent diving in
- [ ] **Document**: Work saved by clarification

### Infinite Loop Prevention
- [ ] **Test case**: Task that fails repeatedly (e.g., wrong approach)
- [ ] **Record**: Setu stopping at 2 attempts, asking for guidance
- [ ] **Compare**: vs agent spinning indefinitely

---

## Future Horizons

### v1.1: Extended LSP
- [ ] **Diagnostics**: Consume `lsp.client.diagnostics` events for pre-build error detection
- [ ] **Rename**: Safe refactoring via `lsp_rename`

### v2.0: Multi-Agent Delegation
- [ ] **Disciplined delegation**: Setu spawns sub-agents but enforces verification on results
- [ ] **Model routing**: Delegate specific tasks to best model for the job
- [ ] **Transparent mode**: Show delegation in UI

### v1.2: Claude Code Compatibility *(learned from OMOC)*
- [ ] **Hook compatibility**: Load and execute Claude Code's settings.json hooks
- [ ] **Skill compatibility**: Load skills from `.claude/skills/`
- [ ] **Command compatibility**: Load commands from `.claude/commands/`

### v2.1: Advanced Context
- [ ] **RLM Integration**: Recursive context decomposition for infinite sessions
- [ ] **Cross-session memory**: Remember project patterns across sessions

---

## Interoperability

Setu is a discipline layer, not a replacement for tools.

### Tested With
- [ ] **oh-my-opencode**: Document Setu + OMOC workflow
- [ ] **context7 MCP**: Official docs integration
- [ ] **grep.app MCP**: GitHub code search

### Detection (Future)
- [ ] Auto-detect installed plugins
- [ ] Adapt behavior based on available tools

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

Priority areas:
- Testing enforcement on diverse projects
- Additional verification patterns
- Documentation with real examples
- Performance optimization

---

## License

Apache 2.0 — See [LICENSE](./LICENSE)
