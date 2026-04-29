# Codebase Structure

**Analysis Date:** 2026-04-29

## Directory Layout

```
[project-root]/
├── src/                    # Core source code
│   ├── entrypoints/        # CLI entry points
│   ├── screens/            # Ink/React TUI screens
│   ├── components/         # UI components
│   ├── hooks/              # React hooks
│   ├── services/           # API clients, MCP, analytics
│   ├── state/              # State management
│   ├── tools/              # Agent tool implementations
│   ├── commands/           # Slash command implementations
│   ├── bridge/             # IDE remote-control bridge
│   ├── voice/              # Voice input (feature-gated)
│   ├── skills/             # Skill system
│   ├── plugins/            # Plugin system
│   ├── tasks/              # Background task management
│   ├── coordinator/        # Multi-agent coordination
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── bootstrap/          # Startup state
│   ├── ink/                # Ink terminal framework
│   └── cli/                # CLI handlers
├── scripts/                # Build scripts
├── assets/                 # Static assets
├── dist/                   # Compiled output
├── .planning/              # Planning documents
├── package.json            # Package manifest
└── CLAUDE.md               # Project instructions
```

## Directory Purposes

**src/entrypoints/:**
- Purpose: CLI bootstrap entry points
- Contains: `cli.tsx` (main entry), init.ts, agentSdkTypes.ts
- Key files: `cli.tsx` - handles fast-path flags before loading full CLI

**src/screens/:**
- Purpose: Top-level TUI screens
- Contains: REPL.tsx (main interactive loop)
- Key files: `REPL.tsx` - 875KB, main UI with message rendering, input handling

**src/components/:**
- Purpose: UI components for TUI
- Contains: 148 files - dialogs, pickers, message renderers
- Key files: `Messages.tsx`, `Message.tsx`, `PromptInput/`, `permissions/`

**src/hooks/:**
- Purpose: React hooks for state and side effects
- Contains: 85+ hooks for tool permissions, voice, keybindings, etc.
- Key files: `useCanUseTool.tsx`, `useGlobalKeybindings.tsx`, `useReplBridge.tsx`

**src/services/:**
- Purpose: External service clients and internal services
- Contains: API clients, MCP, OAuth, analytics, compacting
- Key files: `api/claude.ts`, `mcp/client.ts`, `analytics/growthbook.ts`

**src/state/:**
- Purpose: Application state management
- Contains: React store and global state
- Key files: `AppState.tsx`, `AppStateStore.ts`, `store.ts`

**src/tools/:**
- Purpose: Agent tool implementations
- Contains: 45+ tool directories
- Key files: `BashTool/`, `FileReadTool/`, `FileEditTool/`, `AgentTool/`

**src/commands/:**
- Purpose: Slash command implementations
- Contains: 60+ command directories/files
- Key files: `login/`, `init.js`, `commit.js`, `mcp/`

**src/bridge/:**
- Purpose: IDE remote-control bridge
- Contains: WebSocket transport, session management
- Key files: `bridgeMain.ts`, `replBridge.ts`, `bridgeApi.ts`

**src/types/:**
- Purpose: TypeScript type definitions
- Contains: Centralized types for messages, permissions, hooks
- Key files: `message.ts`, `permissions.ts`, `hooks.ts`, `command.ts`

**src/utils/:**
- Purpose: Utility functions and helpers
- Contains: 200+ utility files
- Key files: `permissions/`, `model/`, `config.ts`, `auth.ts`

## Key File Locations

**Entry Points:**
- `src/entrypoints/cli.tsx`: CLI bootstrap with fast-path checks
- `src/main.tsx`: Commander CLI setup and REPL launch
- `src/screens/REPL.tsx`: Main interactive TUI screen

**Configuration:**
- `package.json`: Dependencies, scripts, version
- `src/utils/config.ts`: Config loading and saving
- `src/bootstrap/state.ts`: Global runtime state

**Core Logic:**
- `src/QueryEngine.ts`: Query lifecycle coordination
- `src/query.ts`: Core query loop and streaming
- `src/tools.ts`: Tool registry
- `src/commands.ts`: Command registry

**API Integration:**
- `src/services/api/claude.ts`: Anthropic API client
- `src/services/mcp/client.ts`: MCP client
- `src/services/oauth/`: OAuth flows

**Testing:**
- `src/tools/testing/`: Testing permission tool
- Tests are not co-located (no test files in src/)

## Naming Conventions

**Files:**
- TypeScript: `.ts` for logic, `.tsx` for React components
- Commands: `index.ts` in command subdirectory, e.g., `commands/login/index.ts`
- Tools: `ToolName.ts` in tool subdirectory, e.g., `tools/BashTool/BashTool.ts`
- Hooks: `use*.ts` / `use*.tsx`, e.g., `useCanUseTool.tsx`

**Directories:**
- Commands: kebab-case subdirectory, e.g., `commands/install-github-app/`
- Tools: PascalCase subdirectory, e.g., `tools/FileReadTool/`
- Services: lowercase, e.g., `services/analytics/`

**Imports:**
- Use `.js` extension for ESM compatibility: `import { foo } from './module.js'`
- Path aliases: `src/` for absolute imports

## Where to Add New Code

**New Feature:**
- Primary code: Depends on feature type (see below)
- Tests: Not co-located (no test files in src/)

**New Tool:**
- Implementation: `src/tools/NewTool/NewTool.ts`
- Prompt: `src/tools/NewTool/prompt.ts`
- Register in: `src/tools.ts` - add to getAllBaseTools()

**New Command:**
- Implementation: `src/commands/new-command/index.ts`
- Register in: `src/commands.ts` - add to COMMANDS()

**New API Provider:**
- Client: `src/services/api/newProvider.ts`
- Model utils: `src/utils/model/providers.ts`

**New Component:**
- UI component: `src/components/NewComponent.tsx`
- Hook: `src/hooks/useNewHook.tsx`

**Utilities:**
- Shared helpers: `src/utils/newHelper.ts`

**Types:**
- New types: `src/types/newType.ts`
- Re-export from centralized type files

## Special Directories

**src/skills/bundled/:**
- Purpose: Bundled skills shipped with CLI
- Generated: No
- Committed: Yes

**src/plugins/bundled/:**
- Purpose: Bundled plugins shipped with CLI
- Generated: No
- Committed: Yes

**src/types/generated/:**
- Purpose: Generated protobuf types
- Generated: Yes (from protobuf definitions)
- Committed: Yes

**dist/:**
- Purpose: Compiled binary output
- Generated: Yes (by `bun run compile`)
- Committed: No (in gitignore)

**scripts/:**
- Purpose: Build scripts
- Contains: `build.ts` - Bun compile bundler
- Key file: Feature flag handling, MACRO injection

---

*Structure analysis: 2026-04-29*