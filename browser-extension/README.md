# Ethan Browser Extension

Chrome/Edge extension that injects Ethan AI Workflow prompts into GitHub PR pages and any web page.

## Features

- **⚡ Popup**: 6 quick-action buttons + 9 Skill shortcuts
- **📋 PR Review**: Inject "Ethan Review" button directly into GitHub PR pages
- **🔍 Context Menu**: Right-click on any selected code/text to generate prompts
- **📋 Code Review**: Blocker/Major/Minor graded review
- **📖 Code Explain**: Multi-level code explanation
- **🏷️ Naming**: Naming candidates in camelCase/PascalCase/snake_case
- **🗣️ Standup**: Generate standup scripts from page context

## Installation (Developer Mode)

1. Clone the repo or download this folder
2. Open Chrome/Edge → `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select this `browser-extension/` folder
5. The Ethan icon appears in the toolbar

## Usage

### Popup
Click the ⚡ Ethan icon in the toolbar. Use quick-action buttons or Skill shortcuts.

### GitHub PR Pages
Visit any GitHub PR (`/pull/XXX`). An **"⚡ Ethan Review"** button appears in the header — click it to generate a full Code Review prompt.

### Context Menu
Select text on any page → right-click → **Ethan ⚡** → choose action.

### All prompts are copied to clipboard
Paste directly into ChatGPT, Claude, or your AI editor.

## Build Icons

To generate proper PNG icons, run:
```bash
cd icons
node generate-icons.js
# Then convert icon*.svg to icon*.png using your preferred tool
```

Or replace the placeholder `icon*.png` files with your own 16×16, 48×48, 128×128 PNGs.

## Publishing to Chrome Web Store

1. Zip the `browser-extension/` folder
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Upload the zip and fill in the store listing

## License
MIT
