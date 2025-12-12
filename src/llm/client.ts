/**
 * LLM Client - Unified interface for LLM interactions
 *
 * Uses OpenAI-compatible API format for flexibility with different providers.
 */

import OpenAI from 'openai'
import type { AgentConfig } from '../types.js'

export interface LLMToolCallRaw {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: LLMToolCallRaw[]
}

export interface LLMTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required: string[]
    }
  }
}

export interface LLMToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface LLMResponse {
  content: string | null
  toolCalls: LLMToolCall[]
  rawToolCalls: LLMToolCallRaw[]
  finishReason: string
}

export class LLMClient {
  private client: OpenAI
  private model: string

  constructor(config: AgentConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })
    this.model = config.model
  }

  async chat(messages: LLMMessage[], tools?: LLMTool[]): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content,
        }
        if (m.tool_call_id) {
          msg.tool_call_id = m.tool_call_id
        }
        if (m.tool_calls) {
          msg.tool_calls = m.tool_calls
        }
        return msg
      }) as unknown as OpenAI.ChatCompletionMessageParam[],
      ...(tools && tools.length > 0 ? { tools } : {}),
    })

    const choice = response.choices[0]
    const message = choice.message

    const toolCalls: LLMToolCall[] = []
    const rawToolCalls: LLMToolCallRaw[] = []

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        if (tc.type === 'function') {
          rawToolCalls.push({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          })
        }
      }
    }

    return {
      content: message.content,
      toolCalls,
      rawToolCalls,
      finishReason: choice.finish_reason || 'stop',
    }
  }
}
