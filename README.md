# Setu OpenCode

> Your AI coding agent is fast. But is it *correct*?

**Setu** is an agent discipline protocol for [OpenCode](https://opencode.ai). It makes your agent think before acting, verify before claiming "done", and ask before assuming.

[![npm version](https://img.shields.io/npm/v/setu-opencode.svg)](https://www.npmjs.com/package/setu-opencode)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## The Problem

AI coding agents fail in predictable ways:

| Failure Mode | What Happens | Cost |
|--------------|--------------|------|
| **Wrong Assumptions** | Dives into code without understanding context | Wasted work, wrong direction |
| **Unverified Output** | Claims "done" without running tests | Broken code in production |
| **Infinite Loops** | Retries the same failing approach forever | Burned tokens, no progress |
| **Context Rot** | Forgets important details in long sessions | Inconsistent behavior |

**Setu prevents all four.**

---

## How It Works

Setu wraps your OpenCode agent with enforcement protocols:

```
┌─────────────────────────────────────────────────────────┐
│                     Your Prompt                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 0: Context Check                                 │
│  "Before I begin, is there any context I should know?" │
│  → Blocks tools until you respond                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  MODE SELECTION                                         │
│  Default | Quick | Expert | Collab                      │
│  → Matches verification level to task risk              │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  EXECUTION + VERIFICATION                               │
│  → Runs build/test/lint before claiming "done"          │
│  → 2 attempts max, then asks for guidance               │
│  → Extracts only errors, not full logs                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Verified Output                       │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Comparison

| Behavior | Raw OpenCode | With Setu |
|----------|--------------|-----------|
| Asks for context first | No | Yes (Phase 0) |
| Multiple operating modes | No | 4 modes |
| Verifies before "done" | No | Yes (build/test/lint) |
| Limits retry attempts | No | 2 attempts, then asks |
| Token-efficient logs | No | Extracts errors only |
| Session context hygiene | No | Compaction triggers |

**Works alongside other plugins.** Setu is a discipline layer — it enhances whatever tools you're already using (oh-my-opencode, custom MCPs, etc.).

---

## Installation

```bash
# Add to your opencode.json
{
  "plugin": ["setu-opencode"]
}
```

Restart OpenCode. That's it.

---

## Operating Modes

Not every task needs the same rigor. Switch modes to match your risk tolerance:

| Mode | Trigger | Verification | Use Case |
|------|---------|--------------|----------|
| **Default** | (automatic) | Full (build/test/lint) | Features, refactoring |
| **Quick** | `mode: quick` | Minimal | Typos, comments |
| **Expert** | `mode: expert` | You review | You know what you want |
| **Collab** | `mode: collab` | Discuss first | Architecture decisions |

Every response starts with `[Mode: X]` so you always know what to expect.

### Switching Modes

```
mode: quick          # Persistent until changed
quick fix the typo   # Temporary, one task only
```

---

## What Gets Enforced

### Phase 0: Context First

Before any work, Setu asks:

> "Before I begin, is there any additional context, specific focus, or details you'd like to share?"

**Why:** Prevents the #1 token waste — working on wrong assumptions.

### Verification Protocol

In Default mode, Setu runs checks before claiming "done":

1. **Build** — Checks exit code, captures only errors
2. **Tests** — Runs test suite, captures only failures
3. **Lint** — Checks for errors/warnings
4. **Visual** — Asks you to verify UI (when applicable)

**Why:** "It works on my machine" is not verified.

### Attempt Limits

After 2 failed attempts at the same problem:

> "I've tried X and Y. Would you like me to try Z, or do you have guidance?"

**Why:** Prevents infinite loops burning tokens on unsolvable problems.

### Todo Continuation

Won't stop with incomplete tasks. Tracks progress and continues until the checklist is done.

**Why:** "I'll finish this later" means it never gets finished.

---

## Skills Included

Setu bundles 7 skills that load on-demand (not upfront — saves tokens):

| Skill | Purpose |
|-------|---------|
| `setu-bootstrap` | Project initialization, AGENTS.md creation |
| `setu-verification` | Mode-specific verification steps |
| `setu-rules-creation` | Generate effective project rules |
| `code-quality` | Naming, error handling, testing patterns |
| `refine-code` | Transform code to match standards |
| `commit-helper` | Conventional commit messages |
| `pr-review` | Security, performance, quality review |

---

## Token Efficiency

Setu is designed for minimal overhead:

| State | Token Cost |
|-------|------------|
| Session start | ~500 tokens |
| + 1 skill loaded | +300-600 |
| All skills loaded | ~1,400 total |

**Compare:** Some setups load 4,000+ tokens upfront before you type anything.

---

## Interoperability

Setu is a **discipline layer**, not a replacement for your tools.

**Works with:**
- **oh-my-opencode** — Setu adds verification to OMOC's power tools
- **Custom MCPs** — Setu doesn't interfere with your MCP servers
- **Any OpenCode plugin** — Setu wraps behavior, doesn't replace tools

**Philosophy:**
> Other plugins give you more tools. Setu makes sure those tools are used correctly.

---

## Configuration

### Disable Enforcement (Suggestions Only)

```json
{
  "plugin": ["setu-opencode"],
  "setu": {
    "enforcement": false
  }
}
```

### Change Default Mode

```json
{
  "setu": {
    "defaultMode": "quick"
  }
}
```

---

## Who Is This For?

**Setu is for developers who:**
- Want their agent to stop hallucinating libraries that don't exist
- Are tired of "done!" followed by broken builds
- Value correctness over raw speed
- Work on production codebases where mistakes are expensive

**Setu is probably not for:**
- Rapid prototyping where verification slows you down
- Simple scripts where overhead isn't worth it
- Users who prefer maximum autonomy over discipline

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the path to v1.0:

- **Movement 1:** Hard enforcement (Phase 0 blocking, session idle hooks, attempt tracking)
- **Movement 2:** Context tools (skill management, smart context injection, git safety)
- **Movement 3:** LSP integration (symbol search, smart extraction, stack-aware verification)

---

## Etymology

**Setu** (Sanskrit: सेतु, pronounced "SAY-too") means "bridge."

In Hindu mythology, the Setu was the bridge built to cross the ocean — not by force, but by discipline, cooperation, and engineering.

Setu bridges the gap between "AI that codes fast" and "AI that codes correctly."

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

Areas needing help:
- Testing on diverse projects
- Additional skills
- Documentation improvements
- Performance optimization

---

## License

Apache 2.0 — See [LICENSE](./LICENSE)

---

**Setu:** *Think first. Verify always.*
