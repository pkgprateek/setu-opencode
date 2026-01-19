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

## How It Works

Setu hooks into OpenCode's system layer:

| Hook | Purpose |
|------|---------|
| `system-transform` | Injects lean persona (~500 tokens) |
| `tool.execute.before` | Phase 0 blocking |
| `tool.execute.after` | Tracks verification steps |
| `session.idle` | Enforces verification before completion |

**What Setu doesn't touch:**
- Tool implementations (uses what's available)
- MCP servers (your MCPs work as-is)
- File operations (doesn't modify your workflow)

---

## Using With Other Plugins

```json
// In opencode.json
{
  "plugin": ["your-plugin", "setu-opencode"]
}
```

**Load order:** Setu should load last so it can wrap other plugins' behavior with discipline.

If hooks overlap with another plugin, you may need to disable one or the other. See the other plugin's docs for `disabled_hooks` configuration.

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

**How Setu uses it (v1.1+):**
- Setu auto-detects if agent-browser is installed
- If detected, visual verification becomes available in Default mode
- Token-efficient: Uses a subagent to handle screenshots, keeping main context clean

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

**Note on documentation:** Use context7 for docs lookup (token-efficient). agent-browser can fetch JS-rendered docs as a fallback, but at higher token cost.

---

## Detection (Future)

In a future version, Setu will auto-detect installed tools and adapt:

| If Detected | Setu Behavior |
|-------------|---------------|
| agent-browser | Enable visual verification in Default mode |
| Other discipline plugins | Disable duplicate hooks |
| LSP tools available | Use them for verification |
| Session management tools | Integrate for context hygiene |

For now, Setu stays compatible through non-interference.

---

## Reporting Issues

If Setu conflicts with another plugin:

1. Check if hooks overlap (see above)
2. Try disabling conflicting hooks in the other plugin
3. [Open an issue](https://github.com/pkgprateek/setu-opencode/issues) with:
   - Plugin names and versions
   - Observed behavior
   - Expected behavior

We'll work to ensure compatibility.
