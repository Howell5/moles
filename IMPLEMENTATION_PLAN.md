# Moles - AI 代码文档生成 Agent

> 一个用于学习 Agent 架构的教学项目

## 项目概述

Moles 是一个 CLI 工具，它使用 AI Agent 自主分析代码仓库并生成多页静态文档站点。

## 测试集

MVP 完成后用于评估 Agent 能力：

| 级别 | 项目 | 评估重点 |
|------|------|----------|
| 简单 | [p-limit](https://github.com/sindresorhus/p-limit) | 基础理解、快速生成 |
| 中等 | [zod/core](https://github.com/colinhacks/zod) | 模块关系、规划能力 |
| 复杂 | [hono](https://github.com/honojs/hono) | 记忆管理、反思迭代 |

## 教学文档

每个 Stage 完成后产出对应的教学文档：

```
docs/learning/
├── 01-what-is-agent.md       # Stage 1-2: Agent 概念介绍
├── 02-tool-use.md            # Stage 3: Tool Use 机制
├── 03-memory.md              # Stage 4: 记忆系统
├── 04-planning.md            # Stage 5: 规划能力
├── 05-react-loop.md          # Stage 6: ReAct 循环
├── 06-reflection.md          # Stage 7: 反思机制
└── 07-putting-together.md    # Stage 8: 完整 Agent
```

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                         Agent                               │
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │ Planner  │ →  │ Executor │ →  │Reflector │             │
│   │ 制定计划  │    │ ReAct循环 │    │ 反思评估  │             │
│   └──────────┘    └────┬─────┘    └──────────┘             │
│                        │                                    │
│                        ▼                                    │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │  Memory  │    │  Tools   │    │Generator │             │
│   │ 记忆系统  │    │  工具集   │    │ 文档生成  │             │
│   └──────────┘    └──────────┘    └──────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
moles/
├── src/
│   ├── agent/
│   │   ├── index.ts        # Agent 主协调器
│   │   ├── planner.ts      # 规划模块
│   │   ├── executor.ts     # ReAct 执行循环
│   │   ├── memory.ts       # 记忆系统
│   │   └── reflector.ts    # 反思模块
│   ├── tools/
│   │   ├── index.ts        # 工具注册和管理
│   │   ├── types.ts        # 工具类型定义
│   │   ├── list-files.ts   # 列出文件
│   │   ├── read-file.ts    # 读取文件
│   │   ├── search-code.ts  # 搜索代码
│   │   └── write-doc.ts    # 写入文档
│   ├── generator/
│   │   ├── index.ts        # 站点生成器
│   │   └── templates.ts    # HTML 模板
│   ├── types.ts            # 全局类型
│   └── cli.ts              # CLI 入口
├── package.json
├── tsconfig.json
└── README.md
```

---

## Stage 1: 项目基础设施

**Goal**: 搭建项目骨架，配置开发环境

**Tasks**:
- [ ] 初始化 npm 项目
- [ ] 配置 TypeScript
- [ ] 安装核心依赖
- [ ] 创建目录结构
- [ ] 配置 CLI 入口

**Dependencies**:
```json
{
  "@anthropic-ai/sdk": "latest",
  "commander": "latest",
  "chalk": "latest",
  "ora": "latest",
  "glob": "latest"
}
```

**Success Criteria**:
- `npm run build` 成功
- `npx moles --help` 显示帮助信息

**Status**: ✅ Complete

---

## Stage 2: 类型系统和工具接口

**Goal**: 定义核心类型，实现工具系统

**Tasks**:
- [ ] 定义 Agent 状态类型
- [ ] 定义 Tool 接口
- [ ] 定义 Memory 类型
- [ ] 定义 Message 类型（与 Claude API 对应）
- [ ] 实现工具注册机制

**Key Types**:
```typescript
// Tool 定义
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: unknown) => Promise<ToolResult>;
}

// Agent 状态
interface AgentState {
  phase: 'planning' | 'executing' | 'reflecting' | 'done';
  plan: Plan | null;
  memory: Memory;
  iterations: number;
}

// 记忆
interface Memory {
  codebaseUnderstanding: string;    // 对代码库的理解
  analyzedFiles: string[];          // 已分析的文件
  documentSections: DocSection[];   // 已生成的文档片段
  insights: string[];               // 发现的关键洞察
}
```

**Success Criteria**:
- 类型系统完整，无 any
- Tool 接口清晰可扩展

**Status**: ✅ Complete

---

## Stage 3: 基础工具实现

**Goal**: 实现 Agent 需要的基础工具

**Tasks**:
- [ ] `list_files` - 列出目录结构
- [ ] `read_file` - 读取文件内容
- [ ] `search_code` - 搜索代码（grep）
- [ ] `write_doc` - 写入文档片段到 Memory

**Tool Specifications**:
```typescript
// list_files
{
  name: "list_files",
  description: "List files in a directory with optional pattern matching",
  parameters: {
    path: string,      // 目录路径
    pattern?: string,  // glob 模式
    recursive?: boolean
  }
}

// read_file
{
  name: "read_file",
  description: "Read the content of a file",
  parameters: {
    path: string,
    startLine?: number,
    endLine?: number
  }
}

// search_code
{
  name: "search_code",
  description: "Search for patterns in codebase",
  parameters: {
    pattern: string,   // 搜索模式
    path?: string,     // 限定目录
    filePattern?: string  // 文件类型过滤
  }
}

// write_doc
{
  name: "write_doc",
  description: "Write a documentation section to memory",
  parameters: {
    title: string,
    content: string,   // Markdown 内容
    category: string   // 分类：overview/api/guide 等
  }
}
```

**Success Criteria**:
- 每个工具独立可测试
- 错误处理完善

**Status**: ✅ Complete

---

## Stage 4: Memory 记忆系统

**Goal**: 实现 Agent 的记忆管理

**Tasks**:
- [ ] 实现 Memory 类
- [ ] 实现记忆的序列化/反序列化
- [ ] 实现记忆摘要（防止 token 过多）
- [ ] 实现记忆检索

**Key Methods**:
```typescript
class Memory {
  // 添加对代码库的理解
  addUnderstanding(content: string): void;

  // 记录已分析的文件
  markFileAnalyzed(path: string, summary: string): void;

  // 存储文档片段
  addDocSection(section: DocSection): void;

  // 获取当前记忆摘要（用于 prompt）
  getSummary(): string;

  // 获取完整记忆（用于最终生成）
  getFullMemory(): MemorySnapshot;
}
```

**Success Criteria**:
- 记忆不会无限增长
- 摘要保留关键信息

**Status**: ✅ Complete

---

## Stage 5: Planner 规划模块

**Goal**: 实现 Agent 的规划能力

**Tasks**:
- [ ] 实现初始规划生成
- [ ] 实现计划调整
- [ ] 与 Claude API 集成

**Planning Prompt 设计**:
```
你是一个代码分析专家。分析以下目录结构，制定一个探索计划。

目录结构：
{directory_tree}

请输出一个 JSON 格式的计划：
{
  "overview": "对这个项目的初步判断",
  "steps": [
    {
      "id": 1,
      "action": "分析入口文件",
      "target": "src/index.ts",
      "reason": "了解项目入口和主要导出"
    },
    ...
  ],
  "focusAreas": ["核心模块", "配置系统", ...]
}
```

**Success Criteria**:
- 能生成合理的探索计划
- 计划可以根据发现动态调整

**Status**: ✅ Complete

---

## Stage 6: ReAct 执行循环

**Goal**: 实现核心的 ReAct 循环

**Tasks**:
- [ ] 实现 Thought → Action → Observation 循环
- [ ] 实现 Claude API 调用（tool use）
- [ ] 实现循环终止条件
- [ ] 实现执行日志输出

**ReAct Loop**:
```typescript
async function executeReAct(plan: Plan, memory: Memory): Promise<void> {
  while (!shouldStop()) {
    // 1. 构建 prompt（包含当前计划、记忆、可用工具）
    const messages = buildMessages(plan, memory);

    // 2. 调用 Claude
    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      messages,
      tools: getToolDefinitions(),
    });

    // 3. 处理响应
    for (const block of response.content) {
      if (block.type === 'text') {
        // Thought - 打印思考过程
        console.log('[Thought]', block.text);
      } else if (block.type === 'tool_use') {
        // Action - 执行工具
        console.log('[Action]', block.name, block.input);
        const result = await executeTool(block.name, block.input);
        // Observation - 记录结果
        console.log('[Observation]', result);
        memory.addObservation(result);
      }
    }

    // 4. 检查是否完成当前计划步骤
    updatePlanProgress(plan);
  }
}
```

**Success Criteria**:
- 循环稳定运行
- 能正确调用和处理工具
- 有清晰的日志输出

**Status**: ✅ Complete

---

## Stage 7: Reflector 反思模块

**Goal**: 实现 Agent 的自我反思能力

**Tasks**:
- [ ] 实现完整性检查
- [ ] 实现质量评估
- [ ] 实现补充建议生成

**Reflection Prompt 设计**:
```
你是一个文档质量评审专家。

