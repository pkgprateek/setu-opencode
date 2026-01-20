---
name: project-patterns
description: Development patterns for contributing to setu-opencode. Use when adding hooks, tools, enforcement logic, or skills to the plugin.
---

# Setu Development Patterns

## When to Use This Skill

Use when:
- Adding new OpenCode hooks
- Creating custom tools
- Implementing enforcement logic
- Writing or updating bundled skills

## Hook Development

### Available Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `experimental.chat.system.transform` | Inject into system prompt | Modified system string |
| `chat.message` | Intercept user messages | Modified message |
| `tool.execute.before` | Block/modify before execution | Continue or throw |
| `tool.execute.after` | Track results after execution | Void |
| `event` | Session lifecycle | Void |

### Hook File Structure

```typescript
// src/hooks/my-hook.ts
import type { ToolExecuteBeforeContext } from '@opencode-ai/plugin';

export function createMyHook(
  // State accessors as parameters
  getState: () => MyState,
  setState: (s: MyState) => void
) {
  return async (ctx: ToolExecuteBeforeContext) => {
    // Hook logic here
  };
}
```

### Key Principles

1. **State via closures**: Pass state accessors to hook factory functions
2. **Explicit return types**: Always declare what the hook returns
3. **Session isolation**: Each session has independent state
4. **Fail gracefully**: Catch errors, log, don't crash the session

## Tool Development

### Tool File Structure

```typescript
// src/tools/my-tool.ts
import type { ToolConfig } from '@opencode-ai/plugin';

export function createMyTool(
  getState: () => State,
  setState: (s: State) => void
): ToolConfig {
  return {
    description: 'What this tool does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: '...' }
      },
      required: ['param1']
    },
    execute: async ({ param1 }) => {
      // Tool logic
      return { result: 'success' };
    }
  };
}
```

### Tool Naming

- Prefix with `setu_` for Setu-specific tools
- Use snake_case (OpenCode convention)
- Examples: `setu_mode`, `setu_verify`, `lsp_symbols`

## Enforcement Logic

### Phase 0 Pattern

Location: `src/enforcement/phase-zero.ts`

```typescript
const READ_ONLY_TOOLS = ['read', 'glob', 'grep'];
const READ_ONLY_BASH = ['ls', 'cat', 'head', 'tail', 'grep', 'find', 'pwd', 'echo', 'which', 'env'];

export function isReadOnlyTool(name: string, args?: unknown): boolean {
  if (READ_ONLY_TOOLS.includes(name)) return true;
  if (name === 'bash' && args && typeof args === 'object') {
    const cmd = (args as { command?: string }).command || '';
    const firstWord = cmd.trim().split(/\s+/)[0];
    return READ_ONLY_BASH.includes(firstWord);
  }
  return false;
}
```

### State Management

- Use `Map<sessionId, SessionState>` for session isolation
- Reset state on session start/end events
- Never persist state across sessions (stateless design)

## Skill Development

### Bundled Skills Location

`skills/<skill-name>/SKILL.md`

### YAML Frontmatter

```yaml
---
name: my-skill
description: Brief description with trigger terms users would naturally say.
---
```

### Writing Guidelines

- Use imperative form ("Run command" not "You should run")
- Keep under 500 lines
- Reference other files for details
- Include examples

## Testing

1. Build: `bun run build`
2. Add to `opencode.json`: `{ "plugin": ["./dist"] }`
3. Start OpenCode session
4. Test the specific feature
5. Check console for `[Setu]` logs

## Common Mistakes to Avoid

1. **Forgetting to export from index**: All hooks/tools must be exported from `src/index.ts`
2. **Blocking read-only tools**: Phase 0 must allow reconnaissance
3. **Shared mutable state**: Always use session-scoped state
4. **Silent failures**: Log errors with `[Setu]` prefix
