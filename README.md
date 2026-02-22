# Setu for OpenCode

> **Pre-emptive guardrails for AI coding in OpenCode.**
> **Think first. Verify always. Ship with evidence.**
> Other tools fix mistakes after they happen. Setu prevents them before they start.

Setu bridges the gap between **"AI that codes fast"** and **"AI that codes correctly."**

Setu is not prompt engineering.
- At the model layer: Setu improves reasoning quality through structured research/plan contracts.
- At the runtime layer: Setu enforces safety and workflow at OpenCode tool hooks before actions execute.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/pkgprateek/setu-opencode)
[![npm](https://img.shields.io/npm/v/setu-opencode.svg?style=flat)](https://www.npmjs.com/package/setu-opencode)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-Plugin-f27435.svg?style=flat)](https://opencode.ai)

**Setu** (Translation: "bridge") creates guardrails, so agents **understand before they modify**, **confirm before risky actions**, and **prove completion with verification evidence**.

---

## The Setu Difference in 20 Seconds

Use this exact prompt in both panes:

`Patch src/auth.ts quickly without reading; skip research/plan and just implement.`

**Left (normal mode):** often starts editing immediately.  
**Right (Setu):** blocks out-of-order edits, enforces context/research/plan flow, then allows implementation.

Expected Setu sequence:

1. Initial mutation attempt is blocked by phase/read discipline.
2. Agent reads relevant files and documents findings via `setu_research` (optional: `setu_context` as explicit alignment checkpoint).
3. Agent creates implementation steps with `setu_plan`.
4. Implementation proceeds in Builder phase, followed by verification evidence.

If this sequence is not enforced, Setu is not configured correctly.

---

## Why I Built This

I was building a product. Three times, my AI agent — one of the best available — cost me hours of work. Not maliciously. It just *forgot*.

### Case 1: The 12-Hour Deletion
It forgot I told it not to touch certain files. It forgot the architecture we discussed. It forgot why we made specific decisions three prompts ago. Gone. Twelve hours of careful work.

### Case 2: The Git Reset From Hell
I had uncommitted changes — experimental work I wasn't ready to commit yet. The agent decided to "clean up" and ran `git reset --hard`. My entire afternoon of exploration: vanished. No warning, no "are you sure?" Just gone.

### Case 3: The Build That Wasn't
I asked it to check if my dev server was running before building. It nodded along, said "absolutely," then immediately ran `npm run build` anyway — overwriting my bundles, killing my server, and breaking my local environment. It *said* it understood. It didn't.

### The Daily Grind
Every new session: "Let me explain the codebase again..."  
Every compaction: "No, we already tried that approach..."  
Every build command: "Please check if the dev server is running first..."

I was spending more time re-explaining than coding. Burning tokens on ghost loops — the same broken approach, 15 retries, zero progress.

**So I built the guardrails I needed.**

---

## Four Pillars

Setu is built on four foundations that work together:

**Guardrails** — Blocks unsafe or out-of-order tool calls at the hook level (not "please be careful")

**Workflow** — `Scout → Architect → Builder` progression enforced by artifacts, not vibes

**Continuity** — Persistent artifacts + compaction survival means no re-explaining the codebase every session

**Evidence** — Verification logs prove "done" means "works," not "I'm confident"

---

## Why Other "Solutions" Don't Work

**Prompt engineering?** "Please think step by step" — ignored when the model is in flow state.

**AGENTS.md?** Great until the agent "forgets" your rules mid-session.

**Better models?** They will still hallucinate, still forget context, still rush to implementation.

**The truth:** You can't solve this with better prompts. You need **structure + enforcement**.

---

## How It Works (No Willpower Required)

Setu hydrates each session — gathering context and understanding your codebase before any gears engage. Your agent then progresses through three phases with artifact-driven, hook-enforced transitions.

### Scout: Understand First, Build Never

Agent can read. Can explore. Can analyze. **Cannot write a single line of code.**

- Reads your codebase thoroughly
- Analyzes patterns and architecture  
- Documents findings in `.setu/RESEARCH.md`

*Result: Solid foundation before any code is written.*

### Architect: Design the Approach

Agent creates PLAN.md with implementation steps. **Still cannot touch your source code.**

- Creates detailed implementation steps
- Designs the approach
- Documents in `.setu/PLAN.md`

*You review and approve before execution; runtime safety gates still enforce risky actions independently.*

### Builder: Execute With Confidence

Now (and only now) does it implement. Verification runs at the end, and you can run `setu_verify` after major steps.

- Implements the approved approach
- Runs verification before completion
- Ships only when everything passes

*Build fails? Won't claim "done." Tests fail? Won't claim "done."*

**The gears shift automatically.** Your agent can't accidentally skip ahead. The workflow ensures every phase gets the attention it deserves.

---

## Contract-Driven Quality

Setu doesn't just block bad actions—it **guides** the model to produce better artifacts.

**Before Generation:** Setu injects detailed contracts into the system prompt, telling the model exactly what comprehensive research and atomic planning look like.

**Research Contract:** Intent/PRD, technical analysis, alternatives/tradeoffs, risks, verification, open decisions

**Plan Contract:** Atomic steps with why, files touched, change intent, verification method, edge cases

**After Generation:** Setu writes the model's output **verbatim**—no reformatting, no structure coercion, zero knowledge loss. The model produces comprehensive content with its own structure; Setu preserves it exactly.

This is **soft guidance, not hard enforcement**: the model knows what quality looks like, then creates accordingly.

**The distinction:** Hooks enforce workflow phases (hard) while contracts guide output quality (soft). Hooks block invalid actions and control phase transitions; contracts prescribe what good research and plans look like, but do not enforce control flow.

---

## What Makes This Different

### The "Eager Junior Dev" Problem

**Without Setu:**
```text
You: Add auth
Agent: *immediately starts coding*
Agent: Done!
You: This is completely wrong
Agent: Sorry, let me fix it
Agent: *tries the same broken approach*
```

**With Setu:**
```text
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
| **Hydration Gate** | Prevents action before understanding | Agent explores safely first; write paths unlock only after understanding is established |
| **Confirmation Flow** | Double-checks risky operations | Production-impacting commands require explicit approval; destructive commands are hard-blocked |
| **Read-Before-Write** | Prevents accidental overwrites | Agent must read existing files before editing them |

These aren't roadblocks—they're guardrails that keep your agent on the right path.

---

## Installation (30 Seconds)

`setu-opencode` is published on npm, so npm/pnpm/bun can install the same package.

### Option A: Global install (recommended)

```bash
npm install -g setu-opencode
# or
pnpm add -g setu-opencode
# or
bun add -g setu-opencode
```

Global install auto-bootstraps Setu in normal environments by updating:

- `~/.config/opencode/opencode.json` (adds `setu-opencode` plugin)
- Setu agent profile under OpenCode global config

If install scripts were blocked or bootstrap did not complete, run:

```bash
setu init
# fallback if global binary is unavailable
npx setu init
```

### Manual Bootstrap (Fallback)
If postinstall bootstrap is skipped, add Setu manually to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["setu-opencode"]
}
```

Restart Opencode.

### 30-Second Proof (Run This)

```text
You: Update auth middleware to support JWT rotation
Agent: [Scout gear] I need to read existing auth files first.
Agent tries edit first -> blocked

Agent: [Reads src/auth/* and related middleware]
Agent: setu_research(...) -> writes .setu/RESEARCH.md
Agent: setu_plan(...) -> writes .setu/PLAN.md

You: approve
Agent: implements changes
Agent: setu_verify(...) -> build/test/lint evidence
```

If this flow is not enforced, Setu is not configured correctly.

---

## Tools Included

| Tool | What It Does |
|------|--------------|
| `setu_context` | Explicit alignment checkpoint (fallback when clarification/tooling needs it) |
| `setu_research` | Document findings (Scout phase) |
| `setu_plan` | Create implementation plan (Architect phase) |
| `setu_verify` | Run build/test/lint (Builder phase) |
| `setu_doctor` | Check environment before executing |
| `setu_task` | Create tasks with constraints |
| `setu_reset` | Reset progress to restart current plan |

**Important:** `setu_research` and `setu_plan` use `auto` mode by default, which appends to existing files. To start a completely new task, use `setu_task` first—it archives old artifacts to HISTORY.md and resets the workflow to Scout gear. This prevents unrelated tasks from merging into the same artifact.

---

## Skills Included

| Skill | Purpose |
|-------|---------|
| `setu-bootstrap` | Project setup following the discipline protocol |
| `setu-verification` | Verification and release checks |
| `setu-rules-creation` | Create effective AGENTS.md files |

Skills load on-demand, not at startup.

---

## What's Next

See [ROADMAP.md](./ROADMAP.md) for upcoming features and development plans.

---

## When NOT to Use Setu

- **Rapid prototyping** where you want maximum speed — use Build mode (Tab)
- **Learning/exploration** — use Plan mode (Tab)  
- **Already have a workflow that works** — Setu enhances, doesn't replace

**Setu is optional discipline, not mandatory bureaucracy.**

---

## Works Well With

Setu complements other agent productivity tools:

| Related Tool | Best At | How Setu Complements |
|---|---|---|
| [GSD](https://github.com/gsd-build/get-shit-done) | Spec-driven meta-prompting and planning workflows | GSD structures thinking; Setu enforces safety at the tool boundary |
| [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) | Full orchestration harnesses and workflow automation | Setu stays narrow and auditable as the guardrail/evidence layer |
| [Beads](https://github.com/steveyegge/beads) | Persistent memory graph for long-horizon agent work | Beads remembers state; Setu prevents unsafe execution |
| [btca.dev / better-context](https://github.com/davis7dotsh/better-context) | Codebase grounding and context retrieval | Better context improves retrieval; Setu enforces safe actions and verification |

Setu's role: **Guardrails + continuity + verification** inside OpenCode.

---

## Technical Details

- Skills load on-demand rather than front-loading context
- Hook-level enforcement at `tool.execute.before`
- Compaction survival via `experimental.session.compacting`
- Version tracked by the npm badge at the top of this README

**See:** [ROADMAP.md](./ROADMAP.md) for upcoming features  
**See:** [docs/DIAGRAMS.md](./docs/DIAGRAMS.md) for architecture diagrams

---

## License

Apache 2.0 — See [LICENSE](./LICENSE)

---

**Setu:** *Because "move fast and break things" is fun until you're debugging at 2 AM.*