当前已生成的文档：
{document_sections}

当前对代码库的理解：
{understanding}

请评估：
1. 文档是否覆盖了代码库的主要部分？
2. 是否有遗漏的重要模块或功能？
3. 文档的质量如何？

输出 JSON：
{
  "isComplete": boolean,
  "completeness": 0-100,
  "missingAreas": ["...", "..."],
  "suggestions": ["...", "..."],
  "shouldContinue": boolean
}
```

**Success Criteria**:
- 能识别文档的不完整性
- 能给出具体的改进建议

**Status**: ✅ Complete

---

## Stage 8: Agent 协调器

**Goal**: 整合所有模块，实现完整的 Agent

**Tasks**:
- [ ] 实现 Agent 类
- [ ] 实现 Plan → Execute → Reflect 循环
- [ ] 实现状态管理
- [ ] 实现优雅的错误恢复

**Agent 主循环**:
```typescript
class Agent {
  async run(targetDir: string): Promise<void> {
    // 1. 初始化
    this.state.phase = 'planning';

    // 2. 规划阶段
    const plan = await this.planner.createPlan(targetDir);

    // 3. 主循环
    while (this.state.phase !== 'done') {
      // 执行阶段
      this.state.phase = 'executing';
      await this.executor.execute(plan, this.memory);

      // 反思阶段
      this.state.phase = 'reflecting';
      const reflection = await this.reflector.reflect(this.memory);

      if (reflection.isComplete) {
        this.state.phase = 'done';
      } else {
        // 根据反思调整计划
        this.planner.adjustPlan(plan, reflection);
      }
    }

    // 4. 生成文档
    await this.generator.generate(this.memory);
  }
}
```

**Success Criteria**:
- Agent 能完整运行
- 各模块协调良好

**Status**: ✅ Complete

---

## Stage 9: 文档生成器

**Goal**: 将 Memory 转换为静态 HTML 站点

**Tasks**:
- [ ] 设计 HTML 模板
- [ ] 实现 Markdown → HTML 转换
- [ ] 实现多页站点生成
- [ ] 集成 TailwindCSS
- [ ] 生成导航和目录

**Output Structure**:
```
docs/
├── index.html          # 首页/概览
├── architecture.html   # 架构说明
├── modules/
│   ├── index.html      # 模块列表
│   └── [module].html   # 各模块详情
├── api/
│   └── ...
└── assets/
    └── style.css       # TailwindCSS
```

**Success Criteria**:
- 生成的站点美观可用
- 导航清晰

**Status**: ✅ Complete

---

## Stage 10: CLI 完善

**Goal**: 完善命令行体验

**Tasks**:
- [ ] 实现进度显示
- [ ] 实现配置选项
- [ ] 实现 verbose 模式
- [ ] 添加错误提示

**CLI Interface**:
```bash
# 基本用法
moles

# 指定输出目录
moles --output ./docs

# 详细模式（显示 Agent 思考过程）
moles --verbose

# 指定模型
moles --model claude-sonnet-4-20250514
```

**Success Criteria**:
- CLI 体验流畅
- 错误信息友好

**Status**: ✅ Complete

---

## 技术决策记录

### 为什么用 Claude 的 Tool Use 而不是自己解析 JSON？
- Claude 原生支持 tool use，更可靠
- 自动处理参数校验
- 教学价值：展示 LLM 的标准 tool use 模式

### 为什么 Memory 需要摘要？
- 防止 context 超限
- 强迫 Agent "消化"信息而不是复制粘贴
- 更接近人类的记忆模式

### 为什么有 Reflector？
- 让 Agent 有自我纠错能力
- 避免"一遍过"的低质量输出
- 展示 Agent 的元认知能力
