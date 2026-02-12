# Setu OpenCode

> **Your AI agent, but it actually remembers what you told it.**
> **Pre-emptive discipline for AI coding.**
> Other tools fix mistakes after they happen. Setu prevents them before they start.

Setu bridges the gap between "AI that codes fast" and "AI that codes correctly."

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/pkgprateek/setu-opencode)
[![npm](https://img.shields.io/npm/v/setu-opencode.svg?style=for-the-badge)](https://www.npmjs.com/package/setu-opencode)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-Plugin-f27435.svg?style=for-the-badge)](https://opencode.ai)

**Setu** (Sanskrit: सेतु, "bridge") transforms OpenCode from an overeager junior dev into a senior engineer who thinks before typing.

---

## Why I Built This

I was building a product. Twice, my AI agent — one of the best available — deleted 12+ hours of my work.

Not maliciously. It just *forgot*. It forgot I told it not to touch certain files. It forgot the architecture we discussed. It forgot why we made specific decisions three prompts ago.

And when I ran my dev server, it ran `npm run build` anyway — overwriting my bundles, breaking my local environment.

Every new session: "Let me explain the codebase again..."  
Every compaction: "No, we already tried that approach..."  
Every build command: "Please check if the dev server is running first..."

I was spending more time re-explaining than coding. Burning tokens on ghost loops — the same broken approach, 15 retries, zero progress.

**So I built the discipline layer I needed.**

Setu bridges the gap between "AI that codes fast" and "AI that codes correctly."

---

## Why Other "Solutions" Don't Work

**Prompt engineering?** "Please think step by step" — ignored when the model is in flow state.

**AGENTS.md?** Great until the agent "forgets" your rules mid-session.

**Better models?** They will still hallucinate, still forget context, still rush to implementation.

**The truth:** You can't solve this with better prompts. You need **structure**.

---

## Setu: Structure That Actually Works

Setu doesn't ask your agent to "be more careful." It creates a workflow where carefulness is the default.

![Setu Workflow Diagram](assets/setu-workflow.svg)

### How It Works (No Willpower Required)

Your agent automatically progresses through three phases. Can't skip. Can't rush.

**🔍 Scout: Understand First, Build Never**

Agent can read. Can explore. Can analyze. **Cannot write a single line of code.**

- Reads your codebase thoroughly
- Analyzes patterns and architecture  
- Documents findings in `.setu/RESEARCH.md`

*Result: Solid foundation before any code is written.*

**📐 Architect: Design the Approach**

Agent creates PLAN.md with implementation steps. **Still cannot touch your source code.**

- Creates detailed implementation steps
- Designs the approach
- Documents in `.setu/PLAN.md`

*You review. You approve. Only then does it proceed.*

**🔨 Builder: Execute With Confidence**

Now (and only now) does it implement. With verification at every step.

- Implements the approved approach
- Runs verification at each step
- Ships only when everything passes

*Build fails? Won't claim "done." Tests fail? Won't claim "done."*

**The gears shift automatically.** Your agent can't accidentally skip ahead. The workflow ensures every phase gets the attention it deserves.

---

## What Makes This Different

### The "Eager Junior Dev" Problem

**Without Setu:**
```
You: Add auth
Agent: *immediately starts coding*
Agent: Done!
You: This is completely wrong
Agent: Sorry, let me fix it
Agent: *tries the same broken approach*
```

**With Setu:**
```
You: Add auth
Agent: I'm in Scout phase. Let me understand your auth patterns first...
[Reads your existing auth code]
[Analyzes your middleware structure]
[Documents findings in RESEARCH.md]

Agent: Moving to Architect phase. Here's my plan:
[PLAN.md with step-by-step approach]
[Specifically addresses your existing patterns]

You: Looks good, proceed
Agent: Executing plan with verification...
[Build passes]
[Tests pass]
Done.
```

### The "Context Goldfish" Problem

**Without Setu:**  
Every session starts with "Let me explore the codebase..." (even though you did this yesterday)

**With Setu:**  
RESEARCH.md and PLAN.md persist across restarts. Your agent picks up exactly where you left off. No re-explaining. No déjà vu.

### Safety Mechanisms

Three independent layers protect your codebase:

| Layer | Purpose | How It Helps |
|-------|---------|--------------|
| **Context Gate** | Prevents action before understanding | Agent explores your codebase first, then asks you to confirm with `setu_context` |
| **Confirmation Flow** | Double-checks risky operations | Production deployments, destructive commands prompt for explicit approval |
| **Read-Before-Write** | Prevents accidental overwrites | Agent must read existing files before editing them |

These aren't roadblocks—they're guardrails that keep your agent on the right path.

---

## Installation (30 Seconds)

```json
// opencode.json
{
  "plugin": ["setu-opencode"]
}
```

Restart OpenCode. Press **Tab** until you see "Setu." Done.

**Note:** First run requires one restart. Setu appears in Tab cycle on second launch.

---

## Three Modes, Your Choice

| Mode | When | What Happens |
|------|------|--------------|
| **Setu** (default) | Features, refactoring, anything important | Full workflow: Scout → Architect → Builder |
| **Plan** | Exploration, learning the codebase | Free research, no structure |
| **Build** | Quick fixes, typos, comments | Fast execution, minimal checks |

**Press Tab to switch.** Discipline when you need it. Speed when you don't.

---

## Why This Isn't Just Another Workflow Tool

**Other approaches:** "Please follow this workflow" (ignored)

**Setu:** Uses OpenCode hooks to enforce the workflow at the system level:
- `tool.execute.before` — Guides what can be done when
- `tool.execute.after` — Tracks progress and verification  
- `experimental.session.compacting` — Preserves context across memory limits

**Translation:** Your agent literally cannot skip steps. Not because it's being "good," but because the system won't let it.

### Comparison

| Feature | Setu | Other Approaches |
|---------|------|------------------|
| **Enforcement** | ✅ Hook-level (structural) | ❌ Prompt-based (optional) |
| **Setup** | One line | Complex configuration |
| **Workflow** | Automatic gears | Manual mode switching |
| **Complexity** | 🟢 Low friction | 🔴 High overhead |

---

## Real Results

| Before Setu | After Setu |
|-------------|------------|
| "Done!" → broken build | "Done!" → actually works |
| Re-explaining codebase every session | Context persists across restarts |
| Same wrong approach, 15 retries | Attempt tracking with intelligent pivots |
| "Oops I ran npm publish" | Production commands require explicit approval |
| Agent forgets after compaction | Context survives memory limits |

---

## Tools Included

| Tool | What It Does |
|------|--------------|
| `setu_context` | Confirm understanding, start the workflow |
| `setu_research` | Document findings (Scout phase) |
| `setu_plan` | Create implementation plan (Architect phase) |
| `setu_verify` | Run build/test/lint (Builder phase) |
| `setu_doctor` | Check environment before executing |
| `setu_task` | Create tasks with constraints |
| `setu_feedback` | Help improve Setu |

---

## Skills Included

| Skill | Purpose |
|-------|---------|
| `setu-bootstrap` | Project setup following the discipline protocol |
| `setu-verification` | Verification and release checks |
| `setu-rules-creation` | Create effective AGENTS.md files |

Skills load on-demand, not at startup.

---

## When NOT to Use Setu

- **Rapid prototyping** where you want maximum speed — use Build mode (Tab)
- **Learning/exploration** — use Plan mode (Tab)  
- **Already have a workflow that works** — Setu enhances, doesn't replace

**Setu is optional discipline, not mandatory bureaucracy.**

---

## Technical Details

**Token cost:** ~400 tokens at startup. Skills load on-demand.

**Current version:** 1.2.1

**See:** [ROADMAP.md](./ROADMAP.md) for upcoming features

---

## License

Apache 2.0 — See [LICENSE](./LICENSE)

---

**Setu:** *Because "move fast and break things" is fun until you're debugging at 2 AM.*
