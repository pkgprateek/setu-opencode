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

## Tested Companions

### oh-my-opencode

[oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) is a feature-rich OpenCode plugin with multi-agent orchestration, LSP tools, and extensive hooks.

**How they work together:**

| OMOC Provides | Setu Adds |
|---------------|-----------|
| Multiple specialized agents | Verification before delegation |
| LSP refactoring tools | Verification after refactoring |
| Background agent execution | Phase 0 context check before spawning |
| "Ultrawork" mode (max effort) | Operating modes (match effort to task) |
| Todo continuation | Build/test/lint verification |

**Configuration:**

When using both, some hooks may overlap. Recommended config:

```json
// In oh-my-opencode.json
{
  "disabled_hooks": [
    // Let Setu handle these
    "todo-continuation-enforcer"
  ]
}
```

```json
// In opencode.json
{
  "plugin": ["oh-my-opencode", "setu-opencode"]
}
```

**Load order matters**: Setu should load after OMOC so it can wrap OMOC's behavior with discipline.

---

### Recommended MCPs

Setu doesn't bundle MCPs (keeps the plugin lean), but these work well:

| MCP | Purpose | Cost |
|-----|---------|------|
| [context7](https://github.com/upstash/context7) | Official documentation lookup | Free |
| [grep.app](https://grep.app) | GitHub code search | Free |
| [Exa](https://exa.ai) | Web search | Requires API key |

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

### Any OpenCode Plugin

Setu is designed to be non-interfering. It works with any plugin that follows OpenCode's plugin API.

**What Setu hooks:**
- `system-transform` — Injects lean persona (~500 tokens)
- `chat.message` — Detects mode switches
- `tool.execute.after` — Tracks verification steps
- `session.idle` — Enforces verification before completion

**What Setu doesn't touch:**
- Tool implementations (uses what's available)
- MCP servers (your MCPs work as-is)
- File operations (doesn't modify your workflow)

---

## Detection (Future)

In a future version, Setu will auto-detect installed plugins and adapt:

| If Detected | Setu Behavior |
|-------------|---------------|
| OMOC present | Disable duplicate hooks, leverage OMOC's LSP |
| Custom LSP tools | Use them for verification |
| Session tools | Integrate for context hygiene |

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
