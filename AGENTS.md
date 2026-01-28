# Project: setu-opencode

## Overview

An OpenCode plugin that provides **Setu** — a disciplined primary agent for AI coding. Setu is a Tab-accessible mode that enforces pre-emptive discipline: context first, verify always.

When you install setu-opencode, Setu becomes your default agent. Press Tab to switch between Setu, Build, and Plan modes.

## Stack

- **Language**: TypeScript 5.x with strict mode
- **Runtime**: Node.js (OpenCode plugin)
- **Build**: Bun, TypeScript compiler
- **Testing**: Manual testing via OpenCode (automated tests planned)

## Architecture

### Setu as Primary Agent

Setu registers itself as a **primary agent** in OpenCode:

```
Tab → Setu (default) → Build → Plan → (cycle)
```

**Why a primary agent instead of just hooks?**
- **Permission-based blocking**: CANNOT edit vs DOES NOT edit
- **Clear user experience**: User knows they're in Setu mode
- **Easy escape hatch**: Tab to Build if Setu causes issues
- **No conflicts**: Doesn't interfere with Plan/Build modes

### Plugin Structure

```
src/
├── index.ts          # Plugin entry point, hook registration, agent creation
├── agent/            # Setu agent configuration
│   └── setu-agent.ts       # Creates .opencode/agent/setu.md
├── hooks/            # OpenCode hook implementations
│   ├── system-transform.ts   # Injects Setu persona
│   ├── chat-message.ts       # Agent/profile detection
│   └── tool-execute.ts       # Tool interception (before/after)
├── enforcement/      # Phase 0 blocking logic
├── context/          # Context persistence (.setu/ directory)
│   ├── index.ts            # Module exports
│   ├── types.ts            # Context type definitions (SetuContext, etc.)
│   ├── storage.ts          # Read/write context files, ContextCollector
│   └── feedback.ts         # User feedback mechanism
├── prompts/          # Persona and system prompt fragments
└── tools/            # Custom tools exposed to agent
    ├── setu-mode.ts          # Operational profile switching
    ├── setu-verify.ts        # Verification trigger
    ├── setu-context.ts       # Context confirmation + persistence
    └── setu-feedback.ts      # User feedback submission

skills/               # Bundled skills (loaded on-demand)
├── setu-bootstrap/         # Initial context gathering
├── setu-verification/      # Build/test/lint protocol
├── setu-rules-creation/    # AGENTS.md generation
├── code-quality/           # Code standards enforcement
├── refine-code/            # Code cleanup and polish
├── commit-helper/          # Conventional commit messages
└── pr-review/              # Pull request analysis

.setu/                # Context persistence directory (created per-project)
├── context.md              # Human-readable understanding
├── context.json            # Machine-parseable for injection
├── active.json             # Current task, mode, constraints (survives compaction)
├── feedback.md             # User feedback on Setu behavior
└── verification.log        # Build/test/lint audit trail
```

### Key Patterns

1. **Primary agent architecture**: Setu is a Tab-accessible mode with its own permissions
2. **Permission + Hook defense**: Permission system (CANNOT) + hooks (enforcement)
3. **Context persistence**: Understanding saved to `.setu/`, survives sessions
4. **Context injection**: Subagents receive context via prompt, don't re-read
5. **Parallel execution**: Explicit guidance to use parallel tool calls
6. **State isolation**: Each session has independent context/attempt state
7. **Progressive loading**: Skills load on-demand, not upfront

## Terminology

| Term | Meaning | Examples |
|------|---------|----------|
| **Mode** (OpenCode) | IDE-level agent via Tab | Plan, Build, Setu |
| **Operational Profile** (Setu) | Verification level within Setu | ultrathink, quick, expert, collab |

## Code Style

- Use `camelCase` for variables and functions
- Use `PascalCase` for types and interfaces
- Prefix interfaces with `I` only when necessary for clarity
- Use explicit return types on exported functions
- Prefer `const` over `let`
- Use template literals for string interpolation

### Naming Conventions

