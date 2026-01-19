# OMOC Analysis: Learnings for Setu

> Internal document analyzing oh-my-opencode's implementation to inform Setu development.
> Focus: What can we learn? What should we do differently?

---

## Executive Summary

OMOC is feature-rich and viral (1.5 months to significant adoption). Their approach:
1. **Throw compute at problems** — Multi-model, parallel agents
2. **Rich tooling** — LSP, AST-grep, session management, MCPs
3. **Claude Code compatibility** — Easy migration for existing users
4. **Aggressive hooks** — 25+ hooks for various behaviors

**Setu's opportunity**: Discipline over features. OMOC gives you 100 tools. Setu makes sure you use any tools correctly.

---

## Hook Analysis: What OMOC Does

### Hooks Setu Should Implement (High Priority)

| OMOC Hook | What It Does | Setu Equivalent | Priority |
|-----------|--------------|-----------------|----------|
| `todo-continuation-enforcer` | Forces agent to finish all TODOs | **Already in roadmap** | P0 |
| `context-window-monitor` | At 70%+, reminds agent there's headroom | Session compaction trigger | P1 |
| `session-recovery` | Auto-recovers from errors | **Should add** | P1 |
| `tool-output-truncator` | Truncates verbose tool output | **Already in verification** | P0 |
| `grep-output-truncator` | Caps grep at 50k tokens | Part of smart extraction | P1 |
| `preemptive-compaction` | Compacts at 85% context | **Add to roadmap** | P1 |
| `empty-task-response-detector` | Catches empty agent responses | **Should add** | P2 |

### Hooks Setu Should Skip (Philosophy Mismatch)

| OMOC Hook | What It Does | Why Skip |
|-----------|--------------|----------|
| `keyword-detector` | Detects "ultrawork" etc. | Setu uses explicit modes, not magic words |
| `agent-usage-reminder` | Reminds to use agents | Setu is single-agent focused |
| `think-mode` | Auto-switches thinking | Setu's modes are explicit, not auto |
| `ralph-loop` | Runs until done | Setu has attempt limits by design |

### Hooks Setu Should Adapt (Do Differently)

| OMOC Hook | Their Approach | Setu's Approach |
|-----------|----------------|-----------------|
| `comment-checker` | Nags about too many comments | Include in `code-quality` skill instead |
| `auto-update-checker` | Toast notifications | Setu stays quiet — only notify on critical updates |
| `background-notification` | Notifies on background completion | N/A initially (single-agent focus) |

---

## Tool Analysis: What OMOC Provides

### Tools Setu Should Implement

| OMOC Tool | What It Does | Setu Implementation | Priority |
|-----------|--------------|---------------------|----------|
| `lsp_diagnostics` | Pre-build errors | **Already in roadmap** | P1 |
| `lsp_rename` | Safe symbol rename | **Already in roadmap** | P2 |
| `ast_grep_search` | AST-aware code search | Investigate for Movement 3 | P2 |
| `session_list/read/search` | Navigate session history | Consider for v2.0 | P3 |

### Tools Setu Won't Need (For Now)

| OMOC Tool | Why Not Now |
|-----------|-------------|
| `call_omo_agent` | Multi-agent is v2.0 for Setu |
| `delegate_task` | Same — v2.0 scope |
| `skill_mcp` | MCP integration is future scope |

---

## MCP Analysis

### OMOC's Built-in MCPs

| MCP | What It Does | Free? | Setu Position |
|-----|--------------|-------|---------------|
| `websearch` (Exa) | Web search | **No** — requires Exa API key | Don't bundle; recommend |
| `context7` | Official docs | **Yes** — free | Recommend in docs |
| `grep_app` | GitHub code search | **Yes** — free | Recommend in docs |

**Setu's approach**: Don't bundle MCPs (keeps plugin lean). Document recommended MCPs in interoperability section. Users install what they need.

**Answer to your question about Exa**: OMOC requires users to provide their own Exa API key. It's not free from OMOC's side. So Setu shouldn't bundle it either — recommend it as optional.

---

## Feature Comparison: Where Setu Wins

### 1. Phase 0 (OMOC Doesn't Have This)

OMOC dives in immediately. Setu asks first.

**Why this matters**: Wrong assumptions = wasted work. Setu prevents the #1 token waste.

### 2. Operating Modes (OMOC Has One: "Ultrawork")

OMOC: Everything is max effort.
Setu: Match effort to task (Quick/Default/Expert/Collab).

**Why this matters**: Not every task needs full verification. Modes give user control.

### 3. Attempt Limits (OMOC: "Keep Bouldering")

OMOC: Retry until success (or forever).
Setu: 2 attempts, then ask for guidance.

**Why this matters**: Prevents infinite loops burning tokens on wrong approach.

### 4. Verification Protocol (OMOC: Todo Enforcer Only)

OMOC: Continues until todos done, but doesn't verify correctness.
Setu: Runs build/test/lint before claiming "done".

**Why this matters**: "Done" means "verified working", not "I think it's done".

### 5. Token Efficiency

OMOC: Heavy upfront (multiple agents, rich prompts).
Setu: ~500 tokens to start, skills load on-demand.

