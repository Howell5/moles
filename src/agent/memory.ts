/**
 * MemoryManager - Manages the Agent's memory system
 *
 * Memory is crucial for an Agent to:
 * 1. Remember what it has already analyzed (avoid redundant work)
 * 2. Build up understanding over time
 * 3. Store generated documentation sections
 * 4. Track insights and patterns discovered
 *
 * The memory is designed to be:
 * - Structured: Different types of information in different slots
 * - Summarizable: Can be condensed for context windows
 * - Persistent: Can be serialized/deserialized
 */

import type { AnalyzedFile, DocCategory, DocSection, Memory } from "../types.js";

export class MemoryManager {
  private memory: Memory;

  constructor() {
    this.memory = {
      codebaseUnderstanding: "",
      analyzedFiles: [],
      documentSections: [],
      insights: [],
      directoryStructure: "",
    };
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getMemory(): Memory {
    return this.memory;
  }

  /**
   * Get a summary of memory for use in prompts
   * This is important to prevent context overflow
   */
  getSummary(): string {
    const parts: string[] = [];

    if (this.memory.directoryStructure) {
      parts.push(`## Directory Structure\n${this.memory.directoryStructure}`);
    }

    if (this.memory.codebaseUnderstanding) {
      parts.push(`## Understanding\n${this.memory.codebaseUnderstanding}`);
    }

    if (this.memory.analyzedFiles.length > 0) {
      const fileList = this.memory.analyzedFiles.map((f) => `- ${f.path}: ${f.summary}`).join("\n");
      parts.push(`## Analyzed Files (${this.memory.analyzedFiles.length})\n${fileList}`);
    }

    if (this.memory.insights.length > 0) {
      parts.push(`## Key Insights\n${this.memory.insights.map((i) => `- ${i}`).join("\n")}`);
    }

    if (this.memory.documentSections.length > 0) {
      const sectionList = this.memory.documentSections
        .map((s) => `- [${s.category}] ${s.title}`)
        .join("\n");
      parts.push(`## Generated Sections\n${sectionList}`);
    }

    return parts.join("\n\n");
  }

  // ============================================================================
  // Setters
  // ============================================================================

  setDirectoryStructure(structure: string): void {
    this.memory.directoryStructure = structure;
  }

  addUnderstanding(content: string): void {
    if (this.memory.codebaseUnderstanding) {
      this.memory.codebaseUnderstanding += `\n\n${content}`;
    } else {
      this.memory.codebaseUnderstanding = content;
    }
  }

  markFileAnalyzed(file: AnalyzedFile): void {
    // Check if already analyzed
    const existingIndex = this.memory.analyzedFiles.findIndex((f) => f.path === file.path);
    if (existingIndex >= 0) {
      // Update existing
      this.memory.analyzedFiles[existingIndex] = file;
    } else {
      this.memory.analyzedFiles.push(file);
    }
  }

  addDocSection(section: Omit<DocSection, "id" | "order">): void {
    const id = `${section.category}-${this.memory.documentSections.length}`;
    const order = this.memory.documentSections.filter(
      (s) => s.category === section.category,
    ).length;

    this.memory.documentSections.push({
      ...section,
      id,
      order,
    });
  }

  addInsight(insight: string): void {
    if (!this.memory.insights.includes(insight)) {
      this.memory.insights.push(insight);
    }
  }

  // ============================================================================
  // Queries
  // ============================================================================

  isFileAnalyzed(path: string): boolean {
    return this.memory.analyzedFiles.some((f) => f.path === path);
  }

  getAnalyzedFile(path: string): AnalyzedFile | undefined {
    return this.memory.analyzedFiles.find((f) => f.path === path);
  }

  getDocSectionsByCategory(category: DocCategory): DocSection[] {
    return this.memory.documentSections
      .filter((s) => s.category === category)
      .sort((a, b) => a.order - b.order);
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  toJSON(): string {
    return JSON.stringify(this.memory, null, 2);
  }

  fromJSON(json: string): void {
    this.memory = JSON.parse(json);
  }
}