| Entity | Convention | Example |
|--------|------------|---------|
| Hook files | `kebab-case.ts` | `system-transform.ts` |
| Tool files | `kebab-case.ts` | `setu-mode.ts` |
| Types | `PascalCase` | `SetuMode`, `SessionState` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_PROFILE`, `MAX_ATTEMPTS` |

### Import Organization

1. Node.js built-ins
2. External packages
3. Internal modules (absolute paths)
4. Relative imports

## Common Commands

- **Build**: `bun run build`
- **Watch**: `bun run dev`
- **Lint**: `bun run lint`
- **Type check**: `bun run typecheck`
- **Test locally**: Load plugin in OpenCode via `opencode.json`

## Important Context

### The Core Insight

Setu is **pre-emptive**, not reactive. This means:
- Block side-effect tools BEFORE they execute (Phase 0)
- Allow read-only tools so agent can form smart questions
- Verify BEFORE claiming "done" (not after user discovers bugs)
- Use PARALLEL tool calls for efficiency

### The Experience

> "Setu should feel like a thoughtful colleague, not a gatekeeper."

This means:
- Clear messaging when blocking (explain why, what to do)
- Fast context gathering (parallel reads, not serial)
- Smart questions (context-aware, not generic)
- Seamless verification (automatic, not manual)

### Phase 0 Rule

**Allow (read-only):** `read`, `glob`, `grep`, `webfetch`, `todoread`
**Allow (bash read-only):** `ls`, `cat`, `head`, `tail`, `grep`, `find`, `pwd`, `echo`, `which`, `env`
**Allow (git read-only):** `git status`, `git log`, `git diff`, `git branch`, `git show`
**Block (side-effects):** `write`, `edit`, `bash` (other commands), `git` (write operations)

This lets the agent "look but don't touch" until context is confirmed.

### Operational Profiles

| Profile | Verification Level | Use Case |
|---------|-------------------|----------|
| `ultrathink` | Full (build/test/lint) | Features, refactoring |
| `quick` | Minimal | Typos, comments |
| `expert` | User reviews | Trusted changes |
| `collab` | Discuss first | Architecture |

### Context Persistence

Setu saves understanding to `.setu/`:

```
.setu/
├── context.md     # Human-readable (for review)
├── context.json   # Machine-parseable (for injection)
└── verification.log  # Audit trail
```

Context is:
- Collected during Phase 0 (files read, patterns found)
- Persisted when `setu_context` is called
- Injected into subagent prompts automatically
- Loaded on new session start for continuity

### State Management

- Operational profile persists for session until changed
- Context persists across sessions (`.setu/` directory)
- Attempt counter resets on success or user guidance
- After 2 failed attempts → ask for guidance, don't retry

### Parallel Execution

Always use parallel tool calls when possible:

```typescript
// GOOD: Parallel reads
read("src/index.ts")
read("src/hooks/tool-execute.ts")  // Same message
read("package.json")

