/**
 * Reflector - Evaluates the Agent's work and suggests improvements
 *
 * Reflection is what makes an Agent self-improving:
 * 1. Evaluate completeness of generated documentation
 * 2. Identify missing areas
 * 3. Assess quality
 * 4. Suggest next steps
 *
 * This enables the Agent to iterate and improve its output.
 */

import { LLMClient } from "../llm/client.js";
import type { AgentConfig, Memory, ReflectionResult } from "../types.js";

export class Reflector {
  private client: LLMClient;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new LLMClient(config);
  }

  async reflect(memory: Memory): Promise<ReflectionResult> {
    const prompt = this.buildReflectionPrompt(memory);

    const response = await this.client.chat([
      {
        role: "user",
        content: prompt,
      },
    ]);

    if (!response.content) {
      return {
        isComplete: true,
        completeness: 70,
        missingAreas: [],
        suggestions: ["Empty reflection response, proceeding with generation"],
        shouldContinue: false,
      };
    }

    try {
      // Extract JSON from response (it might be wrapped in markdown)
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      return JSON.parse(jsonMatch[0]) as ReflectionResult;
    } catch {
      // Default response if parsing fails
      return {
        isComplete: true,
        completeness: 70,
        missingAreas: [],
        suggestions: ["Could not parse reflection, proceeding with generation"],
        shouldContinue: false,
      };
    }
  }

  private buildReflectionPrompt(memory: Memory): string {
    const analyzedFilesCount = memory.analyzedFiles.length;
    const docSectionsCount = memory.documentSections.length;

    const docSectionsList = memory.documentSections.map((s) => `- [${s.category}] ${s.title}`).join("\n");

    const analyzedFilesList = memory.analyzedFiles.map((f) => `- ${f.path}: ${f.summary}`).join("\n");

    return `You are a documentation quality reviewer. Evaluate the following documentation progress and determine if it's complete.

## Directory Structure
${memory.directoryStructure}

## Codebase Understanding
${memory.codebaseUnderstanding || "No understanding recorded yet"}

## Analyzed Files (${analyzedFilesCount})
${analyzedFilesList || "No files analyzed yet"}

## Generated Documentation Sections (${docSectionsCount})
${docSectionsList || "No sections generated yet"}

## Key Insights
${memory.insights.length > 0 ? memory.insights.map((i) => `- ${i}`).join("\n") : "No insights recorded"}

## Evaluation Criteria
1. Does the documentation cover the main modules?
2. Is there an overview/architecture section?
3. Are the key APIs documented?
4. Are there any obvious gaps?

## Your Task
Evaluate the documentation and respond with JSON in this exact format:
{
  "isComplete": boolean,
  "completeness": number (0-100),
  "missingAreas": ["area1", "area2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "shouldContinue": boolean
}

Guidelines:
- completeness >= 80 and no critical missing areas → isComplete: true
- If important modules are not documented → shouldContinue: true
- Be specific about what's missing
- Max 3 iterations is usually enough for good docs

Respond ONLY with the JSON.`;
  }
}
