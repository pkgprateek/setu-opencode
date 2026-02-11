# Setu OpenCode

> **Pre-emptive discipline for AI coding.**
> 
> Other tools fix mistakes after they happen. Setu prevents them before they start.

**Setu** (Sanskrit: सेतु, "bridge") is an agent discipline protocol for [OpenCode](https://opencode.ai). It bridges the gap between "AI that codes fast" and "AI that codes correctly."

[![npm version](https://img.shields.io/npm/v/setu-opencode.svg)](https://www.npmjs.com/package/setu-opencode)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## Why Setu Exists

AI coding agents are fast. But speed without discipline creates problems:

| Problem | What Happens | The Real Cost |
|---------|--------------|---------------|
| **Wrong assumptions** | Agent dives in without understanding context | You spend 20 minutes explaining what it got wrong |
| **Unverified output** | Agent claims "done!" but tests would fail | Broken code reaches production |
| **Infinite loops** | Agent retries the same wrong approach forever | Burned tokens, wasted time, no progress |

**The root cause:** Most agents are reactive — they run first, fix later.

**Setu's approach:** Block wrong actions *before* they execute. Make the agent think first.

---

## How It Works

Setu enforces discipline through two layered mechanisms: **Phase 0** (initial context gate) and the **Gear System** (RPI workflow enforcement).

### Phase 0: Pre-emptive Context Gate

Before allowing any side-effect tools, Setu **blocks** execution until context is confirmed. The agent can read files and explore the codebase ("look but don't touch"), but cannot write, edit, or execute side-effect commands until it confirms understanding via `setu_context`.

### The Gear System: Research → Plan → Implement

Once Phase 0 is satisfied, gears enforce the RPI workflow — blocking premature implementation:

```text
Session Start
    │
    ▼
No RESEARCH.md? → SCOUT gear
    │              • Read-only
    │              • Research only
    │              • Cannot write code
    ▼
Create RESEARCH.md
    │
    ▼
RESEARCH.md exists, no PLAN.md? → ARCHITECT gear
    │                                 • Can write to .setu/
    │                                 • Can create PLAN.md
    │                                 • Cannot touch source code
    ▼
Create PLAN.md
    │
    ▼
PLAN.md exists → BUILDER gear
                   • Full access
                   • Verify before "done"
```

| Gear | Can Read | Can Write .setu/ | Can Write src/ | How to Advance |
|------|----------|------------------|----------------|----------------|
| **Scout** | All | RESEARCH.md only | No | `setu_research` |
| **Architect** | All | Any file | No | `setu_plan` |
| **Builder** | All | Any | Yes | N/A (final) |

**Why this beats prompts:** Gears are enforced via OpenCode hooks — they physically block tool execution. Unlike `AGENTS.md` instructions that the AI can ignore, hooks cannot be bypassed.

### Discipline Guards

Three independent safety mechanisms that can activate in any gear:

| Guard | Trigger | Blocks Until |
|-------|---------|-------------|
| **Question blocking** | Research has open questions, or plan needs approval | User answers via `question` tool |
| **Safety blocking** | Destructive/irreversible action detected | User confirms the action |
| **Overwrite protection** | File write without prior read | Agent reads the file first |

### Verification Before "Done"

Before claiming completion:

1. **Build** — Runs build, checks exit code, captures only errors
2. **Tests** — Runs test suite, captures only failures
3. **Lint** — Checks for errors/warnings
4. **Visual** — Asks you to verify UI (when applicable)

### Attempt Limits: Prevent Infinite Loops

After 3 failed attempts at the same problem (configurable):

> "I've tried X, Y, and Z. Would you like me to try a different approach, or do you have guidance?"

### Three Modes, One Purpose Each

| Mode | How to Access | Purpose | Enforcement |
|------|---------------|---------|-------------|
| **Setu** | Press Tab | Disciplined RPI workflow | Full (Phase 0, gears, verification, safety) |
| **Plan** | Press Tab | Free exploration | None (research mode) |
| **Build** | Press Tab | Quick execution | Minimal (safety only) |

**Key insight**: Setu doesn't compete with Plan/Build — it complements them. Use Build for quick fixes, Plan for exploration, Setu for substantial work.

---

## Installation

**Prerequisite:** [OpenCode](https://opencode.ai) must be installed.

Add to your `opencode.json`:
```json
{
  "plugin": ["setu-opencode"]
}
```

OpenCode automatically installs the plugin on next startup.

**First run:** Restart OpenCode once after adding the plugin. Setu will appear in the Tab cycle on second launch. (Known limitation.)

---

## Works With Other Plugins

Setu is a discipline layer, not a replacement for your tools.

```json
{
  "plugin": ["your-other-plugin", "setu-opencode"]
}
```

Setu hooks into OpenCode's plugin system:
- `experimental.chat.system.transform` — Injects Setu persona + gear state
- `tool.execute.before` — Phase 0 context gate + gear enforcement + discipline guards
- `tool.execute.after` — Verification tracking, context collection
- `event` — Session lifecycle, context loading
- `experimental.session.compacting` — Preserves active task across compaction

Your MCPs, tools, and workflows work unchanged. Setu wraps them with discipline.

---

## Who Is This For?

**Setu is for engineers who:**
- Work on production codebases where mistakes are expensive
- Are tired of "done!" followed by broken builds
- Want their agent to think before acting
- Value correctness over raw speed

**Setu is probably not for:**
- Rapid prototyping where speed matters more than correctness
- Exploration where you want the agent to try everything
- Users who prefer maximum autonomy

---

## Token Efficiency

Discipline shouldn't cost you your token budget.

| State | Token Cost |
|-------|------------|
| Session start | ~400 tokens |
| + 1 skill loaded | +300-600 |
| All skills loaded | ~1,100 total |

Setu's persona is lean. Skills load on-demand, not upfront.

---

## Tools Provided

| Tool | Purpose |
| ------ | --------- |
| `setu_context` | Confirm context understanding, unlocks Phase 0 |
| `setu_task` | Create/update/clear active tasks with constraint enforcement and artifact archiving |
| `setu_research` | Save research findings to RESEARCH.md, advance gear (Scout → Architect) |
| `setu_plan` | Create implementation plan in PLAN.md, advance gear (Architect → Builder) |
| `setu_verify` | Run verification protocol (build/test/lint/typecheck) |
| `setu_doctor` | Environment health checks (git, deps, runtime, port conflicts) |
| `setu_reset` | Reset step progress counter |
| `setu_feedback` | Record feedback on Setu behavior |

### Hooks Used

| Hook | Purpose |
| ------ | --------- |
| `experimental.chat.system.transform` | Inject Setu persona + gear-based workflow guidance |
| `tool.execute.before` | Phase 0 context gate, gear enforcement, discipline guards, constraint enforcement |
| `tool.execute.after` | Verification tracking, context collection |
| `event` | Session lifecycle, context loading, Silent Exploration |
| `experimental.session.compacting` | Inject active task into compaction summary |

---

## Skills Included

| Skill | Purpose |
| ------- | --------- |
| `setu-bootstrap` | Project setup that follows the discipline protocol |
| `setu-verification` | Verification and release checks |
| `setu-rules-creation` | Create effective AGENTS.md files |

Skills load when relevant, not at startup.

---

## The Philosophy

Setu is named after the bridge in mythology — built not by force, but by discipline, cooperation, and engineering.

**Core principles:**
1. **Think before acting** — Phase 0 + Scout gear prevent wrong assumptions
2. **Verify before claiming** — Tests prove correctness
3. **Ask before spinning** — Attempt limits prevent waste
4. **Adapt to context** — Gears enforce workflow automatically

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the version plan.

**Current:** v1.2.0 (Track A complete — gear-only core with discipline guards).
**Next:** v1.3.0 (Track B — flexible task model, parallel orchestration, JIT optimization).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

Apache 2.0 — See [LICENSE](./LICENSE)

---

**Setu:** *Think first. Verify always.*
