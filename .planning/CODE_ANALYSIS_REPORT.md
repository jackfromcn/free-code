# free-code 代码设计分析报告

**分析日期:** 2026-04-29
**项目:** free-code (Claude Code CLI fork)
**版本:** 2.1.87

---

## 一、整体架构概览

### 1.1 系统架构图

```
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

### 1.2 核心组件职责

| 组件 | 文件 | 职责 |
|------|------|------|
| **CLI Entry** | `src/entrypoints/cli.tsx` | 启动入口，处理快速路径检查（版本、bridge模式、daemon模式） |
| **REPL** | `src/screens/REPL.tsx` | 主交互UI循环（Ink/React），处理用户输入，渲染消息 |
| **QueryEngine** | `src/QueryEngine.ts` | 查询生命周期管理，消息流控制，工具执行协调 |
| **Tool Registry** | `src/tools.ts` | Agent工具注册和管理（Bash, Read, Edit, Agent等） |
| **Command Registry** | `src/commands.ts` | 斜杠命令注册和管理（/login, /init, /commit等） |
| **State** | `src/state/AppState.tsx` | 中央React状态存储 |
| **Bootstrap State** | `src/bootstrap/state.ts` | 全局运行时状态（sessionId, model, costs） |

### 1.3 技术栈

- **运行时:** Bun >= 1.3.11
- **语言:** TypeScript (verbatimModuleSyntax, JSX: react-jsx)
- **终端UI:** React 19 + Ink 6
- **CLI解析:** Commander.js
- **Schema验证:** Zod v4
- **代码搜索:** ripgrep (bundled)
- **协议:** MCP, LSP
- **API:** Anthropic Messages, OpenAI Codex, AWS Bedrock, Google Vertex AI

---

## 二、关于随机数/降低模型命中率的调查

### 2.1 调查结论：**没有发现故意降低模型命中率的代码**

经过对代码库的全面搜索和分析，以下是发现的所有 `random` 相关使用场景：

#### 2.1.1 randomUUID 的使用（仅用于标识符生成）

所有 `randomUUID` 的使用都是为了生成唯一标识符，**与模型响应无关**：

| 文件 | 用途 |
|------|------|
| `src/services/api/claude.ts` | 生成消息UUID、请求ID |
| `src/services/api/client.ts` | 生成客户端请求ID |
| `src/QueryEngine.ts` | 生成消息UUID |
| `src/services/api/filesApi.ts` | 生成multipart边界字符串 |

#### 2.1.2 Math.random 的使用

| 文件 | 代码 | 用途 |
|------|------|------|
| `src/services/api/withRetry.ts:598` | `Math.random() * 0.25 * baseDelay` | 重试抖动(jitter)，防止请求同步 |
| `src/services/api/promptCacheBreakDetection.ts:23` | `chars[Math.floor(Math.random() * chars.length)]` | 生成缓存断开检测的临时文件名后缀 |

#### 2.1.3 未发现的敏感参数

在API调用路径（`src/services/api/claude.ts`）中，**没有发现以下参数的设置**：

- ❌ `temperature` - 温度参数（控制随机性）
- ❌ `seed` - 种子参数（控制可重复性）
- ❌ `top_p` - 核采样参数
- ❌ `top_k` - Top-K采样参数

这些参数在代码中**完全不涉及**，API调用使用的是默认值。

### 2.2 API调用流程分析

```
用户输入 → processUserInput → QueryEngine.submitMessage
    → query() → queryModelWithStreaming (claude.ts)
    → Anthropic API (使用默认采样参数)
