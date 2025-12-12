# AI Agent 开发教程

> 通过构建 Moles（代码文档生成 Agent）来学习 AI Agent 的核心概念。

---

## 目录

1. [什么是 AI Agent？](#01---什么是-ai-agent)
2. [Tool Use（工具使用）](#02---tool-use工具使用)
3. [Memory（记忆系统）](#03---memory记忆系统)
4. [Planning（规划能力）](#04---planning规划能力)
5. [ReAct 循环](#05---react-循环)
6. [Reflection（反思机制）](#06---reflection反思机制)
7. [Putting Together（整合）](#07---putting-together整合)

---

# 01 - 什么是 AI Agent？

> 本文介绍 AI Agent 的核心概念，以及它与普通 LLM 应用的区别。

## 定义

**AI Agent** 是一个能够自主完成复杂任务的智能系统。它不只是回答问题，而是能够：

1. **感知环境** - 获取外部信息
2. **规划行动** - 制定完成任务的策略
3. **执行操作** - 使用工具与外界交互
4. **反思改进** - 评估结果并调整策略

## Agent vs 普通 LLM 应用

| 特性 | 普通 LLM 应用 | AI Agent |
|------|---------------|----------|
| 交互模式 | 一问一答 | 持续循环直到任务完成 |
| 工具使用 | 无或有限 | 多种工具协作 |
| 任务复杂度 | 单步任务 | 多步骤复杂任务 |
| 自主性 | 被动响应 | 主动规划执行 |
| 记忆 | 无或短期 | 长期记忆和上下文 |

## Agent 的核心组件

```
┌─────────────────────────────────────────────────┐
│                    Agent                        │
│                                                 │
│   ┌───────────┐    ┌───────────┐               │
│   │  Planner  │    │  Memory   │               │
│   │   规划器   │    │   记忆    │               │
│   └───────────┘    └───────────┘               │
│                                                 │
│   ┌───────────┐    ┌───────────┐               │
│   │  Executor │    │ Reflector │               │
│   │   执行器   │    │   反思器   │               │
│   └───────────┘    └───────────┘               │
│                                                 │
│   ┌─────────────────────────────┐              │
│   │          Tools              │              │
│   │     工具（与外界交互）         │              │
│   └─────────────────────────────┘              │
└─────────────────────────────────────────────────┘
```

### 1. Planner（规划器）

规划器负责将复杂任务分解成可执行的步骤。

```typescript
interface Planner {
  createPlan(task: string): Plan;
  adjustPlan(plan: Plan, feedback: Feedback): Plan;
}

interface Plan {
  steps: PlanStep[];
  currentStepIndex: number;
}
```

### 2. Memory（记忆）

记忆让 Agent 能够在长时间任务中保持上下文。

```typescript
interface Memory {
  workingMemory: Map<string, any>;   // 短期记忆
  longTermMemory: Map<string, any>;  // 长期记忆
  store(key: string, value: any): void;
  retrieve(key: string): any;
  summarize(): string;  // 防止 token 溢出
}
```

### 3. Executor（执行器）

执行器实现 ReAct 循环，是 Agent 的"行动中枢"。

```typescript
interface Executor {
  async execute(plan: Plan, memory: Memory): void {
    while (!plan.isComplete()) {
      const thought = await this.think(plan, memory);  // 思考
      const action = await this.act(thought);          // 行动
      const observation = await this.observe(action);  // 观察
      memory.store(action, observation);               // 更新记忆
    }
  }
}
```

### 4. Reflector（反思器）

反思器评估执行结果，决定是否需要继续。

```typescript
interface ReflectionResult {
  isComplete: boolean;
  completeness: number;
  missingAreas: string[];
  suggestions: string[];
}
```

### 5. Tools（工具）

工具是 Agent 与外界交互的接口。

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: Schema;
  execute(params: any): Promise<Result>;
}
```

## Agent 的工作流程

```
开始
  │
  ▼
┌─────────────┐
│   Plan      │  ← 分析任务，制定计划
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Execute   │  ← ReAct 循环执行
│  (ReAct)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Reflect   │  ← 评估结果
└──────┬──────┘
       │
       ▼
    完成了吗？
    /      \
   是       否
   │         │
   ▼         └──→ 调整计划，继续执行
 完成
```

## 为什么需要 Agent？

考虑这个任务："为这个代码仓库生成文档"

**普通 LLM**：只能处理你提供的内容，无法主动探索

**Agent**：
1. 自动分析目录结构
2. 规划阅读顺序
3. 逐个读取文件
4. 理解代码关系
5. 生成结构化文档
6. 检查是否遗漏
7. 补充完善

---

# 02 - Tool Use（工具使用）

> 工具是 Agent 的"手脚"，让它能够与外部世界交互。

## 为什么需要工具？

LLM 本身只能处理文本。但真实任务需要：

- 📂 读取文件
- 🔍 搜索代码
- 🌐 访问网络
- 💾 写入数据
- 🖥️ 执行命令

工具让 LLM 从"只能说"变成"能做事"。

## Tool Use 的工作原理

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   LLM    │ ──→ │  Tool    │ ──→ │  World   │
│  (决策)   │ ←── │ (接口)   │ ←── │  (环境)   │
└──────────┘     └──────────┘     └──────────┘
```

1. LLM 分析任务，决定使用哪个工具
2. LLM 生成工具调用参数
3. 系统执行工具，获取结果
4. 结果返回给 LLM 继续处理

## Claude 的 Tool Use 机制

### 1. 定义工具

```typescript
const tools = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file",
        },
      },
      required: ["path"],
    },
  },
];
```

### 2. 发送请求

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  tools: tools,
  messages: [
    {
      role: "user",
      content: "请读取 package.json 文件",
    },
  ],
});
```

### 3. 处理响应

Claude 会返回 `tool_use` 类型的内容块：

```typescript
[
  {
    type: "text",
    text: "我来读取 package.json 文件。",
  },
  {
    type: "tool_use",
    id: "call_123",
    name: "read_file",
    input: { path: "package.json" },
  },
]
```

### 4. 执行工具并返回结果

```typescript
const result = await fs.readFile("package.json", "utf-8");

const nextResponse = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  tools: tools,
  messages: [
    { role: "user", content: "请读取 package.json 文件" },
    { role: "assistant", content: response.content },
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "call_123",
          content: result,
        },
      ],
    },
  ],
});
```

## Moles 的工具集

| 工具 | 用途 | 示例参数 |
|------|------|----------|
| `list_files` | 列出目录 | `{ path: "src", pattern: "*.ts" }` |
| `read_file` | 读取文件 | `{ path: "src/index.ts" }` |
| `search_code` | 搜索代码 | `{ pattern: "export.*class" }` |
| `write_doc` | 写文档到记忆 | `{ title: "...", content: "..." }` |
| `add_insight` | 记录洞察 | `{ insight: "..." }` |
| `mark_file_analyzed` | 标记已分析 | `{ path: "...", summary: "..." }` |

## 设计工具的最佳实践

### 1. 描述要清晰

```typescript
// ❌ 不好
{ name: "read", description: "Read something" }

