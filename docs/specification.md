# Technical Specification: xfollow

This document outlines the logic and technical requirements for the "Auto-Follow Premium Users" chrome extension. Implementation tracking is managed in [tasks.md](./tasks.md).

## 1. Goal
Provide a seamless "Follow All Premium" button when a user navigates to an X (Twitter) thread.

## 2. Core Components

### 2.1 Content Script (`entrypoints/content.ts`)
- **Observation**: Monitors the DOM for X thread components (e.g., `article` elements, tweet containers).
- **Detection Logic**:
  - Scan for "Verified Badge" icons (typically an `svg` with a specific path or `aria-label="Verified account"`).
  - Identify the "Follow" button associated with that user profile within the reply.
- **Action**: 
  - Provide a "Follow All" floating button or inject a button into the thread header.
  - Implement a queue system for clicking "Follow" buttons with a random delay (e.g., 500ms - 2000ms) to mimic human behavior and avoid rate limits/suspicious activity flags.

### 2.2 Popup UI (`entrypoints/popup/`)
- Display current thread statistics (e.g., "Found 12 premium users").
- "Follow All" primary action button.
- Settings: Adjust delay range, skip already followed users.

### 2.3 Background Service Worker (`entrypoints/background.ts`)
- Optional: Manage global state or handle messaging between content scripts if multiple threads are open.
- Handle extension icon badge updates.

### 2.4 DOM Selectors (X / Twitter)
- **Verified Badge**: `svg[aria-label="Verified account"]` or `[data-testid="icon-verified"]`.
- **User Handle**: `span` starting with `@` (found within `[data-testid="User-Names"]`).
- **Follow Button**: 
  - Direct: `button[aria-label^="Follow @"]`.
  - Pattern: `[data-testid$="-follow"]`.
  - *Note*: Follow buttons in threads are often hidden inside "More" menus or hover cards. The extension will primarily use the user handle to trigger follow actions.

## 3. UI/UX Requirements
- **Design Aesthetic**: Premium, dark-mode friendly, using smooth transitions.
- **Feedback**: Show progress indicators when auto-following (e.g., "Following 3/12...").
- **Safety**: Include a "Stop" button to cancel the auto-follow queue immediately.

## 4. Technical Constraints
- **Manifest V3**: Compliant with MV3 security and service worker lifecycle.
- **X DOM Changes**: Since X frequently updates its DOM, selectors must be resilient or easily configurable (using `data-testid` where available).
- **Rate Limiting**: Adhere to X's interaction limits to prevent account shadow-banning.

## 5. Security & Privacy
- No user credentials should be stored.
- Data stays local to the browser.
