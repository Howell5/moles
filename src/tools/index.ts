/**
 * ToolRegistry - Manages tools available to the Agent
 *
 * Tools are the Agent's interface to the world. They enable:
 * 1. Reading files and directories
 * 2. Searching code
 * 3. Writing documentation to memory
 *
 * Each tool has:
 * - A name (for Claude to reference)
 * - A description (so Claude knows when to use it)
 * - Parameters schema (for validation)
 * - An execute function (actual implementation)
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { glob } from 'glob'
import type { MemoryManager } from '../agent/memory.js'
import type { DocCategory, ToolResult } from '../types.js'

interface ToolParameter {
  type: string
  description: string
  items?: { type: string }
}

interface Tool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required: string[]
  }
  execute: (params: Record<string, unknown>) => Promise<ToolResult>
}

export interface OpenAIToolDefinition {
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

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()
  private targetDir: string
  private memory: MemoryManager

  constructor(targetDir: string, memory: MemoryManager) {
    this.targetDir = path.resolve(targetDir)
    this.memory = memory
    this.registerBuiltinTools()
  }

  private registerBuiltinTools(): void {
    // list_files - List directory contents
    this.register({
      name: 'list_files',
      description: "List files in a directory. Use pattern to filter by glob (e.g., '**/*.ts' for all TypeScript files).",
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path relative to project root',
          },
          pattern: {
            type: 'string',
            description: "Glob pattern to filter files (default: '*')",
          },
        },
        required: ['path'],
      },
      execute: async (params) => {
        const dirPath = params.path as string
        const pattern = (params.pattern as string) || '*'

        try {
          const fullPath = path.join(this.targetDir, dirPath)
          const files = await glob(pattern, {
            cwd: fullPath,
            ignore: ['node_modules/**', '.git/**', 'dist/**'],
          })

          return { success: true, data: files }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    })

    // read_file - Read file contents
    this.register({
      name: 'read_file',
      description: 'Read the contents of a file. Returns the full content or a specific line range.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to project root',
          },
          start_line: {
            type: 'integer',
            description: 'Starting line number (1-indexed)',
          },
          end_line: {
            type: 'integer',
            description: 'Ending line number (inclusive)',
          },
        },
        required: ['path'],
      },
      execute: async (params) => {
        const filePath = params.path as string
        const startLine = params.start_line as number | undefined
        const endLine = params.end_line as number | undefined

        try {
          const fullPath = path.join(this.targetDir, filePath)
          const content = await fs.readFile(fullPath, 'utf-8')

          if (startLine !== undefined) {
            const lines = content.split('\n')
            const start = Math.max(0, startLine - 1)
            const end = endLine !== undefined ? endLine : lines.length
            return {
              success: true,
              data: lines.slice(start, end).join('\n'),
            }
          }

          return { success: true, data: content }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    })

    // search_code - Search for patterns in code
    this.register({
      name: 'search_code',
      description: 'Search for a pattern (regex or string) across files. Returns matching lines with context.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Search pattern (regex supported)',
          },
          file_pattern: {
            type: 'string',
            description: "Glob pattern to filter files (e.g., '**/*.ts')",
          },
        },
        required: ['pattern'],
      },
      execute: async (params) => {
        const searchPattern = params.pattern as string
        const filePattern = (params.file_pattern as string) || '**/*'

        try {
          const files = await glob(filePattern, {
            cwd: this.targetDir,
            ignore: ['node_modules/**', '.git/**', 'dist/**'],
            nodir: true,
          })

          const regex = new RegExp(searchPattern, 'gi')
          const results: Array<{ file: string; line: number; content: string }> = []

          for (const file of files.slice(0, 50)) {
            try {
              const fullPath = path.join(this.targetDir, file)
              const content = await fs.readFile(fullPath, 'utf-8')
              const lines = content.split('\n')

              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  results.push({
                    file,
                    line: i + 1,
                    content: lines[i].trim(),
                  })
                }
                regex.lastIndex = 0
              }
            } catch {
              // Skip files that can't be read
            }
          }

          return { success: true, data: results.slice(0, 20) }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    })

    // write_doc - Write documentation section to memory
    this.register({
      name: 'write_doc',
      description: "Save a documentation section to memory. Use this when you've understood something well enough to document it.",
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Section title',
          },
          content: {
            type: 'string',
            description: 'Documentation content in Markdown',
          },
          category: {
            type: 'string',
            description: 'Category: overview, architecture, module, api, guide, or other',
          },
        },
        required: ['title', 'content', 'category'],
      },
      execute: async (params) => {
        const title = params.title as string
        const content = params.content as string
        const category = params.category as DocCategory

        this.memory.addDocSection({ title, content, category })

        return {
          success: true,
          data: `Documentation section "${title}" saved to memory`,
        }
      },
    })

    // add_insight - Record a key insight
    this.register({
      name: 'add_insight',
      description: 'Record a key insight about the codebase. Use this for important patterns or discoveries.',
      parameters: {
        type: 'object',
        properties: {
          insight: {
            type: 'string',
            description: 'The insight to record',
          },
        },
        required: ['insight'],
      },
      execute: async (params) => {
        const insight = params.insight as string
        this.memory.addInsight(insight)
        return { success: true, data: `Insight recorded: ${insight}` }
      },
    })

    // mark_file_analyzed - Mark a file as analyzed
    this.register({
      name: 'mark_file_analyzed',
      description: 'Mark a file as analyzed with a summary. Helps avoid re-analyzing the same file.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of what the file does',
          },
          exports: {
            type: 'array',
            description: 'List of exports from the file',
            items: { type: 'string' },
          },
        },
        required: ['path', 'summary'],
      },
      execute: async (params) => {
        const filePath = params.path as string
        const summary = params.summary as string
        const exports = params.exports as string[] | undefined

        this.memory.markFileAnalyzed({ path: filePath, summary, exports })
        return { success: true, data: `File ${filePath} marked as analyzed` }
      },
    })
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` }
    }

    try {
      return await tool.execute(params)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  getToolDefinitions(): OpenAIToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: Object.fromEntries(
            Object.entries(tool.parameters.properties).map(([key, value]) => {
              const prop: Record<string, unknown> = {
                type: value.type,
                description: value.description,
              }
              if (value.items) {
                prop.items = value.items
              }
              return [key, prop]
            })
          ),
          required: tool.parameters.required,
        },
      },
    }))
  }
}
