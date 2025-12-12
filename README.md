# Moles

AI Agent that generates documentation for code repositories.

## Features

- **AI-Powered Analysis**: Uses LLM to understand code structure and generate meaningful documentation
- **VitePress Output**: Generates professional documentation site with VitePress
- **Multi-language**: Supports English and Chinese documentation
- **Transparent Process**: Saves analysis state to `.moles/` directory for visibility
- **CLI Tool**: Easy to use command-line interface

## Installation

```bash
# Clone and install
git clone https://github.com/anthropics/moles.git
cd moles
npm install
npm run build
npm link

# Or install globally (when published)
npm install -g moles
```

## Configuration

Create `~/.moles/.env` for global configuration:

```bash
mkdir -p ~/.moles
cat > ~/.moles/.env << EOF
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1  # or your provider
ANTHROPIC_MODEL=claude-sonnet-4-20250514
EOF
```

## Usage

### Generate Documentation

```bash
# Interactive mode
moles

# Quick mode (skip prompts)
moles -y

# Specify language
moles -l zh  # Chinese
moles -l en  # English

# Specify target directory
moles /path/to/project

# All options
moles [directory] [options]
  -o, --output <dir>   Output directory (default: "./docs")
  -v, --verbose        Show detailed reasoning
  -m, --model <model>  LLM model to use
  -l, --language <lang> Documentation language (en/zh)
  -y, --yes            Skip interactive prompts
```

### Preview Documentation

```bash
# Start dev server
moles serve

# Custom port
moles serve -p 3000

# Expose to network
moles serve --host
```

### Build for Production

```bash
moles build
```

## How It Works

Moles uses an AI agent with a **Plan → Execute → Reflect → Generate** loop:

1. **Planning**: Analyzes codebase structure and creates exploration plan (5-8 steps)
2. **Executing**: Runs ReAct loop to understand code using tools (read files, search, etc.)
3. **Reflecting**: Evaluates documentation completeness and adjusts plan if needed
4. **Generating**: Creates VitePress documentation site

### State Files

During analysis, Moles saves state to `.moles/` directory:

```
.moles/
├── plan.md          # Current plan with step status
├── memory.json      # Analyzed files and insights
└── progress.log     # Execution log
```

## Output Structure

```
docs/
├── .vitepress/
│   └── config.ts    # VitePress configuration
├── index.md         # Homepage
├── architecture/    # Architecture docs
├── modules/         # Module docs
├── api/             # API reference
└── guide/           # Guides
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT
