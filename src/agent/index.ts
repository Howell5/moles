/**
 * Agent - The main coordinator that orchestrates the documentation generation process
 *
 * The Agent follows a Plan → Execute → Reflect loop:
 * 1. Planning: Analyze codebase structure and create exploration plan
 * 2. Executing: Run ReAct loop to understand code and generate docs
 * 3. Reflecting: Evaluate completeness and quality
 * 4. Loop or Generate: Either continue exploring or generate final docs
 */

import chalk from "chalk";
import ora, { type Ora } from "ora";
import { Generator } from "../generator/index.js";
import type { AgentConfig, AgentState } from "../types.js";
import { Executor } from "./executor.js";
import { MemoryManager } from "./memory.js";
import { Planner } from "./planner.js";
import { Reflector } from "./reflector.js";

export class Agent {
  private config: AgentConfig;
  private state: AgentState;
  private memory: MemoryManager;
  private planner: Planner;
  private executor: Executor;
  private reflector: Reflector;
  private generator: Generator;
  private spinner: Ora | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      phase: "planning",
      plan: null,
      iterations: 0,
      maxIterations: 10,
    };
    this.memory = new MemoryManager();
    this.planner = new Planner(config);
    this.executor = new Executor(config, this.memory);
    this.reflector = new Reflector(config);
    this.generator = new Generator(config);
  }

  async run(): Promise<void> {
    this.log("Starting documentation generation...\n");

    // Main Agent loop: Plan → Execute → Reflect → (Loop or Done)
    while (this.state.phase !== "done") {
      switch (this.state.phase) {
        case "planning":
          await this.planPhase();
          break;
        case "executing":
          await this.executePhase();
          break;
        case "reflecting":
          await this.reflectPhase();
          break;
        case "generating":
          await this.generatePhase();
          break;
      }

      this.state.iterations++;
      if (this.state.iterations >= this.state.maxIterations) {
        this.log(chalk.yellow("Max iterations reached, generating docs..."));
        this.state.phase = "generating";
      }
    }
  }

  private async planPhase(): Promise<void> {
    this.spinner = ora("Planning: Analyzing codebase structure...").start();

    try {
      const plan = await this.planner.createPlan(this.config.targetDir);
      this.state.plan = plan;
      this.memory.setDirectoryStructure(plan.overview);

      this.spinner.succeed("Planning complete");
      this.logVerbose(`\nPlan overview: ${plan.overview}`);
      this.logVerbose(`Steps: ${plan.steps.length}`);
      this.logVerbose(`Focus areas: ${plan.focusAreas.join(", ")}\n`);

      this.state.phase = "executing";
    } catch (error) {
      this.spinner.fail("Planning failed");
      throw error;
    }
  }

  private async executePhase(): Promise<void> {
    if (!this.state.plan) {
      throw new Error("No plan available for execution");
    }

    this.spinner = ora("Executing: Running ReAct loop...").start();

    try {
      await this.executor.execute(this.state.plan);
      this.spinner.succeed("Execution complete");

      this.logVerbose(`\nAnalyzed ${this.memory.getMemory().analyzedFiles.length} files`);
      this.logVerbose(
        `Generated ${this.memory.getMemory().documentSections.length} doc sections\n`,
      );

      this.state.phase = "reflecting";
    } catch (error) {
      this.spinner.fail("Execution failed");
      throw error;
    }
  }

  private async reflectPhase(): Promise<void> {
    this.spinner = ora("Reflecting: Evaluating documentation quality...").start();

    try {
      const reflection = await this.reflector.reflect(this.memory.getMemory());

      this.spinner.succeed(`Reflection complete (${reflection.completeness}% complete)`);

      this.logVerbose(`\nCompleteness: ${reflection.completeness}%`);
      if (reflection.missingAreas.length > 0) {
        this.logVerbose(`Missing areas: ${reflection.missingAreas.join(", ")}`);
      }

      if (reflection.shouldContinue && this.state.plan) {
        // Adjust plan based on reflection
        this.planner.adjustPlan(this.state.plan, reflection);
        this.state.phase = "executing";
        this.logVerbose("Continuing with adjusted plan...\n");
      } else {
        this.state.phase = "generating";
      }
    } catch (error) {
      this.spinner.fail("Reflection failed");
      throw error;
    }
  }

  private async generatePhase(): Promise<void> {
    this.spinner = ora("Generating: Creating documentation site...").start();

    try {
      await this.generator.generate(this.memory.getMemory());
      this.spinner.succeed("Documentation generated");
      this.state.phase = "done";
    } catch (error) {
      this.spinner.fail("Generation failed");
      throw error;
    }
  }

  private log(message: string): void {
    console.log(message);
  }

  private logVerbose(message: string): void {
    if (this.config.verbose) {
      console.log(chalk.gray(message));
    }
  }
}
