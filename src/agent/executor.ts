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

import { LLMClient, type LLMMessage } from '../llm/client.js'
import { ToolRegistry, type OpenAIToolDefinition } from '../tools/index.js'
import type { AgentConfig, Plan } from '../types.js'
import type { Logger } from '../utils/logger.js'
import type { StateManager } from '../utils/state.js'
import type { MemoryManager } from './memory.js'

export class Executor {
  private client: LLMClient
  private config: AgentConfig
  private memory: MemoryManager
  private tools: ToolRegistry
  private logger: Logger
  private stateManager: StateManager
  private maxReactIterations = 20

  constructor(config: AgentConfig, memory: MemoryManager, logger: Logger, stateManager: StateManager) {
    this.config = config
    this.memory = memory
    this.logger = logger
    this.stateManager = stateManager
    this.client = new LLMClient(config)
    this.tools = new ToolRegistry(config.targetDir, memory)
  }

  async execute(plan: Plan): Promise<void> {
    // Process each pending step in the plan
    while (plan.currentStepIndex < plan.steps.length) {
      const step = plan.steps[plan.currentStepIndex]

      if (step.status !== 'pending') {
        plan.currentStepIndex++
        continue
      }

      step.status = 'in_progress'
      this.logger.stepStart(step.id, step.action, step.target)

      // Save state before executing
      await this.stateManager.savePlan(plan)
      await this.stateManager.appendLog(`Step ${step.id}: ${step.action} → ${step.target}`)

      await this.executeStep(step)

      step.status = 'completed'
      this.logger.stepComplete()

      // Save state after completing
      await this.stateManager.savePlan(plan)
      await this.stateManager.saveMemory(this.memory.getMemory())

      plan.currentStepIndex++
    }
  }

  private async executeStep(step: { action: string; target: string; reason: string }): Promise<void> {
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: this.buildStepPrompt(step),
      },
    ]

    const tools = this.getToolDefinitions()
    let iterations = 0

    // ReAct loop for this step
    while (iterations < this.maxReactIterations) {
      iterations++

      const response = await this.client.chat(messages, tools)

      // Process text content (Thought)
      if (response.content) {
        this.logger.thought(response.content)
      }

      // Process tool calls (Action)
      if (response.toolCalls.length > 0) {
        // Add assistant message with tool_calls (required by OpenAI format)
        messages.push({
          role: 'assistant',
          content: response.content,
          tool_calls: response.rawToolCalls,
        })

        for (const toolCall of response.toolCalls) {
          this.logger.action(toolCall.name, toolCall.arguments)

          // Execute tool
          const result = await this.tools.execute(toolCall.name, toolCall.arguments)

          // Observation
          const observation = result.success ? JSON.stringify(result.data, null, 2) : `Error: ${result.error}`

          this.logger.observation(observation, !result.success)

          // Show progress in normal mode for key actions
          if (toolCall.name === 'write_doc') {
            this.logger.stepProgress(`Documented: ${(toolCall.arguments as { title?: string }).title || 'section'}`)
          } else if (toolCall.name === 'read_file') {
            this.logger.stepProgress(`Reading: ${(toolCall.arguments as { path?: string }).path || 'file'}`)
          }

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: observation,
            tool_call_id: toolCall.id,
          })
        }
      } else if (response.content) {
        // No tool calls, just text response
        messages.push({
          role: 'assistant',
          content: response.content,
        })
      }

      // Check if we should stop
      if (response.finishReason === 'stop' && response.toolCalls.length === 0) {
        break
      }
    }
  }

  private buildStepPrompt(step: { action: string; target: string; reason: string }): string {
    const langInstruction = this.config.language === 'zh' ? '\n\n**IMPORTANT: Write ALL documentation content in Chinese (中文). Code examples and technical terms can remain in English.**' : ''

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
- Add insights you discover to memory${langInstruction}

Begin your analysis.`
  }

  private getToolDefinitions(): OpenAIToolDefinition[] {
    return this.tools.getToolDefinitions()
  }
}
