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

### Phase 0: Pre-emptive Context Gate

**Why this matters:** The #1 cause of wasted work is wrong assumptions. If the agent doesn't understand your context, everything it builds is wrong.

**What Setu does:** Before allowing any side-effect tools, Setu **blocks** execution until context is confirmed. The agent can read files and explore the codebase ("look but don't touch"), but cannot write, edit, or execute commands until it confirms understanding.

**The difference:**
- Without Setu: Agent assumes JWT auth, builds it, you wanted OAuth
- With Setu: Agent reads first, asks smart questions, builds correctly

```text
┌─────────────────────────────────────────────────────────────┐
│                     Your Prompt                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 0: Context Gate                                      │
│  → Agent can READ files (look but don't touch)              │
│  → Agent CANNOT write, execute, or modify                   │
│  → Explores codebase, forms understanding                   │
│  → Confirms context with setu_context tool                  │
└─────────────────────────────────────────────────────────────┘
                           │
                    (Context confirmed)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Agent executes with correct understanding                  │
└─────────────────────────────────────────────────────────────┘
```

### Styles (Operational Presets): Match Rigor to Risk

**Why this matters:** Not every task needs the same level of verification. A typo fix doesn't need full test runs. A new feature does.

**What Setu does:** Four styles that match verification level to task risk.

| Style | When to Use | What Happens |
|-------|-------------|--------------|
| **Ultrathink** | Features, refactoring | Deep analysis, full verification |
| **Quick** | Typos, comments | Skip ceremony, just do it |
| **Expert** | You know what you want | Propose, don't block |
| **Collab** | Architecture decisions | Discuss before implementing |

**Switch styles** by mentioning them in your message:
```text
style: ultrathink implement the auth system
style: quick fix the typo
```

The system prompt shows the current style so you always know what level of rigor is active.

### Verification Before "Done"

**Why this matters:** "Done" should mean "verified working," not "I think it's done."

**What Setu does:** In Default mode, before claiming completion:

1. **Build** — Runs build, checks exit code, captures only errors
2. **Tests** — Runs test suite, captures only failures
3. **Lint** — Checks for errors/warnings
4. **Visual** — Asks you to verify UI (when applicable)

**The difference:**
- Without Setu: "Done!" → You run tests → They fail → 10 more minutes of back-and-forth
- With Setu: Agent runs tests first → Fixes failures → "Done" means done

### Attempt Limits: Prevent Infinite Loops

**Why this matters:** When an agent is on the wrong track, retrying the same approach wastes tokens and time.

**What Setu does:** After 2 failed attempts at the same problem:

> "I've tried X and Y. Would you like me to try Z, or do you have guidance?"

**The difference:**
- Without Setu: Agent retries broken import 15 times (it was a config issue)
- With Setu: After 2 tries, agent asks "Could this be a config issue?"

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

**First run:** Restart OpenCode once after adding the plugin. Setu will appear in the Tab cycle on second launch. (This is a known limitation being addressed in v1.2.)

---

## Works With Other Plugins

Setu is a discipline layer, not a replacement for your tools.

```json
{
  "plugin": ["your-other-plugin", "setu-opencode"]
}
```

Setu hooks into OpenCode's plugin system:
- `experimental.chat.system.transform` — Injects Setu persona
- `tool.execute.before` — Phase 0 blocking
- `tool.execute.after` — Verification tracking, context collection
- `event` — Session lifecycle, context loading

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
| Session start | ~500 tokens |
| + 1 skill loaded | +300-600 |
| All skills loaded | ~1,400 total |

Setu's persona is lean. Skills load on-demand, not upfront.

---

## Tools Provided

| Tool | Purpose |
|------|---------|
| `setu_context` | Confirm context understanding, unlocks Phase 0 |
| `setu_verify` | Run verification protocol (build/test/lint) |
| `setu_feedback` | Record feedback on Setu behavior |

---

## Skills Included

| Skill | Purpose |
|-------|---------|
| `setu-bootstrap` | Project setup that follows the discipline protocol |
| `setu-verification` | Style-specific verification steps |
| `setu-rules-creation` | Create effective AGENTS.md files |
| `code-quality` | Naming, error handling, testing patterns |
| `refine-code` | Transform code to match project standards |
| `commit-helper` | Conventional commits that explain "why" |
| `pr-review` | Security, performance, quality review |

Skills load when relevant, not at startup.

---

## The Philosophy

Setu is named after the bridge in mythology — built not by force, but by discipline, cooperation, and engineering.

**Core principles:**
1. **Think before acting** — Phase 0 prevents wrong assumptions
2. **Verify before claiming** — Tests prove correctness
3. **Ask before spinning** — Attempt limits prevent waste
4. **Adapt to context** — Styles match rigor to risk

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the path to v1.0.

**Coming in v1.1:** Visual verification via [agent-browser](https://github.com/vercel-labs/agent-browser) — Setu will finally be able to *see* what it builds.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

Apache 2.0 — See [LICENSE](./LICENSE)

---

**Setu:** *Think first. Verify always.*