// ✅ 好
{ name: "read_file", description: "Read the contents of a file. Returns the full content or a specific line range." }
```

### 2. 参数要有描述

```typescript
// ❌ 不好
properties: { path: { type: "string" } }

// ✅ 好
properties: {
  path: {
    type: "string",
    description: "File path relative to project root",
  },
}
```

### 3. 错误处理要友好

```typescript
// ✅ 好
execute: async (params) => {
  try {
    const content = await fs.readFile(params.path, "utf-8");
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

---

# 03 - Memory（记忆系统）

> 记忆让 Agent 能够在复杂任务中保持连贯性，避免重复劳动。

## 为什么需要记忆？

没有记忆的 Agent 就像金鱼——每次交互都是全新开始。

## 记忆的类型

```
┌─────────────────────────────────────────────────┐
│                   Memory                        │
│                                                 │
│  ┌─────────────────┐  ┌─────────────────┐      │
│  │  Working Memory │  │  Long-term      │      │
│  │  工作记忆        │  │  长期记忆        │      │
│  │  当前任务相关    │  │  跨任务持久化    │      │
│  └─────────────────┘  └─────────────────┘      │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │            Episodic Memory              │   │
│  │            情景记忆                       │   │
│  │  记录发生过什么（执行的操作、遇到的错误）    │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Moles 的记忆设计

```typescript
interface Memory {
  codebaseUnderstanding: string;  // 对代码库的整体理解
  analyzedFiles: AnalyzedFile[];  // 已分析的文件（避免重复）
  documentSections: DocSection[]; // 生成的文档片段
  insights: string[];             // 发现的关键洞察
  directoryStructure: string;     // 目录结构缓存
}

interface AnalyzedFile {
  path: string;
  summary: string;
  exports?: string[];
  dependencies?: string[];
}
```

## 记忆摘要：防止 Context 溢出

LLM 有 context 长度限制。解决方案：**记忆摘要**

```typescript
getSummary(): string {
  const parts: string[] = [];

  // 目录结构（通常较短）
  if (this.memory.directoryStructure) {
    parts.push(`## Directory Structure\n${this.memory.directoryStructure}`);
  }

  // 理解摘要（截取关键部分）
  if (this.memory.codebaseUnderstanding) {
    const understanding = this.memory.codebaseUnderstanding.slice(0, 2000);
    parts.push(`## Understanding\n${understanding}`);
  }

  // 已分析文件列表（只要路径和摘要）
  if (this.memory.analyzedFiles.length > 0) {
    const fileList = this.memory.analyzedFiles
      .map((f) => `- ${f.path}: ${f.summary}`)
      .join("\n");
    parts.push(`## Analyzed Files\n${fileList}`);
  }

  return parts.join("\n\n");
}
```

## 记忆在 Agent 中的流动

```
┌─────────────┐
│   Planner   │  ←─── 读取记忆了解当前状态
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Executor   │  ←─── 在执行中更新记忆
│  (ReAct)    │  ───→ 写入新的发现
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Reflector  │  ←─── 基于记忆评估完整性
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Generator  │  ←─── 从记忆生成最终文档
└─────────────┘
```

---

# 04 - Planning（规划能力）

> 规划让 Agent 能够有条不紊地完成复杂任务，而不是盲目行动。

## 为什么需要规划？

**没有规划的 Agent**：
```
读 package.json → 读 README → 读 src/index.ts → ...
（随机乱读，可能遗漏重要文件）
```

**有规划的 Agent**：
```
1. 分析目录结构，了解项目全貌
2. 读入口文件，理解主要功能
3. 按模块顺序分析核心代码
4. 检查配置文件
5. 查看测试了解用法
6. 整合生成文档
```

## 规划的组成

```typescript
interface Plan {
  overview: string;       // 对任务的初步理解
  steps: PlanStep[];      // 执行步骤
  focusAreas: string[];   // 重点关注领域
  currentStepIndex: number;
}

interface PlanStep {
  id: number;
  action: string;      // 做什么
  target: string;      // 对什么做
  reason: string;      // 为什么做
  status: "pending" | "in_progress" | "completed" | "skipped";
}
```

## 让 LLM 生成计划

```typescript
async createPlan(targetDir: string): Promise<Plan> {
  const structure = await this.getDirectoryStructure(targetDir);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    messages: [
      {
        role: "user",
        content: `Analyze the directory structure and create an exploration plan.

Directory structure:
${structure}

Create a JSON plan:
{
  "overview": "Brief description of the project",
  "steps": [
    { "id": 1, "action": "What to do", "target": "file or directory", "reason": "Why" }
  ],
  "focusAreas": ["area1", "area2"]
}

Guidelines:
- Start with entry points (index.ts, main.ts, package.json)
- Then explore core modules
- Check configuration files
- Examine types/interfaces`,
      },
    ],
  });

  return JSON.parse(response.content[0].text);
}
```

## 计划的动态调整

Agent 根据发现动态调整计划：

```typescript
adjustPlan(plan: Plan, reflection: ReflectionResult): void {
  const newSteps = reflection.missingAreas.map((area, i) => ({
    id: plan.steps.length + i + 1,
    action: `Analyze ${area}`,
    target: area,
    reason: "Identified as missing in reflection",
    status: "pending" as const,
  }));

  plan.steps.push(...newSteps);
  plan.currentStepIndex = plan.steps.findIndex(s => s.status === "pending");
}
```

## 规划的最佳实践

### 从宏观到微观

```
✅ 好：
1. 读 package.json（了解项目元信息）
2. 读 src/index.ts（了解入口）
3. 按依赖顺序读其他文件
```

### 明确每步的目的

```typescript
// ✅ 好
{
  action: "Analyze Agent orchestration",
  target: "src/agent.ts",
  reason: "Understand how Planner, Executor, and Reflector work together"
}
```

### 设置合理的粒度

```
✅ 合适：
1. 分析 src/agent/ 模块
2. 分析 src/tools/ 模块
3. 分析 src/generator/ 模块
```

---

# 05 - ReAct 循环

> ReAct（Reasoning + Acting）是 Agent 的核心执行模式，让 LLM 能够边思考边行动。

## 什么是 ReAct？

ReAct 来自论文 [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)。

```
传统方式：问题 → LLM → 答案（一步到位，但容易出错）

