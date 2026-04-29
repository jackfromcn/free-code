<!-- refreshed: 2026-04-29 -->
# Architecture

**Analysis Date:** 2026-04-29

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      CLI Entry Layer                         │
│              `src/entrypoints/cli.tsx`                       │
│        (fast-path checks, version, bridge, daemon)          │
├──────────────────┬──────────────────┬───────────────────────┤
│   REPL Screen    │   Main.tsx       │    Daemon/Worker      │
│ `src/screens/    │ `src/main.tsx`   │    `src/daemon/`      │
│  REPL.tsx`       │ (commander CLI)  │    (background)       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    State Management                          │
│           `src/state/AppState.tsx`                           │
│           `src/state/AppStateStore.ts`                      │
│           `src/bootstrap/state.ts` (global)                 │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Query Engine                              │
│           `src/QueryEngine.ts`                               │
│           `src/query.ts`                                     │
│     (message flow, tool orchestration, API calls)           │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Tool Registry        │  Command Registry  │  API Services  │
│  `src/tools.ts`       │  `src/commands.ts` │  `src/services/│
│  (Bash, Read, Edit,   │  (/login, /init,   │   api/claude.ts│
│   Agent, MCP, etc)    │   /commit, etc)    │   mcp/)        │
└───────────────────────┴────────────────────┴─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  External Integrations                                       │
│  (Anthropic API, Bedrock, Vertex, MCP servers, IDE bridge)  │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| CLI Entry | Bootstrap entrypoint, fast-path checks for special flags before loading full CLI | `src/entrypoints/cli.tsx` |
| REPL | Main interactive UI loop (Ink/React), handles user input, renders messages | `src/screens/REPL.tsx` |
| Main | Commander CLI setup, argument parsing, mode detection | `src/main.tsx` |
| QueryEngine | Query lifecycle, message flow, tool execution coordination | `src/QueryEngine.ts` |
| Query | Core query loop, tool orchestration, streaming API calls | `src/query.ts` |
| Command Registry | Slash command registration and management | `src/commands.ts` |
| Tool Registry | Agent tool registration and management | `src/tools.ts` |
| AppState | Central React state store for UI | `src/state/AppState.tsx` |
| Bootstrap State | Global runtime state (session ID, model, costs) | `src/bootstrap/state.ts` |

## Pattern Overview

**Overall:** Event-driven React/Ink TUI with streaming API integration

**Key Characteristics:**
- React-based terminal UI using Ink framework
- Generator-based streaming query engine
- Plugin architecture for commands and tools
- Feature flags for compile-time dead code elimination
- Multiple API providers (Anthropic, Bedrock, Vertex, Foundry)

## Layers

**Entry Layer:**
- Purpose: Bootstrap the CLI, handle fast-path flags
- Location: `src/entrypoints/cli.tsx`
- Contains: Version check, bridge mode, daemon mode, special paths
- Depends on: Dynamic imports for lazy loading
- Used by: Process invocation

**Screen Layer:**
- Purpose: Render interactive TUI, handle user input
- Location: `src/screens/REPL.tsx`
- Contains: React components, hooks, message rendering
- Depends on: AppState, QueryEngine, Tools/Commands
- Used by: Main.tsx after CLI setup

**Query Layer:**
- Purpose: Coordinate message flow and API calls
- Location: `src/QueryEngine.ts`, `src/query.ts`
- Contains: Query lifecycle, tool execution, streaming
- Depends on: Tools, Commands, API Services
- Used by: REPL, SDK mode, headless mode

**Registry Layer:**
- Purpose: Register and manage tools and commands
- Location: `src/tools.ts`, `src/commands.ts`
- Contains: Tool definitions, command definitions, availability filters
- Depends on: Tool implementations, Command implementations
- Used by: Query layer, UI layer

**Service Layer:**
- Purpose: External API clients, MCP, OAuth, analytics
- Location: `src/services/`
- Contains: API clients, MCP client, OAuth flows, compacting
- Depends on: External SDKs, config
- Used by: Query layer, Tool implementations

**State Layer:**
- Purpose: Manage application and global state
- Location: `src/state/AppState.tsx`, `src/bootstrap/state.ts`
- Contains: React store, global runtime state
- Depends on: React context
- Used by: All layers

## Data Flow

### Primary Request Path

1. User input submitted via PromptInput (`src/components/PromptInput/PromptInput.js`)
2. Input processed by handlePromptSubmit (`src/utils/handlePromptSubmit.js`)
3. QueryEngine.submitMessage() invoked (`src/QueryEngine.ts:209`)
4. System prompt assembled via fetchSystemPromptParts (`src/utils/queryContext.ts`)
5. Tool pool assembled via assembleToolPool (`src/tools.ts:345`)
6. query() generator invoked (`src/query.ts`)
7. Streaming API call via claude.ts (`src/services/api/claude.ts`)
8. Tool execution via StreamingToolExecutor (`src/services/tools/StreamingToolExecutor.js`)
9. Messages yielded back to REPL for rendering
10. Result yielded with usage/cost data

### Slash Command Flow

1. Slash command detected in user input
2. processUserInput() handles command routing (`src/utils/processUserInput/processUserInput.js`)
3. Local commands execute directly (e.g., `/clear`, `/compact`)
4. Prompt commands expand to system prompt text
5. Local-JSX commands render Ink UI dialogs

### Bridge/Remote Control Flow

1. Bridge mode detected at CLI entry (`src/entrypoints/cli.tsx:122`)
2. bridgeMain() starts WebSocket transport (`src/bridge/bridgeMain.ts`)
3. REPL renders remote status via useReplBridge (`src/hooks/useReplBridge.tsx`)
4. Messages relayed bidirectionally via replBridge transport

**State Management:**
- React state: AppStateStore with zustand-like pattern (`src/state/AppStateStore.ts`)
- Global state: bootstrap/state.ts for runtime metrics
- Session persistence: Transcript files in `~/.claude/session/`

## Key Abstractions

**Tool:**
- Purpose: Represents an agent tool the model can invoke
- Examples: `src/tools/BashTool/BashTool.js`, `src/tools/FileReadTool/FileReadTool.js`
- Pattern: Zod schema validation, execute() method, permission checks

**Command:**
- Purpose: Slash command for user invocation
- Examples: `src/commands/login/index.js`, `src/commands/commit.js`
- Pattern: Three types: 'local' (text output), 'local-jsx' (UI dialog), 'prompt' (model invocation)

**Message:**
- Purpose: Represents conversation history entries
- Examples: `src/types/message.js`
- Pattern: Union type: UserMessage, AssistantMessage, SystemMessage, ProgressMessage, etc.

## Entry Points

**CLI Entry:**
- Location: `src/entrypoints/cli.tsx`
- Triggers: Process invocation via bun/node
- Responsibilities: Fast-path checks, lazy import main.tsx

**REPL Entry:**
- Location: `src/screens/REPL.tsx`
- Triggers: main.tsx after CLI setup
- Responsibilities: Render TUI, handle input, coordinate query

**SDK Entry:**
- Location: `src/QueryEngine.ts`
- Triggers: External SDK callers
- Responsibilities: Headless query execution without UI

**Bridge Entry:**
- Location: `src/bridge/bridgeMain.ts`
- Triggers: `claude remote-control` command
- Responsibilities: WebSocket transport for remote sessions

## Architectural Constraints

- **Threading:** Single-threaded event loop (async/await throughout)
- **Global state:** `src/bootstrap/state.ts` holds session-wide mutable state (sessionId, costs, model)
- **Circular imports:** Lazy require() used to break cycles (e.g., tools.ts -> TeamCreateTool -> tools.ts)
- **Feature flags:** Compile-time DCE via `feature()` from `bun:bundle`

## Anti-Patterns

### Circular Dependency via Lazy Require

**What happens:** tools.ts imports TeamCreateTool/TeamDeleteTool which import back into tools.ts
**Why it's wrong:** Circular dependency causes initialization order issues
**Do this instead:** Use lazy require() with explicit type casting:
```typescript
const getTeamCreateTool = () =>
  require('./tools/TeamCreateTool/TeamCreateTool.js')
    .TeamCreateTool as typeof import('./tools/TeamCreateTool/TeamCreateTool.js').TeamCreateTool
