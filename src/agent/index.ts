/**
 * Agent - The main coordinator that orchestrates the documentation generation process
 *
 * The Agent follows a Plan → Execute → Reflect loop:
 * 1. Planning: Analyze codebase structure and create exploration plan
 * 2. Executing: Run ReAct loop to understand code and generate docs
 * 3. Reflecting: Evaluate completeness and quality
 * 4. Loop or Generate: Either continue exploring or generate final docs
 */

import ora, { type Ora } from "ora";
import { Generator } from "../generator/index.js";
import type { AgentConfig, AgentState } from "../types.js";
import { initLogger, type Logger } from "../utils/logger.js";
import { StateManager } from "../utils/state.js";
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
  private stateManager: StateManager;
  private logger: Logger;
  private spinner: Ora | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      phase: "planning",
      plan: null,
      iterations: 0,
      maxIterations: 10,
    };
    this.logger = initLogger(config.verbose);
    this.stateManager = new StateManager(config.targetDir);
    this.memory = new MemoryManager();
    this.planner = new Planner(config);
    this.executor = new Executor(config, this.memory, this.logger, this.stateManager);
    this.reflector = new Reflector(config);
    this.generator = new Generator(config);
  }

  async run(): Promise<void> {
    // Initialize state directory
    await this.stateManager.initialize();
    await this.stateManager.appendLog("Agent started");

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
        this.logger.warn("Max iterations reached, generating docs...");
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

      // Save plan to .moles/plan.md
      await this.stateManager.savePlan(plan);
      await this.stateManager.appendLog(`Plan created: ${plan.steps.length} steps`);

      this.spinner.succeed(`Planning complete - ${plan.steps.length} steps`);
      this.logger.info(`Focus: ${plan.focusAreas.join(", ")}`);
      this.logger.info(`State saved to .moles/plan.md`);
      this.logger.setTotalSteps(plan.steps.length);

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

    this.logger.phase("📖 Analyzing codebase...");

    try {
      await this.executor.execute(this.state.plan);

      const mem = this.memory.getMemory();
      this.logger.summary({
        files: mem.analyzedFiles.length,
        sections: mem.documentSections.length,
        insights: mem.insights.length,
      });

      this.state.phase = "reflecting";
    } catch (error) {
      this.logger.error("Execution failed");
      throw error;
    }
  }

  private async reflectPhase(): Promise<void> {
    this.spinner = ora("Reflecting: Evaluating documentation quality...").start();

    try {
      const reflection = await this.reflector.reflect(this.memory.getMemory());

      this.spinner.succeed(`Reflection: ${reflection.completeness}% complete`);

      if (reflection.shouldContinue && this.state.plan) {
        this.logger.info(`Missing: ${reflection.missingAreas.join(", ")}`);
        this.planner.adjustPlan(this.state.plan, reflection);
        this.logger.setTotalSteps(this.state.plan.steps.length);
        this.state.phase = "executing";
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
}
