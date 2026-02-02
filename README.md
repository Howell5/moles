# Moles

An AI-powered documentation agent that analyzes codebases and generates professional VitePress documentation sites.

## Features

- **AI-Powered Analysis**: Uses LLM with a Plan-Execute-Reflect loop to deeply understand code structure
- **Agentic Workflow**: Autonomous exploration with planning, execution, reflection, and generation phases
- **VitePress Output**: Generates production-ready documentation sites with navigation and search
- **Multi-language Support**: Generate documentation in English or Chinese
- **Tool-Based Architecture**: Extensible tool system for code analysis (read files, search code, etc.)
- **Transparent Process**: Saves analysis state to `.moles/` directory for visibility and debugging
- **OpenAI-Compatible**: Works with any OpenAI-compatible API provider

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (ES2022, ESM modules)
- **LLM Integration**: OpenAI SDK (OpenAI-compatible API format)
- **Documentation**: VitePress
- **CLI Framework**: Commander.js
- **Code Quality**: Biome (linting & formatting)

## Architecture

```
src/
├── cli.ts              # CLI entry point with Commander.js
├── types.ts            # Global type definitions
├── agent/
│   ├── index.ts        # Agent coordinator (main loop)
│   ├── planner.ts      # Creates exploration plans (5-8 steps)
│   ├── executor.ts     # Executes plan steps using ReAct pattern
│   ├── memory.ts       # Manages analyzed files and insights
│   └── reflector.ts    # Evaluates completeness, suggests improvements
├── generator/
│   └── index.ts        # Transforms memory into VitePress site
├── llm/
│   └── client.ts       # OpenAI-compatible LLM client
├── tools/
│   └── index.ts        # Tool registry (list_files, read_file, search_code, etc.)
└── utils/
    ├── state.ts        # State persistence (.moles/ directory)
    └── logger.ts       # Logging utilities
```

### Agent Loop

The agent follows a **Plan -> Execute -> Reflect -> Generate** workflow:

1. **Planning**: Analyzes codebase structure and creates a focused exploration plan (5-8 steps)
2. **Executing**: Runs ReAct loop using tools to read files, search code, and build understanding
3. **Reflecting**: Evaluates documentation completeness (0-100%) and identifies gaps
4. **Generating**: Creates VitePress documentation site from accumulated memory

## Installation

```bash
# Clone the repository
git clone https://github.com/Howell5/moles.git
cd moles

# Install dependencies
npm install

# Build the project
npm run build

# Link for global CLI access
npm link
```

## Configuration

Create a global configuration file at `~/.moles/.env`:

```bash
mkdir -p ~/.moles

cat > ~/.moles/.env << 'EOF'
# Your API key (required)
ANTHROPIC_API_KEY=your-api-key-here

# Base URL for third-party providers (optional)
# ANTHROPIC_BASE_URL=https://your-provider.com/v1

# Default model (optional)
# ANTHROPIC_MODEL=claude-sonnet-4-20250514
EOF
```

The CLI looks for `.env` files in this order:
1. Current working directory (`./.env`)
2. Global config (`~/.moles/.env`)
3. Home directory (`~/.env.moles`)

## Usage

### Generate Documentation

```bash
# Interactive mode (prompts for options)
moles

# Quick mode with defaults
moles -y

# Specify target directory
moles /path/to/project

# Choose documentation language
moles -l zh  # Chinese
moles -l en  # English (default)

# Show verbose agent reasoning
moles -v

# Full options
moles [directory] [options]
  -o, --output <dir>     Output directory (default: "./docs")
  -v, --verbose          Show detailed agent reasoning
  -m, --model <model>    LLM model to use
  -l, --language <lang>  Documentation language (en/zh)
  -y, --yes              Skip interactive prompts
  --api-key <key>        API key (overrides env var)
  --base-url <url>       API base URL (overrides env var)
```

### Preview Documentation

```bash
# Start development server (default port 5173)
moles serve

# Custom port
moles serve -p 3000

# Expose to network
moles serve --host

# Specify docs directory
moles serve ./custom-docs
```

### Build for Production

```bash
# Build static site
moles build

# Output: ./docs/.vitepress/dist/
```

## State Files

During analysis, Moles saves its state to the `.moles/` directory in the target project:

```
.moles/
├── plan.md          # Current exploration plan with step status
├── memory.json      # Analyzed files, insights, and doc sections
└── progress.log     # Execution log with timestamps
```

This provides transparency into the agent's reasoning and enables resumption of interrupted analysis.

## Output Structure

The generated documentation follows VitePress conventions:

```
docs/
├── .vitepress/
│   └── config.mjs   # VitePress configuration (sidebar, navigation)
├── index.md         # Homepage with hero section
├── overview/        # Project overview
├── architecture/    # Architecture documentation
├── modules/         # Module-level documentation
├── api/             # API reference
└── guide/           # Usage guides
```

## Available Tools

The agent uses these tools to analyze codebases:

| Tool | Description |
|------|-------------|
| `list_files` | List directory contents with glob filtering |
| `read_file` | Read file contents (full or line range) |
| `search_code` | Search for patterns across files (regex supported) |
| `write_doc` | Save documentation section to memory |
| `add_insight` | Record key insights about the codebase |
| `mark_file_analyzed` | Mark a file as analyzed with summary |

## Development

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Type checking
npm run typecheck

# Lint with Biome
npm run lint

# Format with Biome
npm run format

# Check and fix (lint + format)
npm run check
```

## License

MIT