```

在 `src/services/api/claude.ts` 中的API请求构建：
- 只设置了 `model`, `messages`, `system`, `tools`, `max_tokens` 等必要参数
- **没有**设置任何影响模型输出随机性的参数
- 使用API的默认采样行为

### 2.3 结论

**代码库中没有故意添加随机数来降低模型命中率的行为。** 所有的随机数使用都是合理的工程实践：
- UUID生成用于标识符
- 抖动(jitter)用于避免重试风暴
- 文件名后缀用于临时文件

---

## 三、上下文大小与自动压缩功能

### 3.1 上下文窗口大小

#### 3.1.1 支持的上下文大小

| 模型 | 默认上下文 | 最大上下文 | 备注 |
|------|-----------|-----------|------|
| Claude Opus 4.6 | 200K | 1M (需启用beta) | 支持 `[1m]` 后缀显式指定 |
| Claude Sonnet 4.6 | 200K | 1M (实验性) | 可通过配置启用 |
| Claude Haiku 4.5 | 200K | 200K | - |
| Claude 3.5/3.7 | 200K | 200K | - |

#### 3.1.2 上下文窗口计算逻辑

```typescript
// src/utils/context.ts
export function getContextWindowForModel(model: string, betas?: string[]): number {
  // 优先级：
  // 1. 环境变量覆盖 (CLAUDE_CODE_MAX_CONTEXT_TOKENS)
  // 2. [1m] 后缀显式指定
  // 3. 模型能力API返回值
  // 4. 1M beta header
  // 5. 实验性配置
  // 6. 默认 200K
}
```

#### 3.1.3 上下文大小限制

- **HIPAA合规:** 可通过 `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` 禁用1M上下文
- **自定义限制:** 可通过 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 设置更小的上下文窗口

### 3.2 自动压缩功能

**是的，Claude Code 有完善的自动压缩系统。**

#### 3.2.1 压缩类型

| 类型 | 文件 | 触发条件 | 功能 |
|------|------|---------|------|
| **Auto Compact** | `src/services/compact/autoCompact.ts` | 上下文超过阈值 | 自动总结对话 |
| **Micro Compact** | `src/services/compact/microCompact.ts` | 工具结果过多 | 清理旧工具结果 |
| **Cached Micro Compact** | `src/services/compact/cachedMicrocompact.ts` | 缓存有效时 | 使用cache_edit API |
| **Time-based MC** | `src/services/compact/microCompact.ts` | 超时后 | 清理过期缓存 |
| **Session Memory** | `src/services/compact/sessionMemoryCompact.ts` | 上下文压力 | 会话记忆压缩 |
| **Snip Compact** | `src/services/compact/snipCompact.ts` | 特定条件 | 快速裁剪 |

#### 3.2.2 自动压缩触发阈值

```typescript
// src/services/compact/autoCompact.ts
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000

export function getAutoCompactThreshold(model: string): number {
  const effectiveContextWindow = getEffectiveContextWindowSize(model)
  // 阈值 = 有效上下文窗口 - 13K buffer
  return effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS
}

// 对于200K上下文：触发阈值约为 187K tokens
// 对于1M上下文：触发阈值约为 987K tokens
```

#### 3.2.3 上下文使用警告级别

```typescript
// src/services/compact/autoCompact.ts
export const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000  // 警告
export const ERROR_THRESHOLD_BUFFER_TOKENS = 20_000    // 错误
export const MANUAL_COMPACT_BUFFER_TOKENS = 3_000      // 手动压缩
```

#### 3.2.4 禁用压缩的方式

```bash
# 完全禁用压缩（包括手动）
DISABLE_COMPACT=1

# 仅禁用自动压缩（保留手动 /compact）
DISABLE_AUTO_COMPACT=1

# 调整自动压缩百分比阈值
CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80  # 在80%时触发
```

#### 3.2.5 压缩流程

```
1. 检查上下文使用量
   └→ tokenCountWithEstimation(messages)

2. 判断是否需要压缩
   └→ shouldAutoCompact() → 计算 tokenCount >= threshold

3. 尝试会话记忆压缩（优先）
   └→ trySessionMemoryCompaction()

4. 回退到传统压缩
   └→ compactConversation()
      ├→ 分析上下文 (analyzeContext)
      ├→ 使用Haiku生成摘要
      ├→ 替换旧消息为摘要
      └→ 创建 compact_boundary 消息

5. 清理后处理
   └→ runPostCompactCleanup()
```

### 3.3 输出Token限制

| 模型 | 默认输出 | 最大输出 |
|------|---------|---------|
| Opus 4.6 | 64K | 128K |
| Sonnet 4.6 | 32K | 128K |
| Haiku 4.5 | 32K | 64K |

压缩操作保留的输出Token：
```typescript
// src/services/compact/autoCompact.ts
const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000  // 压缩摘要最大输出
```

---

## 四、关键发现总结

### 4.1 关于模型公平性

✅ **没有发现故意降低模型命中率的代码**
- API调用使用默认采样参数
- 没有 temperature/seed/top_p/top_k 的任何设置
- 所有随机数使用都是合理的工程实践

### 4.2 关于上下文管理

✅ **有完善的自动压缩系统**
- 多层压缩策略（自动、微压缩、时间触发等）
- 可配置的阈值和禁用选项
- 支持 200K 到 1M 的上下文窗口

### 4.3 关于多模型支持

✅ **支持5种API提供商**
- Anthropic (默认)
- OpenAI Codex
- AWS Bedrock
- Google Vertex AI
- Anthropic Foundry

---

## 五、代码质量观察

### 5.1 设计亮点

1. **清晰的分层架构** - Entry → Screen → Query → Tools/Commands → Services
2. **Feature Flag系统** - 编译时死代码消除，支持实验性功能
3. **插件架构** - 工具和命令都可扩展
4. **流式处理** - Generator-based streaming API

### 5.2 潜在关注点

1. **循环依赖** - 使用 `require()` 延迟加载解决
2. **全局状态** - `src/bootstrap/state.ts` 管理会话级状态
3. **大模块加载** - 建议使用动态导入优化启动性能

---

*报告生成时间: 2026-04-29*