**Why this matters**: Users with limited API credits prefer lean starts.

---

## Feature Comparison: Where OMOC Wins

### 1. Multi-Agent Orchestration

OMOC spawns specialized agents (Oracle, Librarian, etc.).
Setu is single-agent (for now — v2.0 will add this).

**Mitigation**: Position as "discipline first, delegation later".

### 2. LSP/AST Tooling

OMOC has full LSP (rename, diagnostics) + AST-grep.
Setu has LSP in roadmap (Movement 3).

**Mitigation**: Prioritize Movement 3. LSP is table stakes.

### 3. Claude Code Compatibility

OMOC loads Claude Code hooks, commands, skills, agents, MCPs.
Setu doesn't (yet).

**Mitigation**: Add `.claude/` compat as future feature. Not critical for MVP.

### 4. Session Management

OMOC can search/list/read session history.
Setu doesn't have this.

**Mitigation**: Nice-to-have for v2.0. Not differentiating.

### 5. Background Agents

OMOC runs agents in parallel (async execution).
Setu is synchronous (single-agent).

**Mitigation**: v2.0 scope. Single disciplined agent is Setu's identity.

---

## Implementation Insights

### How OMOC Handles Context Injection

```
// Their approach:
// 1. Directory AGENTS.md injector walks from file to project root
// 2. Collects ALL AGENTS.md files along path
// 3. Injects in order (root → leaf)
```

**Setu should adopt**: This is smart. Implement in `system-transform` hook. Walk upward, collect `AGENTS.md` files, inject.

### How OMOC Handles Truncation

```
// Their approach:
// 1. Grep/glob outputs capped at 50k tokens
// 2. Considers remaining context window (50% headroom)
// 3. Dynamically truncates based on available space
```

**Setu should adapt**: Our "extract only errors" is simpler but effective. Could add dynamic truncation in v1.1.

### How OMOC Handles Recovery

```
// Their approach:
// 1. Catches thinking block errors
// 2. Auto-recovers by extracting last user message
// 3. Continues session automatically
```

**Setu should add**: Session recovery is user-friendly. Add to roadmap.

---

## Interoperability Design

### Detection Strategy

When Setu loads, check for:
1. OMOC installed? → Adapt behavior (don't duplicate hooks)
2. Other plugins? → Stay compatible (don't interfere)

### Coexistence Rules

| If OMOC Present | Setu Behavior |
|-----------------|---------------|
| OMOC's todo enforcer active | Disable Setu's (avoid duplicate) |
| OMOC's LSP tools active | Use them (don't reimplement) |
| OMOC's agents active | Setu wraps with discipline (Phase 0, verification) |

### Messaging

> "Setu is a discipline layer. It works with oh-my-opencode, adding verification to OMOC's power tools."

---

## Roadmap Updates Needed

Based on this analysis, add to Setu roadmap:

### Movement 1 (Foundation)
- [x] Phase 0 enforcement (already there)
- [x] Session idle enforcement (already there)
- [x] Attempt tracking (already there)
- [ ] **ADD**: Session recovery hook
- [ ] **ADD**: Preemptive compaction (at 85%)

### Movement 2 (Tools)
- [x] Skill management (already there)
- [x] Context injection (already there)
- [ ] **ADD**: AGENTS.md walker (walk upward, collect all)
- [ ] **ADD**: Empty response detection

### Movement 3 (LSP)
- [x] LSP symbols (already there)
- [x] Smart extraction (already there)
- [ ] **PRIORITIZE**: AST-grep investigation

### Future (v1.1+)
- [ ] Claude Code compatibility layer
- [ ] Session management tools
- [ ] Multi-agent delegation (disciplined)

---

## Answers to Your Questions

### Q8: How can SOC do hooks better than OMOC?

**Answer**: 
1. **Fewer, focused hooks** — OMOC has 25+, many overlap. Setu has focused hooks with clear purpose.
2. **Philosophy-driven** — Each hook serves the Covenant, not just convenience.
3. **Explicit modes** — Instead of "keyword detection", Setu has explicit mode switching.
4. **Verification-first** — Todo continuation + verification, not just continuation.

### Q9: Interoperability recommendation

**Answer**: 
- **Recommend** in docs: "Works with oh-my-opencode, cursor-tools, etc."
- **Detect** OMOC specifically: Check for OMOC hooks, adapt behavior.
- **Don't block**: If unknown plugin, stay compatible.

### Q10: How to get testimonials

**Answer**: (Added to MARKETING_TASKS.md)
1. Use it yourself, document wins
2. Share with developer friends, ask for feedback
3. Post recordings on X/Twitter
4. Help in Discord communities (OpenCode, AI coding)
5. When Setu catches a bug, document it as proof

---

## Summary: Setu's Winning Position

| Dimension | OMOC | Setu |
|-----------|------|------|
| **Identity** | Power user's dream | Senior engineer's sanity |
| **Token cost** | Heavy | Lean |
| **Philosophy** | "Throw agents at it" | "Think before acting" |
| **Verification** | Continues until done | Verifies before "done" |
| **Target user** | Indie hackers, tinkerers | Engineers who need correctness |

**Setu's tagline**: *Think first. Verify always.*
