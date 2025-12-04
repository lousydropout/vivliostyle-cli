# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vivliostyle CLI is a command-line publication tool that generates PDFs and web publications from HTML/Markdown content. It uses Playwright to control a headless browser running the Vivliostyle.js viewer for high-quality PDF output.

## Build and Development Commands

```bash
pnpm install                    # Install dependencies (requires pnpm >=10, Node >=18)
pnpm build                      # Full build: bundle with tsup, typecheck, generate docs
pnpm dev                        # Watch mode for development
pnpm clean                      # Remove dist/ and tmp/
```

## Testing

```bash
pnpm test                       # Run all tests with coverage
pnpm pretest                    # Install Chromium (run before first test)

# Run a single test file
pnpm vitest run tests/builder.test.ts

# Run tests matching a pattern
pnpm vitest run -t "pdf output"

# Watch mode for a specific test
pnpm vitest tests/config.test.ts
```

Tests are in `tests/*.test.ts` and `src/__tests__/*.test.ts`. On Linux, tests use 'forks' pool mode to avoid segfaults with native code.

## Code Formatting

Prettier is used for formatting. Git hooks auto-format staged files on commit via `pretty-quick`. No ESLint is configured.

## Architecture

### CLI Layer (`src/commands/`)

- Each command (build, init, preview) has a `*.parser.ts` for Commander.js options and a main implementation file
- Entry point: `src/cli.ts`

### Core Logic (`src/core/`)

- `build.ts`, `init.ts`, `preview.ts` contain the main business logic for each command
- These are also exposed as the public API via `src/index.ts`

### Configuration (`src/config/`)

- `schema.ts` - Valibot schemas for configuration validation
- `resolve.ts` - Complex config merging and resolution logic
- `load.ts` - Loads `vivliostyle.config.js` files

### Processing Pipeline (`src/processor/`)

- `compile.ts` - Compiles HTML/Markdown to publication format
- `markdown.ts` - Markdown processing via @vivliostyle/vfm
- `html.tsx` - HTML generation using hastscript JSX

### Output Formats (`src/output/`)

- `pdf.ts` - PDF generation via Playwright Chromium
- `epub.ts` - EPUB archive output
- `webbook.ts` - Web publication output

### Vite Integration (`src/vite/`)

- Custom Vite plugins for browser automation, dev server, static serving, and viewer integration
- `vite-adapter.ts` exports the Vite plugin for external use

### Build Pipeline Flow

```
Load Config → Merge Options → Resolve Task → Start Vite Server
→ Compile Assets → Render via Playwright → Post-process → Output
```

## Key Dependencies

- **@vivliostyle/viewer** - Core PDF rendering engine
- **@vivliostyle/vfm** - Markdown processing with Vivliostyle extensions
- **vite** - Dev server and module bundling
- **playwright-core** - Headless browser control
- **valibot** - Runtime schema validation
- **commander** - CLI argument parsing

## Module Exports

The package exports multiple entry points:

- `.` - Main library (build, init, preview functions)
- `./cli` - CLI entry point
- `./schema` - Configuration schema
- `./vite-adapter` - Vite plugin
- `./node-modules` - Node module resolution utilities
