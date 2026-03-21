# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-03-21

### Added

- Initial release of Smart Flow Skill cross-platform distribution package
- 7 standard workflow skills: 需求理解、任务拆解、方案设计、执行实现、进度跟踪、任务报告、周报生成
- Support for 4 distribution formats:
  - Markdown rule files for AI editors
  - npm package with CLI (`npx smart-flow`)
  - VS Code extension with `@smartflow` chat participant
  - MCP Server with 7 tools (stdio transport)
- Support for 6 platform targets:
  - Cursor (new `.mdc` format with YAML frontmatter)
  - Cursor (legacy `.cursorrules`)
  - VS Code Copilot (`.github/copilot-instructions.md`)
  - Cline (`.clinerules`)
  - 通义灵码 Lingma (`.lingma/rules/*.md`)
  - 腾讯 CodeBuddy (`CODEBUDDY.md`)
- Single Source of Truth architecture: all content in `src/skills/*.ts`, built to `rules/`
- Trigger-based routing system
- Build scripts: `npm run build:all`, `npm run build:rules`, `npm run build:vscode`