// BAD: Serial reads
read("src/index.ts")  // Message 1
// wait for response
read("src/hooks/tool-execute.ts")  // Message 2
// wait for response
read("package.json")  // Message 3
```

## Git Workflow

- **Always ask before committing**: Do not commit without explicit user approval
- **Always ask before pushing**: Do not push without explicit user approval
- **Commit style**: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)

## Testing Strategy

### Test Environment

A test folder exists at `./tests/` within the repo (gitignored):
- `opencode.json` configured to load the plugin from `dist/`
- Uses `opencode/big-pickle` model (free tier)

### Testing Steps

1. Build plugin: `bun run build`
2. Navigate to test folder: `cd tests`
3. Start OpenCode: `opencode`
4. Verify Setu appears in Tab cycle
5. Test Phase 0 blocking (try to write before context confirmed)
6. Test context persistence (check `.setu/` directory)
7. Test verification flow
8. Verify token efficiency

## Files to Never Modify Without Asking

- `package.json` (dependencies, versions)
- `tsconfig.json` (compiler settings)
- `.gitignore` (tracked files)

## Files Safe to Modify

- `src/**/*.ts` (implementation)
- `skills/**/*.md` (skill definitions)
- `README.md`, `ROADMAP.md` (documentation)
- `docs/**/*.md` (documentation)

## Interoperability

### With OpenCode

Setu is a primary agent. OpenCode's Plan/Build remain accessible via Tab.
- In Setu mode: Full enforcement
- In Plan mode: Setu hooks defer to OpenCode
- In Build mode: Light enforcement

### With Other Plugins

When other discipline plugins are detected:
- Setu enters minimal mode
- Defers context injection to the other plugin
- Focuses on Phase 0 and verification only
- Avoids conflicting with other plugin directories

---

## Implementation Guide

### For New Sessions: Where to Start

If you're starting a new session to implement Setu features, follow this order:

#### Phase 1: Setu as Primary Agent (v1.0 Critical)

| Step | File to Create/Modify | What to Do |
|------|----------------------|------------|
| 1.1 | `src/agent/setu-agent.ts` | Create function to generate `.opencode/agent/setu.md` at plugin init |
| 1.2 | `src/index.ts` | Add `config` hook to set `default_agent: "setu"` |
| 1.3 | `src/hooks/chat-message.ts` | Add agent tracking (store current agent per session) |
| 1.4 | `src/hooks/tool-execute.ts` | Add mode-aware enforcement (check agent before blocking) |

**Key Code Pattern for 1.1 (Agent Config)**:
```typescript
// src/agent/setu-agent.ts
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SETU_AGENT_CONFIG = `---
mode: primary
color: "#2ECC71"
description: Setu disciplined mode - context first, verify always
permission:
  edit:
    "*": ask
  bash:
    "*": ask
---

You are Setu, a disciplined AI coding assistant...
`;

export async function createSetuAgent(projectDir: string): Promise<void> {
  const agentDir = join(projectDir, '.opencode', 'agent');
  const agentPath = join(agentDir, 'setu.md');
  
  if (!existsSync(agentDir)) {
    mkdirSync(agentDir, { recursive: true });
  }
  
  if (!existsSync(agentPath)) {
    writeFileSync(agentPath, SETU_AGENT_CONFIG);
    console.log('[Setu] Created .opencode/agent/setu.md');
  }
}
```

#### Phase 2: Context Persistence (v1.0 Critical)

| Step | File to Create/Modify | What to Do |
|------|----------------------|------------|
| 2.1 | `src/context/types.ts` | Define `SetuContext` interface |
| 2.2 | `src/context/storage.ts` | Implement read/write for `.setu/` files |
| 2.3 | `src/tools/setu-context.ts` | Enhance to persist context on confirmation |
| 2.4 | `src/hooks/tool-execute.ts` | Inject context into subagent prompts (task tool) |
| 2.5 | `src/hooks/event.ts` | Load existing context on session start |

**Key Code Pattern for 2.2 (Storage)**:
```typescript
// src/context/storage.ts
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { SetuContext } from './types';

const SETU_DIR = '.setu';

export function ensureSetuDir(projectDir: string): string {
  const setuDir = join(projectDir, SETU_DIR);
  if (!existsSync(setuDir)) {
    mkdirSync(setuDir, { recursive: true });
  }
  return setuDir;
}

export function writeContext(projectDir: string, context: SetuContext): void {
  const setuDir = ensureSetuDir(projectDir);
  
  // Write JSON (machine-parseable)
  writeFileSync(
    join(setuDir, 'context.json'),
    JSON.stringify(context, null, 2)
  );
  
  // Write Markdown (human-readable)
  writeFileSync(
    join(setuDir, 'context.md'),
    generateContextMarkdown(context)
  );
}

