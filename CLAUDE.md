# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
  - `src/services/`: API clients (`claude.ts`, `codex.ts`), OAuth flows, MCP integration, analytics stubs (telemetry removed)
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