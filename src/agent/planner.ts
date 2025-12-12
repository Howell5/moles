/**
 * Planner - Creates and adjusts exploration plans for the Agent
 *
 * Planning is a key capability that distinguishes Agents from simple chatbots:
 * 1. Analyze the codebase structure
 * 2. Identify key areas to explore
 * 3. Create a prioritized plan (5-8 focused steps)
 * 4. Adjust the plan based on discoveries
 */

import * as path from "node:path";
import { glob } from "glob";
import { LLMClient } from "../llm/client.js";
import type { AgentConfig, Plan, PlanStep, ReflectionResult } from "../types.js";

const MAX_STEPS = 8;
const MAX_ADJUSTMENT_STEPS = 3;

export class Planner {
  private client: LLMClient;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new LLMClient(config);
  }

  async createPlan(targetDir: string): Promise<Plan> {
    // 1. Get directory structure (filtered)
    const structure = await this.getDirectoryStructure(targetDir);

    // 2. Ask LLM to create a focused plan
    const response = await this.client.chat([
      {
        role: "user",
        content: `You are a code analysis expert. Create a FOCUSED exploration plan for documentation.

Directory structure:
${structure}

Create a JSON plan with EXACTLY this format:
{
  "overview": "Brief description of what this project appears to be",
  "steps": [
    {
      "id": 1,
      "action": "What to do",
      "target": "file or directory path",
      "reason": "Why this step is important"
    }
  ],
  "focusAreas": ["area1", "area2", "area3"]
}

CRITICAL GUIDELINES:
- Generate ONLY 5-8 steps total (not more!)
- Focus on CORE CODE only:
  * Entry points (index.ts, main.ts, cli.ts)
  * Core modules and classes
  * Type definitions
- SKIP these (do not include in steps):
  * Config files (*.json, *.yaml, biome.json, tsconfig.json)
  * Documentation files (*.md, README)
  * Test files (*.test.ts, *.spec.ts)
  * Lock files and build artifacts
- COMBINE related files into single steps:
  * e.g., "Analyze agent module" for all files in src/agent/
- Prioritize: Entry Point → Core Modules → Types → APIs

Respond ONLY with the JSON, no other text.`,
      },
    ]);

    // 3. Parse the response
    if (!response.content) {
      throw new Error("Empty response from LLM");
    }

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const planData = JSON.parse(jsonMatch[0]);

      // Validate and limit steps
      let steps: PlanStep[] = planData.steps.map((step: PlanStep) => ({
        ...step,
        status: "pending" as const,
      }));

      // Enforce max steps limit
      if (steps.length > MAX_STEPS) {
        steps = steps.slice(0, MAX_STEPS);
      }

      return {
        ...planData,
        steps,
        currentStepIndex: 0,
      };
    } catch {
      throw new Error(`Failed to parse plan: ${response.content}`);
    }
  }

  adjustPlan(plan: Plan, reflection: ReflectionResult): void {
    // Limit new steps from reflection
    const missingAreas = reflection.missingAreas.slice(0, MAX_ADJUSTMENT_STEPS);

    const newSteps: PlanStep[] = missingAreas.map((area, index) => ({
      id: plan.steps.length + index + 1,
      action: `Analyze ${area}`,
      target: area,
      reason: "Identified as missing in reflection",
      status: "pending" as const,
    }));

    plan.steps.push(...newSteps);

    // Reset currentStepIndex to first pending step
    const firstPendingIndex = plan.steps.findIndex((s) => s.status === "pending");
    if (firstPendingIndex >= 0) {
      plan.currentStepIndex = firstPendingIndex;
    }
  }

  private async getDirectoryStructure(targetDir: string): Promise<string> {
    const absoluteDir = path.resolve(targetDir);

    // Get only source code files, excluding everything non-essential
    const files = await glob("**/*", {
      cwd: absoluteDir,
      ignore: [
        // Build and dependencies
        "node_modules/**",
        ".git/**",
        "dist/**",
        "build/**",
        "coverage/**",
        ".next/**",
        ".nuxt/**",
        // Config files - skip for analysis
        "*.json",
        "*.yaml",
        "*.yml",
        "*.toml",
        "*.lock",
        // Documentation files
        "*.md",
        "docs/**/*.md",
        // Test files
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/__tests__/**",
        "test/**",
        "tests/**",
        // Other
        ".env*",
        ".gitignore",
        "LICENSE",
      ],
      nodir: true,
    });

    // Build tree structure
    const tree = this.buildTree(files);
    return this.formatTree(tree);
  }

  private buildTree(files: string[]): Map<string, unknown> {
    const tree = new Map<string, unknown>();

    for (const file of files) {
      const parts = file.split("/");
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          // It's a file
          current.set(part, null);
        } else {
          // It's a directory
          if (!current.has(part)) {
            current.set(part, new Map());
          }
          current = current.get(part) as Map<string, unknown>;
        }
      }
    }

    return tree;
  }

  private formatTree(tree: Map<string, unknown>, prefix = ""): string {
    const lines: string[] = [];
    const entries = Array.from(tree.entries()).sort((a, b) => {
      // Directories first
      const aIsDir = a[1] instanceof Map;
      const bIsDir = b[1] instanceof Map;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a[0].localeCompare(b[0]);
    });

    for (let i = 0; i < entries.length; i++) {
      const [name, value] = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      lines.push(prefix + connector + name);

      if (value instanceof Map) {
        lines.push(this.formatTree(value, prefix + childPrefix));
      }
    }

    return lines.join("\n");
  }
}