export function loadContext(projectDir: string): SetuContext | null {
  const contextPath = join(projectDir, SETU_DIR, 'context.json');
  if (!existsSync(contextPath)) return null;
  return JSON.parse(readFileSync(contextPath, 'utf-8'));
}
```

#### Phase 3: Parallel Execution (v1.0 Important)

| Step | File to Modify | What to Do |
|------|----------------|------------|
| 3.1 | `src/prompts/persona.ts` | Add parallel execution guidance section |
| 3.2 | `src/prompts/persona.ts` | Add `[SETU:]` prefix to all injections |

#### Phase 4: Other Plugin Detection (v1.0 Nice-to-have)

| Step | File to Create/Modify | What to Do |
|------|----------------------|------------|
| 4.1 | `src/detection/plugins.ts` | Detect other discipline plugins |
| 4.2 | `src/index.ts` | Enter minimal mode if other plugin detected |

### Reference: Existing Files

Before implementing, read these existing files:
- `src/index.ts` - Current plugin entry point
- `src/hooks/tool-execute.ts` - Current Phase 0 implementation
- `src/enforcement/phase-zero.ts` - Blocking logic
- `src/tools/setu-context.ts` - Current context confirmation tool

### Reference: OpenCode Plugin API

Key hooks used:
- `config` - Modify OpenCode config (set default_agent)
- `chat.message` - Track current agent from messages
- `tool.execute.before` - Intercept before tool execution
- `tool.execute.after` - Track verification/context gathering
- `event` - Handle session lifecycle events
- `experimental.chat.system.transform` - Inject persona into system prompt

### Success Criteria

After implementation, verify:
1. Setu appears in Tab cycle (Tab → Setu → Build → Plan)
2. Setu is default on fresh OpenCode start
3. Phase 0 blocks in Setu mode, defers in Plan mode
4. Context persists to `.setu/` directory
5. Context loads on session start
6. Context injects into subagent prompts

---

## MCP Tools

MCP (Model Context Protocol) servers extend capabilities. Use the right tool for the right job.

### Available MCP Tools

| Tool | When to Use | Rules |
|------|-------------|-------|
| **Context7** | Code/library context, API verification, function signatures | Prefer over memory. Never hallucinate APIs if Context7 can verify. |
| **Exa** (`web_search_exa`) | Web search, docs, blogs, discussions, fresh info | The ONLY search tool. Summarize findings, cite sources. |
| **Firecrawl** | Scraping a specific known URL | Never use for search. If URL unknown → use Exa first. Treat as expensive. |
| **Zread** | Long-form reading (PDFs, specs, RFCs) | Use before summarizing large inputs. Accuracy > brevity. |

### Tool Selection Order

1. **Code or library question?** → Context7
2. **Search or discovery needed?** → Exa
3. **Known URL to fetch?** → Firecrawl
4. **Large or dense content?** → Zread

*Pattern: Search → Fetch → Read → Explain*

### Prohibited

- Hallucinating APIs or web content
- Using Firecrawl as a search engine
- Skipping tools when they're applicable
- Guessing URLs (use Exa to find them first)

---

## Target Personas

Setu serves different users differently:

| Persona | What They Need | Setu Value |
|---------|----------------|------------|
| **Junior Dev** | Guidance without feeling blocked | "AI that thinks before acting" |
| **Senior Dev** | Speed without sacrificing quality | "Enforcement without friction" |
| **Tech Lead** | Predictable agent behavior | "Consistent agent behavior" |
| **PM** | Features that ship working | "Features that actually work" |
| **Startup Founder** | Fast iteration, no wasted cycles | "Stop burning tokens on wrong approaches" |
| **AI Engineer** | Discipline layer for their tools | "Add discipline to your own tools" |

---

## OpenCode Reference

When working within OpenCode, these docs may be helpful:

| Topic | URL |
|-------|-----|
| Agents (Primary/Subagent) | https://opencode.ai/docs/agents |
| Plugins (Hooks, Tools) | https://opencode.ai/docs/plugins |
| Permissions (Ask/Allow/Deny) | https://opencode.ai/docs/permissions |
| Skills (SKILL.md format) | https://opencode.ai/docs/skills |
| Rules (AGENTS.md) | https://opencode.ai/docs/rules |

### Key OpenCode Concepts

- **Tab** cycles between primary agents (Plan, Build, Setu)
- **@mention** invokes subagents
- **Permissions** can be `ask`, `allow`, or `deny` per tool/pattern
- **Skills** are loaded on-demand via the `skill` tool
- **Plugins** can hook into `tool.execute.before`, `session.compacting`, etc.
