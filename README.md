# setu-opencode

> Transform your AI coding assistant into a thoughtful, expert colleague. 

> *It's about doing it right — which is the fastest way in the end.*

**Setu** (Sanskrit: सेतु, "bridge" — pronounced "SAY-too") is a master craftsman persona for [OpenCode](https://opencode.ai) that bridges the gap between human intent and AI execution.

[![npm version](https://img.shields.io/npm/v/setu-opencode.svg)](https://www.npmjs.com/package/setu-opencode)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Why Setu?

Most AI coding tools optimize for speed. Setu optimizes for **craftsmanship**.

| Without Setu | With Setu |
|--------------|-----------|
| Dives in immediately | Asks for context first |
| One mode fits all | 4 modes for different tasks |
| Stops when it feels done | Verifies before completion |
| No personality | Trusted colleague experience |

## Features

### Operating Modes

Setu adapts to your task:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Ultrathink** | Default | Full protocol: plan → implement → verify |
| **Quick** | "quick fix this" | Skip ceremony, minimal verification |
| **Expert** | "mode: expert" | Trust your judgment, propose but don't block |
| **Collab** | "let's discuss" | Explore options together before implementing |

Every response starts with `[Mode: Ultrathink]` so you always know what to expect.

### Enforcement

Setu doesn't just suggest good practices — it enforces them:

- **Todo continuation**: Won't stop with incomplete tasks
- **Verification**: Runs build/test/lint before claiming "done" (in Ultrathink mode)
- **Attempt limits**: After 2 failed attempts, asks for guidance instead of spinning

### Skills Included

7 skills bundled and ready to use:

| Skill | Description |
|-------|-------------|
| `setu-bootstrap` | Project initialization and setup |
| `setu-verification` | Verification protocol by mode |
| `setu-rules-creation` | Create effective AGENTS.md files |
| `code-quality` | Naming, error handling, testing patterns |
| `refine-code` | Transform code to match standards |
| `commit-helper` | Conventional commit messages |
| `pr-review` | Security, performance, quality review |

## Installation

```bash
# Add to your opencode.json
{
  "plugin": ["setu-opencode"]
}
```

Then restart OpenCode. That's it — the plugin auto-installs from npm.

## Usage

### Starting a Session

When you start OpenCode, Setu introduces itself and asks:

> Before I begin, is there any additional context, specific focus, or details you'd like to share?

This "Phase 0" ensures no tokens are wasted on assumptions.

### Switching Modes

**Persistent switch** (lasts until changed):
```
mode: quick
```

**Temporary switch** (one task only):
```
quick fix the typo on line 42
```

### Using Custom Tools

Setu adds two tools:

```
setu_mode   - Switch operating modes programmatically
setu_verify - Run verification protocol
```

### Loading Skills

Skills load on-demand when relevant, or explicitly:

```
Load the setu-bootstrap skill and initialize this project
```

## Mode Details

### Ultrathink (Default)

For complex tasks, new features, refactoring:

- Plans before implementing
- Documents decisions
- Runs full verification (build, test, lint)
- Won't stop until todos complete

### Quick

For typos, comments, small edits:

- Executes directly, no planning overhead
- Skips verification for low-risk changes
- Still verifies if you added dependencies or changed config

### Expert

For when you know exactly what you want:

- Trusts your judgment
- Proposes solutions but doesn't block
- Skips explanations unless asked
- You review the results

### Collab

For architecture decisions, brainstorming:

- Discusses options before implementing
- Explores alternatives together
- Asks clarifying questions
- Decision is collaborative

## Verification Protocol

In Ultrathink mode, Setu verifies before completion:

1. **Build**: `npm run build` — checks exit code, captures errors
2. **Test**: `npm test` — captures failures only, not full output
3. **Lint**: `npm run lint` — captures error/warning count
4. **Visual**: Asks you to verify UI looks correct
5. **Edge cases**: Notes which were considered

**Principle**: Extract only what's needed. One root error causes many downstream — find the root, ignore the noise.

## The Covenant

Setu operates by 7 principles:

1. **Think Different** — Question assumptions. Find the elegant solution.
2. **Obsess Over Details** — Understand the patterns and philosophy.
3. **Plan Like Da Vinci** — Sketch architecture before writing.
4. **Craft, Don't Code** — Names should sing. Abstractions should feel natural.
5. **Iterate Relentlessly** — First version is never enough.
6. **Simplify Ruthlessly** — Remove complexity. Elegance is nothing left to take away.
7. **Leave It Better** — Document discoveries. Flag debt. Help the next developer.

## Token Efficiency

Setu is designed for minimal context overhead:

| Scenario | Tokens |
|----------|--------|
| Session start (persona only) | ~500 |
| + Bootstrap skill loaded | +600 |
| + Verification skill loaded | +300 |
| Maximum (all skills) | ~1,400 |

Compare to alternatives that load 4,000+ tokens upfront.

## Configuration

### Disabling Enforcement

If you want suggestions without enforcement:

```json
// In opencode.json
{
  "plugin": ["setu-opencode"],
  "setu": {
    "enforcement": false
  }
}
```

### Changing Default Mode

```json
{
  "setu": {
    "defaultMode": "quick"
  }
}
```

## Why Not Other Plugins?

There are excellent OpenCode plugins focused on speed and parallelism. Setu takes a different path — prioritizing **craftsmanship over velocity**, **understanding over execution**, and **elegance over quick fixes**.

If you want an AI that feels like a thoughtful senior colleague rather than a task-completion machine, give Setu a try.

## Contributing

Contributions welcome! Areas needing help:

- Testing on diverse projects
- Additional skills
- Documentation improvements
- Performance optimization

## License

Apache 2.0 — See [LICENSE](./LICENSE) and [NOTICE](./NOTICE)

---

**Setu**: *The people who are crazy enough to think they can change the world are the ones who do.*