ReAct 方式：问题 → 思考 → 行动 → 观察 → 思考 → 行动 → 观察 → ... → 答案
```

## ReAct 的三个阶段

```
┌─────────────────────────────────────────────────┐
│                  ReAct Loop                     │
│                                                 │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐      │
│   │ Thought │ → │ Action  │ → │Observation│     │
│   │  思考    │   │  行动   │   │   观察    │     │
│   └─────────┘   └─────────┘   └─────────┘      │
│        ↑                            │          │
│        └────────────────────────────┘          │
└─────────────────────────────────────────────────┘
```

### 1. Thought（思考）

```
Thought: 我需要了解这个项目的入口。
         package.json 中的 "main" 字段应该能告诉我入口文件。
         让我先读取 package.json。
```

### 2. Action（行动）

```
Action: read_file
Input: { "path": "package.json" }
```

### 3. Observation（观察）

```
Observation: {
  "name": "moles",
  "main": "dist/cli.js",
  "bin": { "moles": "dist/cli.js" }
}
```

## Moles 中的 ReAct 实现

```typescript
class Executor {
  private async executeStep(step: PlanStep): Promise<void> {
    const messages: Message[] = [
      { role: "user", content: this.buildStepPrompt(step) },
    ];

    // ReAct 循环
    while (true) {
      const response = await this.client.messages.create({
        model: this.config.model,
        tools: this.tools.getToolDefinitions(),
        messages,
      });

      let hasToolUse = false;

      for (const block of response.content) {
        if (block.type === "text") {
          // ========== Thought ==========
          console.log(`💭 Thought: ${block.text}`);
        } else if (block.type === "tool_use") {
          // ========== Action ==========
          hasToolUse = true;
          console.log(`🔧 Action: ${block.name}(${JSON.stringify(block.input)})`);

          const result = await this.tools.execute(block.name, block.input);

          // ========== Observation ==========
          console.log(`👁 Observation: ${JSON.stringify(result)}`);

          // 将结果添加到消息历史
          messages.push({ role: "assistant", content: [block] });
          messages.push({
            role: "user",
            content: [{ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) }],
          });
        }
      }

      // 如果没有工具调用，说明步骤完成
      if (!hasToolUse && response.stop_reason === "end_turn") {
        break;
      }
    }
  }
}
```

## 实际执行示例

```
💭 Thought: 我需要分析 CLI 入口文件，了解它如何启动 Agent。

