---
title: Interoperability
description: How Setu works with other OpenCode modes, plugins, and supporting tools.
---

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
| `system-transform` | Injects runtime state (gear, context, contracts, task continuity) |
| `chat.message` | Tracks current agent for mode-aware behavior |
| `tool.execute.before` | Hydration Gate + gear-based enforcement |
| `tool.execute.after` | Tracks verification steps |
| `config` | Sets Setu as default agent when user default is unset |
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
| **Build** | No Setu runtime tool gating; OpenCode mode behavior applies |
| **Plan** | No Setu runtime tool gating; OpenCode mode behavior applies |

**Why defer in Plan mode?**
- OpenCode's Plan mode already blocks edits via permissions
- Double blocking wastes tokens and confuses logs
- Setu focuses on context gathering instead

---

## Using With Other Plugins

Setu is designed to coexist with other plugins, but there is no special auto-switch "minimal mode" in current runtime.

### Recommended configuration

```json
// In opencode.json
{
  "plugin": ["other-plugin", "setu-opencode"]
}
```

Load order guidance:

- Prefer loading Setu after broad orchestration plugins.
- Validate behavior in your environment with a short smoke test.
- If plugin behavior conflicts, isolate by running Setu-only first.

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

Potential future direction is adaptive behavior based on installed tools/plugins.
Today, compatibility is achieved through explicit mode and configuration choices.

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

---

## Documentation Navigation

For full product documentation, see:

- [Docs Home](./index.md)
- [Getting Started](./getting-started.md)
- [Configuration](./configuration.md)
- [Tools Reference](./reference/tools.md)
- [Docs Publishing Pipeline](./recipes/docs-publishing.md)
