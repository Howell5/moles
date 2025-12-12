#!/usr/bin/env node

import "dotenv/config";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { Agent } from "./agent/index.js";

const program = new Command();

program
  .name("moles")
  .description("AI Agent that generates documentation for code repositories")
  .version("0.1.0")
  .argument("[directory]", "Target directory to document", ".")
  .option("-o, --output <dir>", "Output directory for documentation", "./docs")
  .option("-v, --verbose", "Show detailed agent reasoning", false)
  .option("-m, --model <model>", "Claude model to use", "claude-sonnet-4-20250514")
  .option("--api-key <key>", "Anthropic API key (or set ANTHROPIC_API_KEY env var)")
  .option(
    "--base-url <url>",
    "API base URL for third-party providers (or set ANTHROPIC_BASE_URL env var)",
  )
  .action(async (directory: string, options) => {
    console.log(chalk.bold.blue("\n🐭 Moles - AI Documentation Agent\n"));

    const spinner = ora("Initializing agent...").start();

    try {
      const agent = new Agent({
        targetDir: directory,
        outputDir: options.output,
        verbose: options.verbose,
        model: options.model,
        apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
        baseUrl: options.baseUrl || process.env.ANTHROPIC_BASE_URL,
      });

      spinner.succeed("Agent initialized");

      await agent.run();

      console.log(chalk.green(`\n✨ Documentation generated at ${options.output}\n`));
    } catch (error) {
      spinner.fail("Agent failed");
      if (error instanceof Error) {
        console.error(chalk.red(`\nError: ${error.message}\n`));
        if (options.verbose) {
          console.error(error.stack);
        }
      }
      process.exit(1);
    }
  });

program.parse();
