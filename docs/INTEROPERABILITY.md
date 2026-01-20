# Interoperability

> Setu is a discipline layer, not a replacement for your tools.

---

## Philosophy

Other plugins give you **more tools**. Setu ensures you **use tools correctly**.

This means Setu:
- Works alongside existing plugins
- Adds verification without interfering
- Enhances rather than replaces

---

## Setu as Primary Agent

Setu registers as a **primary agent** in OpenCode, appearing in the Tab cycle:

```
Tab → Setu (default) → Build → Plan → (cycle)
```

**Benefits:**
- Permission-based blocking (CANNOT edit, not just "doesn't edit")
- Clear user experience (you know when you're in Setu mode)
- Easy escape hatch (Tab to Build if needed)
- No conflicts (doesn't interfere with Plan/Build modes)

---

## How It Works

Setu uses both **permissions** (agent-level) and **hooks** (plugin-level):

### Permission System (Agent-Level)

When in Setu mode, the agent has restricted permissions:

```yaml
permission:
  edit:
    "*": ask  # Must ask before editing
  bash:
    "*": ask  # Must ask before bash commands
```

This means the agent **CANNOT** freely edit - OpenCode enforces this.

### Hook System (Plugin-Level)

| Hook | Purpose |
|------|---------|
| `system-transform` | Injects lean persona (~500 tokens) |
| `chat.message` | Tracks current agent for mode-aware behavior |
| `tool.execute.before` | Phase 0 blocking (until context confirmed) |
| `tool.execute.after` | Tracks verification steps |
| `config` | Sets Setu as default agent, creates agent file |
| `event` | Handles session lifecycle, context loading |

**Why both?**
- Permissions provide hard blocking (CANNOT bypass)
- Hooks provide intelligence (context tracking, injection)

---

## Mode-Aware Behavior

Setu adapts based on which mode the user is in:

| Mode | Setu Behavior |
|------|---------------|
| **Setu** | Full enforcement: Phase 0 + verification + context persistence |
| **Build** | Light enforcement: Verification reminders, context tracking |
| **Plan** | Deferred: OpenCode handles blocking, Setu tracks context only |

**Why defer in Plan mode?**
- OpenCode's Plan mode already blocks edits via permissions
- Double blocking wastes tokens and confuses logs
- Setu focuses on context gathering instead

---

## Using With oh-my-opencode (omoc)

When omoc is detected, Setu enters **minimal mode**:

### Detection

```typescript
// Setu detects omoc via:
const hasOmoc = existsSync('.sisyphus') || existsSync('oh-my-opencode.json');
```

### Minimal Mode Behavior

| Feature | With omoc | Without omoc |
|---------|-----------|--------------|
| Context injection | **Disabled** (omoc handles) | Enabled |
| Auto-inject AGENTS.md | **Disabled** | Enabled |
| Phase 0 blocking | Enabled | Enabled |
| Verification enforcement | Enabled | Enabled |
| Context persistence | Enabled (uses `.setu/`) | Enabled |

### Why Minimal Mode?

omoc is a comprehensive plugin with:
- 30+ hooks for various features
- 10+ specialized agents
- Context injection via directoryAgentsInjector
- Session recovery, todo enforcement, etc.

Setu doesn't duplicate what omoc does well. Instead:
- **omoc** handles: Context injection, agent orchestration, session recovery
- **Setu** handles: Pre-emptive blocking, verification, attempt limits

### Configuration

```json
// In opencode.json
{
  "plugin": ["oh-my-opencode", "setu-opencode"]
}
```

**Load order:** Setu should load after omoc so it can detect omoc's presence.

---

## Context Persistence

Setu persists context to `.setu/` directory:

```
.setu/
├── context.md     # Human-readable understanding
├── context.json   # Machine-parseable for injection
└── verification.log  # Build/test/lint results
```

**With omoc:**
- Setu uses `.setu/` for its context
- omoc uses `.sisyphus/` for its state
- No conflict between directories

---

## Recommended Tools

Setu doesn't bundle external tools (keeps the plugin lean), but these work well:

### agent-browser (Visual Verification)

[agent-browser](https://github.com/vercel-labs/agent-browser) enables AI agents to control a real browser — taking screenshots, reading accessibility trees, and running E2E tests.

**Why it matters:** Setu can finally *see* what it builds instead of asking you to verify visually.

**Installation:**
```bash
npm install -g agent-browser
agent-browser install  # Download Chromium
```

**How Setu uses it (v2.1+):**
- Setu auto-detects if agent-browser is installed
- If detected, visual verification becomes available
- Token-efficient: Uses a subagent to handle screenshots

**Manual usage:**
```bash
agent-browser open http://localhost:3000
agent-browser snapshot -i  # Get accessibility tree with refs
agent-browser screenshot page.png
agent-browser close
```

### Recommended MCPs

| MCP | Purpose | Cost |
|-----|---------|------|
| [context7](https://github.com/upstash/context7) | Official documentation lookup (preferred) | Free |
| [grep.app](https://grep.app) | GitHub code search | Free |

**Installation:**

```json
// In opencode.json
{
  "mcp": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp"]
    }
  }
}
```

---

## Comparison: Setu vs omoc

| Aspect | Setu | omoc |
|--------|------|------|
| **Philosophy** | Discipline layer | Full enhancement platform |
| **Agents** | 1 primary (Setu) + subagents in v2.0 | 10+ specialized agents |
| **Hooks** | ~8 focused hooks | 30+ comprehensive hooks |
| **Context** | `.setu/` directory | `.sisyphus/` directory |
| **Focus** | Pre-emptive blocking, verification | Orchestration, delegation, recovery |
| **Token cost** | ~500 token persona | 1000+ line prompts per agent |
| **Configuration** | Zero-config default | Extensive configuration |

**Use Setu if:**
- You want discipline without complexity
- You prefer lean, focused enforcement
- You want zero-config defaults

**Use omoc if:**
- You want comprehensive orchestration
- You need 10+ specialized agents
- You want extensive customization

**Use both if:**
- You want omoc's orchestration + Setu's verification
- Setu enters minimal mode, adds Phase 0 + verification

---

## Detection Strategy (Future)

In future versions, Setu will auto-detect installed tools and adapt:

| If Detected | Setu Behavior |
|-------------|---------------|
| oh-my-opencode | Enter minimal mode (Phase 0 + verification only) |
| agent-browser | Enable visual verification |
| LSP tools | Use for precision reading |
| Other discipline plugins | Disable duplicate hooks |

For now, Setu stays compatible through mode-awareness and minimal mode.

---

## Reporting Issues

If Setu conflicts with another plugin:

1. Check which mode you're in (Tab to see)
2. Check if hooks overlap (see above)
3. Try Tab to Build to escape Setu enforcement
4. [Open an issue](https://github.com/pkgprateek/setu-opencode/issues) with:
   - Plugin names and versions
   - Current mode (Setu/Build/Plan)
   - Observed behavior
   - Expected behavior

We'll work to ensure compatibility.
