# Plugin API Reference

## Architecture Overview

Plugins are **ESM modules** that export a default function matching the `Plugin` type:

```typescript
type Plugin = (input: PluginInput, options?: PluginOptions) => Promise<Hooks>;
```

## PluginInput

```typescript
interface PluginInput {
  client: OpencodeClient;         // SDK client — full API access
  project: Project;
  directory: string;              // Current project directory
  worktree: string;               // Worktree root
  experimental_workspace: { register(type, adaptor): void };
  serverUrl: URL;
  $: BunShell;                    // Bun shell for running commands
}
```

## Hooks Interface (All Optional)

### Tool Registration
```typescript
tool: {
  [key: string]: ToolDefinition;
}
```
Tools are defined using the `tool()` helper or plain objects matching the signature.

### Lifecycle Hooks
| Hook | When | Use Case |
|------|------|----------|
| `chat.message` | New message received | Inject context/nudges, detect keywords |
| `chat.params` | Before LLM call | Modify temperature, topP, etc. |
| `chat.headers` | Before LLM call | Modify request headers |
| `event` | Any system event | Compaction triggers, session idle, message updates |
| `config` | Config loaded | Register slash commands, modify permissions |

### Execution Hooks
| Hook | When | Can Modify |
|------|------|-----------|
| `tool.execute.before` | Before any tool runs | `output.args` |
| `tool.execute.after` | After any tool completes | `output.title`, `output.output`, `output.metadata` |
| `command.execute.before` | Before shell command | `output.parts` |
| `shell.env` | Before shell execution | `output.env` |
| `tool.definition` | When tool schema sent to LLM | `output.description`, `output.parameters` |

### Experimental Hooks
| Hook | Purpose |
|------|---------|
| `experimental.chat.messages.transform` | Transform entire message list before LLM |
| `experimental.chat.system.transform` | Modify system prompt strings |
| `experimental.session.compacting` | Add context/set prompt for compaction |
| `experimental.compaction.autocontinue` | Control auto-continue after compaction |
| `experimental.text.complete` | Text completion hook |

## Tool Registration

```typescript
import { tool } from "@opencode-ai/plugin";

tool({
  description: "Tool description shown to LLM",
  args: {
    name: tool.schema.string().describe("Short name"),
    count: tool.schema.number().optional(),
    mode: tool.schema.enum(["add", "search"]),
  },
  async execute(args, context) {
    // context: { sessionID, messageID, agent, directory, worktree, abort, metadata, ask }
    return "result string";
  }
})
```

The `tool` wrapper validates args via Zod, provides TypeScript inference, and standardizes return types. Tools can also be plain objects matching the shape `{ description, args, execute }` without Zod schemas.

## Synthetic Message Parts

Plugins can inject content into the conversation by pushing synthetic parts:

```typescript
output.parts.push({
  id: `prt_plugin-${Date.now()}`,
  sessionID: input.sessionID,
  messageID: output.message.id,
  type: "text",
  text: "Message content here...",
  synthetic: true
});
```

This is how supermemory injects memory context and nudges — the agent sees them as regular conversation turns.

## Client API (ctx.client)

```typescript
// Sessions
ctx.client.session.list()                                       // List all sessions
ctx.client.session.get({ path: { id: sessionID } })             // Get session details
ctx.client.session.messages({ path: { id }, query: { directory } })  // Get messages
ctx.client.session.message({ path: { sessionID, messageID } })  // Get specific message

// Providers
ctx.client.provider.list()                                      // List LLM providers + models

// Config
ctx.client.config.get()                                         // Get config

// Project
ctx.client.project.current()                                    // Current project info
```

## Plugin Package Structure

```json
{
  "name": "opencode-plugin-name",
  "type": "module",
  "main": "dist/index.js",
  "opencode": {
    "type": "plugin",
    "hooks": ["hook1", "hook2"]
  },
  "dependencies": {
    "@opencode-ai/plugin": "^1.0.0"
  }
}
```

The `opencode.hooks` field is declarative metadata — OpenCode uses it to know which hooks the plugin needs.

## Session Database Schema

Located at `~/.local/share/opencode/opencode.db` (SQLite).

| Table | Key Columns |
|-------|-------------|
| `session` | id, project_id, slug, title, agent, model, cost, time_created, directory |
| `message` | id, session_id, time_created, data (JSON: { role, content, ... }) |
| `part` | id, message_id, session_id, time_created, data (JSON) |
| `session_message` | id, session_id, type, time_created, data (JSON) |
| `project` | id, worktree, name |
| `event` | id, aggregate_id, seq, type, data |
| `todo` | session_id, content, status, priority |

## Key Patterns from Existing Plugins

### Supermemory Plugin
- **Hook**: `chat.message` — on first message per session, injects profile + memories as synthetic context parts
- **Hook**: `event` — monitors `message.updated` for assistant completions to trigger compaction, monitors `session.idle` for compaction on idle
- **Tool**: `supermemory` — CRUD for persistent memories with add/search/profile/list/forget
- **Nudge**: Keyword detection in user message → injects synthetic part telling agent to use the tool

### DCP Plugin
- **Hooks**: `experimental.chat.system.transform`, `experimental.chat.messages.transform`, `chat.message`, `command.execute.before`, `config`
- **Tool**: `compress` — context pruning with message-level or range-level strategies
- **Config**: Registers `/dcp` command, sets permission for `compress` tool, adds to primary_tools

### Conductor Plugin
- **Hook**: `config` — registers slash commands (`conductor:implement`, `conductor:review`, etc.) with prompt templates containing environment context

### Common Patterns
1. **Error-resilient hooks** — all hooks wrap logic in try/catch so failures don't break the agent
2. **Lazy initialization** — check if configured/available before operating
3. **Synthetic parts** — non-intrusive way to communicate state to the agent
4. **Per-session state** — `Map<sessionID, State>` pattern for tracking session-local data
5. **Client API for context** — use `ctx.client.session.messages()` to retrieve conversation history from within tool executions
