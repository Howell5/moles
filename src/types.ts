/**
 * Global type definitions for Moles
 */

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  targetDir: string;
  outputDir: string;
  verbose: boolean;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

// ============================================================================
// Agent State
// ============================================================================

export type AgentPhase = "planning" | "executing" | "reflecting" | "generating" | "done";

export interface AgentState {
  phase: AgentPhase;
  plan: Plan | null;
  iterations: number;
  maxIterations: number;
}

// ============================================================================
// Planning
// ============================================================================

export interface Plan {
  overview: string;
  steps: PlanStep[];
  focusAreas: string[];
  currentStepIndex: number;
}

export interface PlanStep {
  id: number;
  action: string;
  target: string;
  reason: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
}

// ============================================================================
// Memory
// ============================================================================

export interface Memory {
  /** High-level understanding of the codebase */
  codebaseUnderstanding: string;

  /** Files that have been analyzed */
  analyzedFiles: AnalyzedFile[];

  /** Documentation sections generated */
  documentSections: DocSection[];

  /** Key insights discovered */
  insights: string[];

  /** Directory structure */
  directoryStructure: string;
}

export interface AnalyzedFile {
  path: string;
  summary: string;
  exports?: string[];
  dependencies?: string[];
}

export interface DocSection {
  id: string;
  title: string;
  content: string;
  category: DocCategory;
  order: number;
}

export type DocCategory = "overview" | "architecture" | "module" | "api" | "guide" | "other";

// ============================================================================
// Tools
// ============================================================================

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameters {
  type: "object";
  properties: Record<string, ToolParameterProperty>;
  required: string[];
}

export interface ToolParameterProperty {
  type: "string" | "number" | "boolean" | "array";
  description: string;
  items?: { type: string };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Reflection
// ============================================================================

export interface ReflectionResult {
  isComplete: boolean;
  completeness: number;
  missingAreas: string[];
  suggestions: string[];
  shouldContinue: boolean;
}

// ============================================================================
// Claude API Types (simplified for tool use)
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}
