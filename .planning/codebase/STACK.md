# Technology Stack

**Analysis Date:** 2026-04-29

## Languages

**Primary:**
- TypeScript (ESNext target) - Core CLI and all source code
- JSX (react-jsx) - Terminal UI components using Ink/React

**Secondary:**
- Shell scripts (install.sh) - Installation scripts

## Runtime

**Environment:**
- Bun 1.3.11+ - JavaScript runtime and package manager
- Lockfile: `bun.lock` (present)

**Package Manager:**
- Bun (bundled with project as packageManager)
- Version constraint: bun >= 1.3.11

## Frameworks

**Core:**
- Ink 6.8.0 - React-based CLI UI framework
- React 19.2.4 - UI component library (used with Ink for terminal rendering)
- react-reconciler 0.33.0 - React reconciler for Ink integration

**Build:**
- Bun build --compile - Native binary compilation
- Feature flags via Bun's `feature()` function for compile-time dead code elimination
- Scripts: `scripts/build.ts` - Custom build orchestrator with feature flag support

**Testing:**
- Bun test (built-in) - Test runner via bun:bundle

## Key Dependencies

**AI/ML Providers (SDKs):**
- @anthropic-ai/sdk 0.80.0 - Primary Anthropic Claude API client
- @anthropic-ai/bedrock-sdk 0.26.4 - AWS Bedrock integration
- @anthropic-ai/foundry-sdk 0.2.3 - Microsoft Azure Foundry integration
- @anthropic-ai/vertex-sdk 0.14.4 - Google Vertex AI integration
- @anthropic-ai/claude-agent-sdk 0.2.87 - Claude Agent SDK for tool execution
- @anthropic-ai/mcpb 2.1.2 - Model Context Protocol server
- @anthropic-ai/sandbox-runtime 0.0.44 - Sandboxed execution environment

**AWS/Infrastructure:**
- @aws-sdk/client-bedrock 3.1020.0 - AWS Bedrock client
- @aws-sdk/client-bedrock-runtime 3.1020.0 - Bedrock runtime
- @aws-sdk/client-sts 3.1020.0 - AWS STS for credentials
- @aws-sdk/credential-provider-node 3.972.28 - Node.js credential providers
- @aws-sdk/credential-providers 3.1020.0 - AWS credential providers

**Google Cloud:**
- google-auth-library 10.6.2 - GCP authentication for Vertex AI
- @azure/identity 4.13.1 - Azure AD authentication for Foundry

**MCP (Model Context Protocol):**
- @modelcontextprotocol/sdk 1.29.0 - MCP client and server SDK
- VS Code protocol: vscode-jsonrpc 8.2.1, vscode-languageserver-protocol 3.17.5

**CLI/UI:**
- chalk 5.6.2 - Terminal string styling
- cli-highlight 2.1.11 - Syntax highlighting in terminal
- cli-boxes 4.0.1 - ASCII boxes for CLI
- asciichart 1.5.25 - ASCII charts
- figures 6.1.0 - Emoji/unicode decorations
- wrap-ansi 10.0.0 - ANSI wrapper utilities
- strip-ansi 7.2.0 - ANSI strip utilities
- supports-hyperlinks 4.4.0 - Terminal hyperlink support

**Data Processing:**
- yaml 2.8.3 - YAML parsing
- jsonc-parser 3.3.1 - JSONC parsing
- semver 7.7.4 - Semantic versioning
- plist 3.1.0 - Property list parsing
- diff 8.0.4 - Diff computation
- lodash-es 4.17.23 - Utility functions

**File/Network:**
- axios 1.14.0 - HTTP client
- undici 7.24.6 - HTTP client (fetch replacement)
- https-proxy-agent 8.0.0 - HTTPS proxy support
- ws 8.20.0 - WebSocket client
- chokidar 5.0.0 - File watching
- ignore 7.0.5 - .gitignore parsing
- picomatch 4.0.4 - Glob matching

**Development:**
- @types/bun 1.3.11 - Bun type definitions
- typescript 6.0.2 - TypeScript compiler

**Utilities:**
- zod 4.3.6 - Schema validation
- ajv 8.18.0 - JSON Schema validation
- marked 17.0.5 - Markdown parsing
- turndown 7.2.2 - HTML to Markdown conversion
- qrcode 1.5.4 - QR code generation
- sharp 0.34.5 - Image processing
- fflate 0.8.2 - Fast compression
- execa 9.6.1 - Process execution
- signal-exit 4.1.0 - Exit signal handling
- tree-kill 1.2.2 - Process tree killing

**Observability:**
- @opentelemetry/api 1.9.1 - OpenTelemetry API
- @opentelemetry/sdk-logs 0.214.0 - Logs SDK
- @opentelemetry/sdk-metrics 2.6.1 - Metrics SDK
- @opentelemetry/sdk-trace-base 2.6.1 - Tracing SDK
- Various OTEL exporters (grpc, http, proto, prometheus)

**Feature Flags:**
- @growthbook/growthbook 1.6.5 - Feature flagging (GrowthBook)

**Other:**
- fuse.js 7.1.0 - Fuzzy search
- xss 1.0.15 - XSS sanitization
- usehooks-ts 3.1.1 - React hooks utilities
- xxdhash-wasm 1.1.0 - Fast hashing

## Configuration

**Environment:**
- Environment variables via `process.env`
- Config directory: `~/.claude` (customizable via CLAUDE_CONFIG_DIR)
- No .env file committed (not detected in project)

**Build Configuration:**
- `tsconfig.json` - TypeScript configuration
  - ESNext target, Preserve module format
  - verbatimModuleSyntax enabled
  - JSX: react-jsx
  - Path alias: `src/*` maps to `src/*`
- `scripts/build.ts` - Build orchestrator with feature flag support
- `package.json` - Project metadata and dependencies

**Build-time Defines (injected via --define):**
- `process.env.USER_TYPE`: "external" (for external builds)
- `MACRO.VERSION`: Injected version string
- `MACRO.BUILD_TIME`: Build timestamp
- `MACRO.PACKAGE_URL`: Package name
- Various feature flag conditionals

## Platform Requirements

**Development:**
- Bun 1.3.11+
- Node.js (for some native modules)
- Git (for version detection in dev builds)

**Production:**
- Native binary (built via `bun build --compile`)
- No runtime dependencies (standalone executable)
- Platform: macOS/Linux (Windows via WSL or future builds)

## Key Architectural Patterns

**Entry Point:**
- `src/entrypoints/cli.tsx` - CLI bootstrap with fast-path checks
- `src/main.tsx` - Main interactive UI loop
- `src/screens/REPL.tsx` - REPL screen (Ink/React)

**Command Registry:**
- `src/commands.ts` - Registers slash commands
- Implementations in `src/commands/`

**Tool Registry:**
- `src/tools.ts` - Registers agent tools with Zod schemas
- Implementations in `src/tools/`

**Query Engine:**
- `src/QueryEngine.ts` - Coordinates message flow, tool use, compaction

---

*Stack analysis: 2026-04-29*