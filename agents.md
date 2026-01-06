# agents.md

This file provides instructions and context for AI coding agents working on the **xfollow** project.

## Project Overview
- **Name**: xfollow
- **Type**: Chrome Extension
- **Framework**: [WXT](https://wxt.dev)
- **Frontend**: Vue 3 (Composition API)
- **Language**: TypeScript
- **Description**: A Chrome extension that allows users to automatically follow all "premium" (verified) users in an X (Twitter) thread with a single click.
- **Target Site**: `https://x.com/*`

## Environment Setup
- **Node.js**: v18 or higher (v20+ recommended)
- **Package Manager**: npm/pnpm (check for lock files)
- **Target Browsers**: Chrome (primary), Firefox (secondary)

## Core Logic & Mission
- **Objective**: Detect "Premium" (blue checkmark) users in an active X thread and provide a UI to follow all of them automatically.
- **Detection**: Use DOM inspection in `content.ts` to identify the verified badge icon and extract user follow buttons.
- **Automation**: Simulate clicks on "Follow" buttons or use X internal APIs if reachable, ensuring appropriate delays to avoid rate limiting.
- **UI**: A clean, premium-looking popup (`entrypoints/popup/`) and potentially a floating action button (FAB) injected into the X thread via `content.ts`.

## Build & Development
- **Dev Mode**: `npm run dev` (Starts WXT dev server with HMR)
- **Build**: `npm run build` (Generates production-ready extension in `.output/`)
- **Firefox Dev**: `npm run dev:firefox`
- **Packaging**: `npm run zip`

## Project Structure
- `entrypoints/`: Contains the extension's entry points.
  - `background.ts`: Service worker logic.
  - `content.ts`: Content scripts for web page interaction.
  - `popup/`: The popup UI (Vue 3).
- `components/`: Reusable Vue components.
- `assets/`: Image assets and global styles.
- `public/`: Static files copied to build output.
- `wxt.config.ts`: Main configuration for WXT.

## Coding Conventions
- **Vue**: Use `<script setup>` with Composition API and TypeScript.
- **TypeScript**: Use strict types; avoid `any`.
- **WXT API**: Use the `browser` polyfill provided by WXT for cross-browser support.
- **Styling**: Use scoped CSS in Vue components. Maintain a clean, premium UI consistent with modern extension design.

## Task Guidelines for AI Agents
1. **Security**: Never expose API keys or sensitive data. Use `storage.local` or `storage.sync` for persistence.
2. **Permissions**: Only request necessary permissions in `wxt.config.ts`.
3. **Performance**: Keep the background script lightweight. Use idle listeners where possible.
4. **Consistency**: Follow the [tasks.md](./docs/tasks.md) checklist and track progress there.
5. **Documentation**: Keep this `agents.md` file updated as the technology stack or project structure evolves.
