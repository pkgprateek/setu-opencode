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
| `config` | Modify OpenCode config (set default_agent) | Void |
| `experimental.chat.system.transform` | Inject into system prompt | Modified system string |
| `chat.message` | Intercept user messages, track current agent | Modified message |
| `tool.execute.before` | Block/modify before execution, inject context | Continue or throw |
| `tool.execute.after` | Track results, file reads, searches | Void |
| `event` | Session lifecycle, load context | Void |
| `experimental.session.compacting` | Inject context into compaction summary | Void |

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

## Recently Added Patterns

### Config Hook (Set Default Agent)

Location: `src/index.ts`

```typescript
config: async (input: { default_agent?: string }) => {
  if (!input.default_agent) {
    input.default_agent = 'setu';
    console.log('[Setu] Set as default agent');
  }
}
```

### Context Collector Pattern

Location: `src/context/storage.ts`

```typescript
export function createContextCollector(projectDir: string): ContextCollector {
  let context: SetuContext = createEmptyContext();
  
  return {
    getContext: () => context,
    recordFileRead: (filePath: string, summary?: string) => { /* ... */ },
    recordSearch: (pattern: string, tool: 'grep' | 'glob', resultCount: number) => { /* ... */ },
    confirm: (summary: string, currentTask: string, plan?: string) => { /* ... */ },
    saveToDisk: () => saveContext(projectDir, context),
    loadFromDisk: () => { /* ... */ }
  };
}
```

### Agent Tracking Pattern

Location: `src/hooks/chat-message.ts`

```typescript
// Track current agent from chat messages
export function createChatMessageHook(
  getModeState: () => ModeState,
  setModeState: (state: ModeState) => void,
  setCurrentAgent: (agent: string) => void
) {
  return async (input: { agent?: string }, output: unknown) => {
    if (input.agent) {
      setCurrentAgent(input.agent);
    }
    // ... mode detection logic
  };
}
```

### Compaction Hook Pattern (Planned)

Location: `src/hooks/compaction.ts`

```typescript
// Inject active task into compaction summary
"experimental.session.compacting": async (input, output) => {
  const activeTask = loadActiveTask(projectDir);
  if (activeTask) {
    output.context.push(`## Active Task (CRITICAL)
Task: ${activeTask.task}
Mode: ${activeTask.mode}
Constraints: ${activeTask.constraints.join(', ')}
IMPORTANT: Resume this task. Do NOT start unrelated work.`);
  }
}
```

Reference: https://opencode.ai/docs/plugins#compaction-hooks

### Feedback Mechanism Pattern

Location: `src/context/feedback.ts`

```typescript
export function appendFeedback(projectDir: string, entry: FeedbackEntry): void {
  const feedbackPath = initializeFeedbackFile(projectDir);
  const entryText = `\n### ${entry.timestamp} - ${entry.type}\n**Description:** ${entry.description}\n`;
  appendFileSync(feedbackPath, entryText, 'utf-8');
}
```

## Reference Links

- OpenCode Plugins: https://opencode.ai/docs/plugins
- OpenCode Agents: https://opencode.ai/docs/agents
- OpenCode Permissions: https://opencode.ai/docs/permissions
- Anthropic Constitution: https://www.anthropic.com/news/claude-new-constitution