🔧 Action: read_file({ path: "src/cli.ts" })

👁 Observation: { success: true, data: "#!/usr/bin/env node..." }

💭 Thought: 这是一个使用 Commander.js 的 CLI 工具。让我记录这些发现。

🔧 Action: write_doc({ title: "CLI Interface", content: "...", category: "guide" })

👁 Observation: { success: true }

💭 Thought: CLI 分析完成。这个步骤已经完成了。
```

## ReAct 的优势

1. **可解释性**：每一步思考都可见
2. **可调试**：知道 Agent 在想什么
3. **可中断**：可以在任意步骤停止
4. **灵活性**：可以根据观察调整策略

## 常见陷阱

### 无限循环

```typescript
// ✅ 有退出条件
let iterations = 0;
while (iterations < MAX_ITERATIONS) {
  const done = await react();
  if (done) break;
  iterations++;
}
```

### 丢失上下文

```typescript
// ✅ 累积消息历史
messages.push({ role: "assistant", content: response.content });
messages.push({ role: "user", content: toolResults });
```

---

# 06 - Reflection（反思机制）

> 反思让 Agent 能够自我评估、发现不足、并持续改进。

## 为什么需要反思？

没有反思的 Agent 可能：
- 遗漏重要模块
- 文档质量参差不齐
- "一遍过"就结束，即使不完整

## 反思结果的类型定义

```typescript
interface ReflectionResult {
  isComplete: boolean;       // 任务是否完成
  completeness: number;      // 完成度百分比
  missingAreas: string[];    // 哪些领域还没覆盖
  suggestions: string[];     // 改进建议
  shouldContinue: boolean;   // 是否应该继续执行
}
```

## Moles 的反思实现

```typescript
class Reflector {
  async reflect(memory: Memory): Promise<ReflectionResult> {
    const prompt = `You are a documentation quality reviewer.

## Analyzed Files (${memory.analyzedFiles.length})
${memory.analyzedFiles.map(f => `- ${f.path}: ${f.summary}`).join("\n")}

## Generated Documentation Sections (${memory.documentSections.length})
${memory.documentSections.map(s => `- [${s.category}] ${s.title}`).join("\n")}

## Evaluation Criteria
1. Does the documentation cover the main modules?
2. Is there an overview/architecture section?
3. Are the key APIs documented?

Respond with JSON:
{
  "isComplete": boolean,
  "completeness": number (0-100),
  "missingAreas": ["area1", "area2"],
  "suggestions": ["suggestion1"],
  "shouldContinue": boolean
}`;

    const response = await this.client.messages.create({
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
    });

    return JSON.parse(response.content[0].text);
  }
}
```

## 反思如何影响执行

```typescript
async reflectPhase(): Promise<void> {
  const reflection = await this.reflector.reflect(this.memory.getMemory());

  if (reflection.shouldContinue) {
    // 需要继续：调整计划，回到执行阶段
    this.planner.adjustPlan(this.state.plan!, reflection);
    this.state.phase = "executing";
  } else {
    // 已完成：进入生成阶段
    this.state.phase = "generating";
  }
}
```

## 防止无限循环

```typescript
// 1. 最大迭代次数
if (this.state.iterations >= this.state.maxIterations) {
  this.state.phase = "generating";
}