```
See `src/tools.ts:63-68`

### Feature Flag String Leakage

**What happens:** Feature-gated strings appear in external builds
**Why it's wrong:** Security/licensing concerns for ant-only features
**Do this instead:** Keep all feature-gated strings inside conditionally imported modules:
```typescript
const snipModule = feature('HISTORY_SNIP')
  ? (require('./services/compact/snipCompact.js') as typeof import('./services/compact/snipCompact.js'))
  : null
```
See `src/QueryEngine.ts:122-128`

### Large Module Imports at Startup

**What happens:** Heavy modules imported synchronously slow startup
**Why it's wrong:** CLI startup latency impacts user experience
**Do this instead:** Use dynamic import() or lazy require() for heavy modules:
```typescript
const usageReport: Command = {
  type: 'prompt',
  name: 'insights',
  async getPromptForCommand(args, context) {
    const real = (await import('./commands/insights.js')).default
    return real.getPromptForCommand(args, context)
  },
}
```
See `src/commands.ts:190-202`

## Error Handling

**Strategy:** Try-catch with error logging, graceful degradation

**Patterns:**
- API errors: Retry with exponential backoff (`src/services/api/withRetry.js`)
- Tool errors: Error tool_result block, query continues
- Permission errors: PermissionRequest dialog, user can deny/allow
- Fatal errors: exitWithError() terminates process

## Cross-Cutting Concerns

**Logging:** `src/utils/log.js` - logError(), logForDebugging()
**Validation:** Zod schemas for all tool inputs
**Authentication:** `src/utils/auth.js` - OAuth + API key flows
**Permissions:** `src/utils/permissions/` - Permission modes, allow/deny rules
**Analytics:** `src/services/analytics/` - GrowthBook feature gates, event logging

---

*Architecture analysis: 2026-04-29*