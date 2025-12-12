/**
 * StateManager - Persists agent state to .moles/ directory
 *
 * Files managed:
 * - plan.md: Current plan with step status (human-readable)
 * - memory.json: Analyzed files, insights, and docs
 * - progress.log: Execution log for debugging
 *
 * Benefits:
 * - Transparency: Users can see what's happening
 * - Resumability: Can continue after interruption (future)
 * - Debugging: Clear execution history
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Memory, Plan } from "../types.js";

export class StateManager {
  private stateDir: string;
  private planPath: string;
  private memoryPath: string;
  private logPath: string;

  constructor(targetDir: string) {
    this.stateDir = path.join(targetDir, ".moles");
    this.planPath = path.join(this.stateDir, "plan.md");
    this.memoryPath = path.join(this.stateDir, "memory.json");
    this.logPath = path.join(this.stateDir, "progress.log");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });

    // Clear previous log
    await fs.writeFile(this.logPath, `# Moles Progress Log\nStarted: ${new Date().toISOString()}\n\n`);
  }

  async savePlan(plan: Plan): Promise<void> {
    const content = this.formatPlanAsMarkdown(plan);
    await fs.writeFile(this.planPath, content);
  }

  async saveMemory(memory: Memory): Promise<void> {
    const content = JSON.stringify(memory, null, 2);
    await fs.writeFile(this.memoryPath, content);
  }

  async appendLog(entry: string): Promise<void> {
    const timestamp = new Date().toISOString().slice(11, 19); // HH:MM:SS
    await fs.appendFile(this.logPath, `[${timestamp}] ${entry}\n`);
  }

  async loadMemory(): Promise<Memory | null> {
    try {
      const content = await fs.readFile(this.memoryPath, "utf-8");
      return JSON.parse(content) as Memory;
    } catch {
      return null;
    }
  }

  private formatPlanAsMarkdown(plan: Plan): string {
    const lines: string[] = [
      "# Moles Analysis Plan",
      "",
      `> ${plan.overview}`,
      "",
      "## Focus Areas",
      ...plan.focusAreas.map((area) => `- ${area}`),
      "",
      "## Steps",
      "",
    ];

    for (const step of plan.steps) {
      const statusIcon = this.getStatusIcon(step.status);
      const statusText = step.status === "in_progress" ? " *(in progress)*" : "";
      lines.push(`### ${statusIcon} Step ${step.id}: ${step.action}${statusText}`);
      lines.push("");
      lines.push(`- **Target:** ${step.target}`);
      lines.push(`- **Reason:** ${step.reason}`);
      lines.push(`- **Status:** ${step.status}`);
      lines.push("");
    }

    lines.push("---");
    lines.push(`*Last updated: ${new Date().toISOString()}*`);

    return lines.join("\n");
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case "completed":
        return "✅";
      case "in_progress":
        return "🔄";
      case "skipped":
        return "⏭️";
      default:
        return "⏳";
    }
  }
}
