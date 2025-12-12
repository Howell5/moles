#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// Load .env from multiple locations (first found wins)
const envPaths = [path.join(process.cwd(), '.env'), path.join(os.homedir(), '.moles', '.env'), path.join(os.homedir(), '.env.moles')]

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenvConfig({ path: envPath })
    break
  }
}
import { confirm, select } from '@inquirer/prompts'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { Agent } from './agent/index.js'
import type { DocLanguage } from './types.js'

const program = new Command()

program.name('moles').description('AI Agent that generates documentation for code repositories').version('0.1.0')

// Generate command (default)
program
  .command('generate', { isDefault: true })
  .description('Generate documentation for a codebase')
  .argument('[directory]', 'Target directory to document', '.')
  .option('-o, --output <dir>', 'Output directory for documentation', './docs')
  .option('-v, --verbose', 'Show detailed agent reasoning', false)
  .option('-m, --model <model>', 'Claude model to use')
  .option('-l, --language <lang>', 'Documentation language (en/zh)')
  .option('-y, --yes', 'Skip interactive prompts, use defaults', false)
  .option('--api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('--base-url <url>', 'API base URL for third-party providers (or set ANTHROPIC_BASE_URL env var)')
  .action(async (directory: string, options) => {
    console.log(chalk.bold.blue('\n🐭 Moles - AI Documentation Agent\n'))

    // Resolve directory
    const targetDir = path.resolve(directory)
    if (!fs.existsSync(targetDir)) {
      console.error(chalk.red(`❌ Directory not found: ${targetDir}\n`))
      process.exit(1)
    }

    // Detect project name from package.json or directory name
    let projectName = path.basename(targetDir)
    const packageJsonPath = path.join(targetDir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        if (pkg.name) projectName = pkg.name
      } catch {
        // Ignore parse errors
      }
    }

    // Interactive prompts (unless -y flag is used)
    let language: DocLanguage = (options.language as DocLanguage) || 'en'

    if (!options.yes && !options.language) {
      console.log(chalk.dim(`Target: ${targetDir}`))
      console.log(chalk.dim(`Project: ${projectName}\n`))

      try {
        language = await select({
          message: 'Documentation language',
          choices: [
            { name: 'English', value: 'en' as DocLanguage },
            { name: '中文 (Chinese)', value: 'zh' as DocLanguage },
          ],
          default: 'en',
        })

        const shouldContinue = await confirm({
          message: `Generate docs in ${options.output}?`,
          default: true,
        })

        if (!shouldContinue) {
          console.log(chalk.yellow('\n⏹ Cancelled\n'))
          process.exit(0)
        }

        console.log() // Empty line before starting
      } catch {
        // User cancelled (Ctrl+C)
        console.log(chalk.yellow('\n⏹ Cancelled\n'))
        process.exit(0)
      }
    }

    const spinner = ora('Initializing agent...').start()

    try {
      const agent = new Agent({
        targetDir: directory,
        outputDir: options.output,
        verbose: options.verbose,
        model: options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        language,
        apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
        baseUrl: options.baseUrl || process.env.ANTHROPIC_BASE_URL,
      })

      spinner.succeed('Agent initialized')

      await agent.run()

      console.log(chalk.green(`\n✨ Documentation generated at ${options.output}`))
      console.log(chalk.dim(`\nRun ${chalk.cyan('moles serve')} to preview the documentation\n`))
    } catch (error) {
      spinner.fail('Agent failed')
      if (error instanceof Error) {
        console.error(chalk.red(`\nError: ${error.message}\n`))
        if (options.verbose) {
          console.error(error.stack)
        }
      }
      process.exit(1)
    }
  })

// Serve command
program
  .command('serve')
  .description('Start a local server to preview generated documentation')
  .argument('[docs-dir]', 'Documentation directory', './docs')
  .option('-p, --port <port>', 'Port to run the server on', '5173')
  .option('--host', 'Expose to network', false)
  .action(async (docsDir: string, options) => {
    const absoluteDir = path.resolve(docsDir)

    // Check if docs directory exists
    if (!fs.existsSync(absoluteDir)) {
      console.error(chalk.red(`\n❌ Documentation directory not found: ${absoluteDir}`))
      console.error(chalk.dim(`\nRun ${chalk.cyan('moles generate')} first to create documentation\n`))
      process.exit(1)
    }

    // Check if it's a valid VitePress docs directory
    const configPath = path.join(absoluteDir, '.vitepress', 'config.ts')
    if (!fs.existsSync(configPath)) {
      console.error(chalk.red(`\n❌ Not a valid Moles documentation directory`))
      console.error(chalk.dim(`Missing: ${configPath}\n`))
      process.exit(1)
    }

    console.log(chalk.bold.blue('\n🐭 Moles - Documentation Server\n'))
    console.log(chalk.dim(`Serving documentation from: ${absoluteDir}`))
    console.log(chalk.dim(`Press ${chalk.cyan('Ctrl+C')} to stop\n`))

    // Start VitePress dev server
    const args = ['vitepress', 'dev', absoluteDir, '--port', options.port]
    if (options.host) {
      args.push('--host')
    }

    const vitepress = spawn('npx', args, {
      stdio: 'inherit',
      shell: true,
    })

    vitepress.on('error', (error) => {
      console.error(chalk.red(`\n❌ Failed to start server: ${error.message}\n`))
      process.exit(1)
    })

    vitepress.on('close', (code) => {
      if (code !== 0 && code !== null) {
        process.exit(code)
      }
    })
  })

// Build command (for production)
program
  .command('build')
  .description('Build documentation for production deployment')
  .argument('[docs-dir]', 'Documentation directory', './docs')
  .action(async (docsDir: string) => {
    const absoluteDir = path.resolve(docsDir)

    if (!fs.existsSync(absoluteDir)) {
      console.error(chalk.red(`\n❌ Documentation directory not found: ${absoluteDir}\n`))
      process.exit(1)
    }

    console.log(chalk.bold.blue('\n🐭 Moles - Building Documentation\n'))

    const vitepress = spawn('npx', ['vitepress', 'build', absoluteDir], {
      stdio: 'inherit',
      shell: true,
    })

    vitepress.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`\n✨ Documentation built successfully`))
        console.log(chalk.dim(`Output: ${path.join(absoluteDir, '.vitepress', 'dist')}\n`))
      } else {
        process.exit(code ?? 1)
      }
    })
  })

program.parse()
