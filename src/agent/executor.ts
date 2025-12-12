/**
 * Executor - Implements the ReAct (Reasoning + Acting) loop
 *
 * ReAct is a paradigm where the Agent:
 * 1. Thinks about what to do next (Thought)
 * 2. Takes an action using a tool (Action)
 * 3. Observes the result (Observation)
 * 4. Repeats until the task is complete
 *
 * This is the core execution engine of the Agent.
 */

import chalk from "chalk";
import { LLMClient, type LLMMessage } from "../llm/client.js";
import { ToolRegistry, type OpenAIToolDefinition } from "../tools/index.js";
import type { AgentConfig, Plan } from "../types.js";
import type { MemoryManager } from "./memory.js";

export class Executor {
  private client: LLMClient;
  private config: AgentConfig;
  private memory: MemoryManager;
  private tools: ToolRegistry;
  private maxReactIterations = 20;

  constructor(config: AgentConfig, memory: MemoryManager) {
    this.config = config;
    this.memory = memory;
    this.client = new LLMClient(config);
    this.tools = new ToolRegistry(config.targetDir, memory);
  }

  async execute(plan: Plan): Promise<void> {
    // Process each pending step in the plan
    while (plan.currentStepIndex < plan.steps.length) {
      const step = plan.steps[plan.currentStepIndex];

      if (step.status !== "pending") {
        plan.currentStepIndex++;
        continue;
      }

      step.status = "in_progress";
      this.logVerbose(`\n📋 Step ${step.id}: ${step.action}`);
      this.logVerbose(`   Target: ${step.target}`);

      await this.executeStep(step);

      step.status = "completed";
      plan.currentStepIndex++;
    }
  }

  private async executeStep(step: { action: string; target: string; reason: string }): Promise<void> {
    const messages: LLMMessage[] = [
      {
        role: "user",
        content: this.buildStepPrompt(step),
      },
    ];

    const tools = this.getToolDefinitions();
    let iterations = 0;

    // ReAct loop for this step
    while (iterations < this.maxReactIterations) {
      iterations++;

      const response = await this.client.chat(messages, tools);

      // Process text content (Thought)
      if (response.content) {
        this.logVerbose(chalk.cyan(`\n💭 Thought: ${response.content}`));
      }

      // Process tool calls (Action)
      if (response.toolCalls.length > 0) {
        // Add assistant message with tool_calls (required by OpenAI format)
        messages.push({
          role: "assistant",
          content: response.content,
          tool_calls: response.rawToolCalls,
        });

        for (const toolCall of response.toolCalls) {
          this.logVerbose(
            chalk.yellow(`\n🔧 Action: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`)
          );

          // Execute tool
          const result = await this.tools.execute(toolCall.name, toolCall.arguments);

          // Observation
          const observation = result.success
            ? JSON.stringify(result.data, null, 2)
            : `Error: ${result.error}`;

          this.logVerbose(
            chalk.green(
              `\n👁 Observation: ${observation.slice(0, 500)}${observation.length > 500 ? "..." : ""}`
            )
          );

          // Add tool result to messages
          messages.push({
            role: "tool",
            content: observation,
            tool_call_id: toolCall.id,
          });
        }
      } else if (response.content) {
        // No tool calls, just text response
        messages.push({
          role: "assistant",
          content: response.content,
        });
      }

      // Check if we should stop
      if (response.finishReason === "stop" && response.toolCalls.length === 0) {
        break;
      }
    }
  }

  private buildStepPrompt(step: { action: string; target: string; reason: string }): string {
    return `You are a code documentation agent. Your task is to analyze code and generate documentation.

## Current Memory
${this.memory.getSummary()}

## Current Plan Step
- Action: ${step.action}
- Target: ${step.target}
- Reason: ${step.reason}

## Instructions
1. Use the available tools to explore and understand the target
2. When you understand it well enough, use write_doc to save documentation
3. Be thorough but focused on this specific step
4. When done with this step, stop and let me know

Remember:
- Read files to understand their purpose
- Look for patterns, exports, and dependencies
- Write clear, helpful documentation
- Add insights you discover to memory

Begin your analysis.`;
  }

  private getToolDefinitions(): OpenAIToolDefinition[] {
    return this.tools.getToolDefinitions();
  }

  private logVerbose(message: string): void {
    if (this.config.verbose) {
      console.log(message);
    }
  }
}
