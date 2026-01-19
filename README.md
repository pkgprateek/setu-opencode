# Setu OpenCode

> **Pre-emptive discipline for AI coding.**
> 
> Other tools fix mistakes after they happen. Setu prevents them before they start.

**Setu** (Sanskrit: सेतु, "bridge") is an agent discipline protocol for [OpenCode](https://opencode.ai). It bridges the gap between "AI that codes fast" and "AI that codes correctly."

[![npm version](https://img.shields.io/npm/v/setu-opencode.svg)](https://www.npmjs.com/package/setu-opencode)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## Why Setu Exists

AI coding agents are fast. But speed without discipline creates three problems:

| Problem | What Happens | The Real Cost |
|---------|--------------|---------------|
| **Wrong assumptions** | Agent dives in without understanding context | You spend 20 minutes explaining what it got wrong |
| **Unverified output** | Agent claims "done!" but tests would fail | Broken code reaches production |
| **Infinite loops** | Agent retries the same wrong approach forever | Burned tokens, wasted time, no progress |

**The root cause:** These agents are reactive, not proactive. They run first, fix later.

**Setu's approach:** Block wrong actions *before* they execute. Make the agent think first.

---

## The Key Difference

| Approach | Reactive Tools (oh-my-opencode, etc.) | Setu (Pre-emptive) |
|----------|-----------------------------|--------------------|
| **When it acts** | After the agent makes a mistake | Before the agent executes |
| **How it works** | Fixes errors, retries, continues | Blocks execution, forces reflection |
| **Philosophy** | "Keep going until it works" | "Think first, then act correctly" |
| **Best for** | Rapid prototyping, exploration | Production code, correctness-critical work |

**Setu doesn't replace reactive tools.** It adds a discipline layer on top. Use both if you want power AND correctness.

---

## How It Works

### Phase 0: Pre-emptive Context Check

**Why this matters:** The #1 cause of wasted work is wrong assumptions. If the agent doesn't understand your context, everything it builds is wrong.

**What Setu does:** Before any tool execution, Setu intercepts and asks:

> "Before I begin, is there any additional context, specific focus, or details you'd like to share?"

**The difference:**
- Without Setu: Agent assumes JWT auth, builds it, you wanted OAuth
- With Setu: Agent asks first, you clarify, it builds correctly

```
┌─────────────────────────────────────────────────────────┐
│                     Your Prompt                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 0: Context Gate                                  │
│  → Blocks ALL tools until you respond                   │
│  → Agent cannot proceed on assumptions                  │
└─────────────────────────────────────────────────────────┘
                           │
                    (You respond)
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Agent executes with correct understanding              │
└─────────────────────────────────────────────────────────┘
```

### Operating Modes: Match Rigor to Risk

**Why this matters:** Not every task needs the same level of verification. A typo fix doesn't need full test runs. A new feature does.

**What Setu does:** Four modes that match verification level to task risk.

| Mode | When to Use | What Happens |
|------|-------------|--------------|
| **Default** | Features, refactoring | Full verification (build/test/lint) |
| **Quick** | Typos, comments | Minimal checks, fast execution |
| **Expert** | You know what you want | Agent proposes, you review |
| **Collab** | Architecture decisions | Discuss options before implementing |

**Switch modes:**
```
mode: quick          # Persistent until changed
quick fix the typo   # Temporary, one task only
```

Every response shows `[Mode: X]` so you always know what level of rigor is active.

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

## Zero Configuration

**Intent:** Friction kills adoption. Setu should "just work."

```bash
# Add to your opencode.json
{
  "plugin": ["setu-opencode"]
}
```

That's it. No JSON configuration required. Setu works with sensible defaults.

**Optional overrides** (if you want them):
```json
{
  "setu": {
    "defaultMode": "quick",     // Change default mode
    "enforcement": false        // Suggestions only, no blocking
  }
}
```

---

## Works With Everything

**Intent:** Setu is a discipline layer, not a replacement for your tools.

### With oh-my-opencode

OMOC gives you power (multi-agent, LSP, MCPs). Setu adds discipline.

```json
{
  "plugin": ["oh-my-opencode", "setu-opencode"]
}
```

Setu detects OMOC and adapts:
- Loads after OMOC (doesn't interfere)
- Wraps OMOC's agents with Phase 0 and verification
- Uses OMOC's tools when available

### With Any Plugin

Setu hooks into OpenCode's system layer:
- `system-transform` — Injects discipline protocol
- `tool.execute.before` — Phase 0 blocking
- `session.idle` — Verification enforcement

Your MCPs, tools, and workflows work unchanged.

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

**The market positioning:**
> OMOC wins the indie hacker who wants powerful tools.
> Setu wins the senior engineer who needs their agent to stop hallucinating.

---

## Token Efficiency

**Intent:** Discipline shouldn't cost you your token budget.

| State | Token Cost |
|-------|------------|
| Session start | ~500 tokens |
| + 1 skill loaded | +300-600 |
| All skills loaded | ~1,400 total |

Setu's persona is lean. Skills load on-demand, not upfront.

**Compare:** Heavy setups load 4,000+ tokens before you type anything.

---

## Skills Included

**Intent:** Reduce friction for doing things correctly.

| Skill | Why It Exists |
|-------|---------------|
| `setu-bootstrap` | Project setup that follows the discipline protocol |
| `setu-verification` | Mode-specific verification steps |
| `setu-rules-creation` | Create effective AGENTS.md files |
| `code-quality` | Naming, error handling, testing patterns |
| `refine-code` | Transform code to match project standards |
| `commit-helper` | Conventional commits that explain "why" |
| `pr-review` | Security, performance, quality review |

Skills load when relevant, not at startup.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the path to v1.0.

---

## The Philosophy

Setu is named after the bridge in Hindu mythology — built not by force, but by discipline, cooperation, and engineering.

**Core principles:**
1. **Think before acting** — Phase 0 prevents wrong assumptions
2. **Verify before claiming** — Tests prove correctness
3. **Ask before spinning** — Attempt limits prevent waste
4. **Adapt to context** — Modes match rigor to risk

**The tagline:**
> *Think first. Verify always.*

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

---

**Setu:** *Pre-emptive discipline for AI coding.*