// 2. 完成度阈值
if (reflection.completeness >= 80) {
  reflection.shouldContinue = false;
}

// 3. 收益递减检测
if (this.lastCompleteness === reflection.completeness) {
  this.noProgressCount++;
  if (this.noProgressCount >= 2) {
    reflection.shouldContinue = false;  // 没有进步了，停止
  }
}
```

## 渐进式完善

```
第一轮：完成度 40%
  → 发现缺失：核心模块、API 文档
  → 继续执行

第二轮：完成度 70%
  → 发现缺失：配置说明、使用示例
  → 继续执行

第三轮：完成度 85%
  → 基本完整
  → 生成文档
```

---

# 07 - Putting Together（整合）

> 将所有组件组装成完整的 Agent。

## Agent 协调器

Agent 类是整个系统的协调器：

```typescript
class Agent {
  private config: AgentConfig;
  private state: AgentState;
  private memory: MemoryManager;
  private planner: Planner;
  private executor: Executor;
  private reflector: Reflector;
  private generator: Generator;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      phase: "planning",
      plan: null,
      iterations: 0,
      maxIterations: 10,
    };
    this.memory = new MemoryManager();
    this.planner = new Planner(config);
    this.executor = new Executor(config, this.memory);
    this.reflector = new Reflector(config);
    this.generator = new Generator(config);
  }

  async run(): Promise<void> {
    while (this.state.phase !== "done") {
      switch (this.state.phase) {
        case "planning":
          await this.planPhase();
          break;
        case "executing":
          await this.executePhase();
          break;
        case "reflecting":
          await this.reflectPhase();
          break;
        case "generating":
          await this.generatePhase();
          break;
      }
      this.state.iterations++;
    }
  }
}
```

## 状态机视图

```
         ┌─────────┐
         │  START  │
         └────┬────┘
              │
              ▼
      ┌───────────────┐
      │   PLANNING    │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │   EXECUTING   │◄────────┐
      └───────┬───────┘         │
              │                 │
              ▼                 │
      ┌───────────────┐         │
      │  REFLECTING   │         │
      └───────┬───────┘         │
              │                 │
              ▼                 │
        shouldContinue?         │
           /     \              │
         Yes      No            │
          │        │            │
          │        ▼            │
          │  ┌───────────┐      │
          │  │GENERATING │      │
          │  └─────┬─────┘      │
          │        │            │
          │        ▼            │
          │  ┌───────────┐      │
          │  │   DONE    │      │
          │  └───────────┘      │
          │                     │
          └── adjustPlan ───────┘
