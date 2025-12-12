/**
 * Logger - Unified logging with clean output formatting
 *
 * Two modes:
 * - Normal: Clean, minimal output showing progress
 * - Verbose: Full ReAct loop details (Thought/Action/Observation)
 */

import chalk from "chalk";

export class Logger {
  private verbose: boolean;
  private currentStep = 0;
  private totalSteps = 0;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  setTotalSteps(total: number): void {
    this.totalSteps = total;
  }

  // ============================================================================
  // Phase-level logging (always shown)
  // ============================================================================

  phase(name: string): void {
    console.log(chalk.bold.blue(`\n${name}`));
  }

  success(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  }

  error(message: string): void {
    console.log(chalk.red(`✗ ${message}`));
  }

  info(message: string): void {
    console.log(chalk.dim(message));
  }

  warn(message: string): void {
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  // ============================================================================
  // Step-level logging (clean progress in normal mode)
  // ============================================================================

  stepStart(stepNum: number, action: string, target: string): void {
    this.currentStep = stepNum;
    if (this.verbose) {
      console.log(chalk.bold(`\n${"─".repeat(60)}`));
      console.log(chalk.bold(`📋 Step ${stepNum}/${this.totalSteps}: ${action}`));
      console.log(chalk.dim(`   Target: ${target}`));
      console.log(chalk.bold(`${"─".repeat(60)}`));
    } else {
      // Clean single-line progress
      process.stdout.write(
        chalk.dim(`\n🔍 [${stepNum}/${this.totalSteps}] `) + chalk.white(action) + chalk.dim(` → ${target}`)
      );
    }
  }

  stepProgress(message: string): void {
    if (!this.verbose) {
      process.stdout.write(chalk.dim(`\n   └─ ${message}`));
    }
  }

  stepComplete(): void {
    if (!this.verbose) {
      console.log(chalk.green(" ✓"));
    } else {
      console.log(chalk.green(`\n✓ Step ${this.currentStep} complete`));
    }
  }

  // ============================================================================
  // ReAct logging (verbose mode only)
  // ============================================================================

  thought(content: string): void {
    if (this.verbose) {
      console.log(chalk.cyan(`\n💭 Thought: ${this.truncate(content, 200)}`));
    }
  }

  action(name: string, args: Record<string, unknown>): void {
    if (this.verbose) {
      const argsStr = JSON.stringify(args);
      console.log(chalk.yellow(`\n🔧 Action: ${name}(${this.truncate(argsStr, 100)})`));
    }
  }

  observation(result: string, isError = false): void {
    if (this.verbose) {
      const color = isError ? chalk.red : chalk.green;
      const icon = isError ? "❌" : "👁";
      console.log(color(`\n${icon} Observation: ${this.truncate(result, 300)}`));
    }
  }

  // ============================================================================
  // Summary logging
  // ============================================================================

  summary(stats: { files: number; sections: number; insights: number }): void {
    console.log(chalk.dim("\n" + "─".repeat(40)));
    console.log(chalk.dim(`📁 Files analyzed: ${stats.files}`));
    console.log(chalk.dim(`📄 Sections generated: ${stats.sections}`));
    console.log(chalk.dim(`💡 Insights captured: ${stats.insights}`));
    console.log(chalk.dim("─".repeat(40)));
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + "...";
  }
}

// Singleton for easy import
let globalLogger: Logger | null = null;

export function initLogger(verbose: boolean): Logger {
  globalLogger = new Logger(verbose);
  return globalLogger;
}

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(false);
  }
  return globalLogger;
}
