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
| `tool.execute.before` | Hydration Gate + gear-based enforcement |
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
| **Setu** | Full enforcement: Hydration Gate + gears + discipline guards + verification + context persistence |
| **Build** | Light enforcement: Verification reminders, context tracking |
| **Plan** | Deferred: OpenCode handles blocking, Setu tracks context only |

**Why defer in Plan mode?**
- OpenCode's Plan mode already blocks edits via permissions
- Double blocking wastes tokens and confuses logs
- Setu focuses on context gathering instead

---

## Using With Other Plugins

When other discipline plugins are detected, Setu enters **minimal mode**:

### Minimal Mode Behavior

| Feature | With Other Plugin | Without |
|---------|-------------------|---------|
| Context injection | **Disabled** (other plugin handles) | Enabled |
| Auto-inject AGENTS.md | **Disabled** | Enabled |
| Hydration Gate | Enabled | Enabled |
| Gear enforcement | Enabled | Enabled |
| Verification enforcement | Enabled | Enabled |
| Context persistence | Enabled (uses `.setu/`) | Enabled |

### Why Minimal Mode?

When another plugin already handles context injection or orchestration, Setu avoids duplication:
- **Other plugin** handles: Context injection, agent orchestration
- **Setu** handles: Pre-emptive blocking, verification, attempt limits

### Configuration

```json
// In opencode.json
{
  "plugin": ["other-plugin", "setu-opencode"]
}
```

**Load order:** Setu should load last so it can detect other plugins.

---

## Context Persistence

Setu persists context to `.setu/` directory:

```
.setu/
├── context.json      # Machine-parseable for injection
├── active.json       # Current task and constraints
├── RESEARCH.md       # Research findings (gear: scout → architect)
├── PLAN.md           # Implementation plan (gear: architect → builder)
├── HISTORY.md        # Archived artifacts from previous tasks
├── security.log      # Security audit trail
├── verification.log  # Build/test/lint results
└── results/          # Per-step result files
```

This directory is independent and doesn't conflict with other plugins.

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

**How Setu uses it (future):**
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

## Detection Strategy (Future)

In future versions, Setu will auto-detect installed tools and adapt:

| If Detected | Setu Behavior |
|-------------|---------------|
| Other discipline plugins | Enter minimal mode |
| agent-browser | Enable visual verification |
| LSP tools | Use for precision reading |

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