```

## 代码结构

```
moles/
├── src/
│   ├── agent/
│   │   ├── index.ts      # Agent 协调器
│   │   ├── planner.ts    # 规划模块
│   │   ├── executor.ts   # ReAct 执行循环
│   │   ├── memory.ts     # 记忆管理
│   │   └── reflector.ts  # 反思模块
│   ├── tools/
│   │   └── index.ts      # 工具注册和实现
│   ├── generator/
│   │   └── index.ts      # 文档站点生成
│   ├── utils/
│   │   ├── logger.ts     # 日志美化
│   │   └── state.ts      # 状态持久化
│   ├── types.ts          # 类型定义
│   └── cli.ts            # CLI 入口
└── package.json
```

## 运行示例

```bash
# 对当前目录生成文档
moles

# 指定目标目录
moles ./my-project --output ./my-docs

# 详细模式
moles --verbose

# 中文文档
moles -l zh
```

## 输出示例

```
🐭 Moles - AI Documentation Agent

✓ Planning complete - 5 steps
  Focus: Agent architecture, ReAct loop, Tool system

📖 Analyzing codebase...
🔍 [1/5] Analyze entry points → src/cli.ts ✓
🔍 [2/5] Analyze core agent → src/agent/index.ts ✓
...

✓ Reflection: 85% complete
✓ Documentation generated

✨ Documentation generated at ./docs
```

---

## 总结

通过这 7 篇教学文档，我们学习了：

1. **Agent 是什么** - 能自主完成复杂任务的智能系统
2. **Tool Use** - Agent 与外界交互的接口
3. **Memory** - 让 Agent 保持上下文的记忆系统
4. **Planning** - 将复杂任务分解为可执行步骤
5. **ReAct** - 思考-行动-观察的执行循环
6. **Reflection** - 自我评估和改进的机制
7. **整合** - 将所有组件组装成完整系统

这些概念不仅适用于 Moles，也适用于构建任何 AI Agent 系统。

---

Happy coding! 🐭
