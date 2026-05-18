# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Common commands

```bash
# Install dependencies
bun install

# Standard build (./cli)
bun run build

# Dev build (./cli-dev)
bun run build:dev

# Dev build with all experimental features (./cli-dev)
bun run build:dev:full

# Compiled build (./dist/cli)
bun run compile

# Run from source without compiling
bun run dev

# Build with specific feature flags
bun run ./scripts/build.ts --feature=ULTRAPLAN --feature=ULTRATHINK
```

Run the built binary with `./cli` or `./cli-dev`. Set `ANTHROPIC_API_KEY` in the environment or use OAuth via `./cli /login`.

## Model providers

This fork supports multiple API providers. Set the corresponding environment variable to switch:

| Provider | Env Variable | Auth Method |
|---|---|---|
| Anthropic (default) | — | `ANTHROPIC_API_KEY` or OAuth |
| OpenAI Codex | `CLAUDE_CODE_USE_OPENAI=1` | OAuth via OpenAI |
| AWS Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` | AWS credentials |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` | `gcloud` ADC |
| Anthropic Foundry | `CLAUDE_CODE_USE_FOUNDRY=1` | `ANTHROPIC_FOUNDRY_API_KEY` |

## High-level architecture

- **Entry point**: `src/entrypoints/cli.tsx` bootstraps the CLI with fast-path checks for `--version`, bridge mode, daemon mode, etc. before loading the full CLI. The main interactive UI loop is in `src/screens/REPL.tsx` (Ink/React).
- **Command registry**: `src/commands.ts` registers slash commands (e.g., `/login`, `/init`, `/commit`). Commands are typed as `local`, `local-jsx`, or `prompt`. Implementations live in `src/commands/`.
- **Tool registry**: `src/tools.ts` registers agent tools (Bash, Read, Edit, Agent, etc.). Tools are constructed with Zod schemas for parameter validation. Implementations live in `src/tools/`.
- **Query engine**: `src/QueryEngine.ts` coordinates message flow, tool use, compaction, and model invocation. It handles streaming responses, permission requests, and tool execution.
- **Core subsystems**:
  - `src/services/`: API clients (`Codex.ts`, `codex.ts`), OAuth flows, MCP integration, analytics stubs (telemetry removed)
  - `src/state/AppState.ts`: central app state store using React context
  - `src/hooks/`: React hooks for UI components and flow control
  - `src/components/`: Ink/React terminal UI components
  - `src/skills/`: skill system (prompt-based commands that the model can invoke)
  - `src/plugins/`: plugin system for extending capabilities
  - `src/bridge/`: IDE remote-control bridge (VS Code, JetBrains)
  - `src/voice/`: voice input and dictation
  - `src/tasks/`: background task management
  - `src/utils/model/`: model configs, provider selection, validation

## Build system

`scripts/build.ts` is the build script and feature-flag bundler using `bun build --compile`. Feature flags are set via:
- Build arguments: `--feature=ULTRAPLAN --feature=ULTRATHINK`
- Presets: `--feature-set=dev-full` (all 54 experimental flags)

Flags use Bun's `feature()` function for compile-time dead code elimination. See `FEATURES.md` for the full audit of 88 flags and their status.

## Feature flags

Key experimental flags (enabled in `build:dev:full`):
- `ULTRAPLAN`: remote multi-agent planning
- `ULTRATHINK`: deep thinking mode
- `VOICE_MODE`: push-to-talk voice input (default in all builds)
- `BRIDGE_MODE`: IDE remote-control
- `AGENT_TRIGGERS`: local cron/trigger tools
- `TOKEN_BUDGET`: token tracking and warnings

## Code style notes

- TypeScript with `verbatimModuleSyntax` and JSX compile target `react-jsx`
- Imports use `.js` extension for ESM compatibility
- Conditional imports for feature-gated code use dynamic `require()` with `/* eslint-disable @typescript-eslint/no-require-imports */` comments
- Biome for linting (custom rules in config)

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **free-code** (50639 symbols, 69308 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/free-code/context` | Codebase overview, check index freshness |
| `gitnexus://repo/free-code/clusters` | All functional areas |
| `gitnexus://repo/free-code/processes` | All execution flows |
| `gitnexus://repo/free-code/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |
| Work in the Plugins area (211 symbols) | `.claude/skills/generated/plugins/SKILL.md` |
| Work in the Bash area (155 symbols) | `.claude/skills/generated/bash/SKILL.md` |
| Work in the Mcp area (148 symbols) | `.claude/skills/generated/mcp/SKILL.md` |
| Work in the Components area (141 symbols) | `.claude/skills/generated/components/SKILL.md` |
| Work in the Hooks area (140 symbols) | `.claude/skills/generated/hooks/SKILL.md` |
| Work in the Ink area (124 symbols) | `.claude/skills/generated/ink/SKILL.md` |
| Work in the Bridge area (118 symbols) | `.claude/skills/generated/bridge/SKILL.md` |
| Work in the Permissions area (110 symbols) | `.claude/skills/generated/permissions/SKILL.md` |
| Work in the Api area (90 symbols) | `.claude/skills/generated/api/SKILL.md` |
| Work in the Sdk area (84 symbols) | `.claude/skills/generated/sdk/SKILL.md` |
| Work in the Services area (75 symbols) | `.claude/skills/generated/services/SKILL.md` |
| Work in the Yoga-layout area (54 symbols) | `.claude/skills/generated/yoga-layout/SKILL.md` |
| Work in the PowerShellTool area (54 symbols) | `.claude/skills/generated/powershelltool/SKILL.md` |
| Work in the Model area (52 symbols) | `.claude/skills/generated/model/SKILL.md` |
| Work in the BashTool area (50 symbols) | `.claude/skills/generated/bashtool/SKILL.md` |
| Work in the Analytics area (48 symbols) | `.claude/skills/generated/analytics/SKILL.md` |
| Work in the Vim area (45 symbols) | `.claude/skills/generated/vim/SKILL.md` |
| Work in the NativeInstaller area (44 symbols) | `.claude/skills/generated/nativeinstaller/SKILL.md` |
| Work in the Swarm area (40 symbols) | `.claude/skills/generated/swarm/SKILL.md` |
| Work in the ComputerUse area (33 symbols) | `.claude/skills/generated/computeruse/SKILL.md` |

<!-- gitnexus:end -->
