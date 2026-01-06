# xfollow

A Chrome extension built with [WXT](https://wxt.dev) and [Vue 3](https://vuejs.org/) that simplifies following premium users on X (Twitter).

## Features
- **One-Click Auto-Follow**: Automatically detect and follow all verified "Premium" users in any X thread.
- **Smart Detection**: Identifies blue checkmarks within thread replies.
- **Modern UI**: Sleek, premium interface consistent with modern web standards.

## Tech Stack
- **Framework**: WXT
- **UI Architecture**: Vue 3 (Composition API)
- **Styling**: Vanilla CSS (Premium Aesthetics)
- **Language**: TypeScript

## Getting Started
1. **Clone the repo**
2. **Install dependencies**: `npm install`
3. **Start development**: `npm run dev`
4. **Load the extension**: Open Chrome, go to `chrome://extensions`, enable "Developer mode", and "Load unpacked" from the `.output/chrome-mv3` folder.

## Documentation
- [Architecture & Logic](./docs/specification.md)
- [Development Tasks](./docs/tasks.md)
- [AI Agent Instructions](./agents.md)
