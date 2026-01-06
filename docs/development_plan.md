# Development Plan: xfollow

This roadmap outlines the phases for building the X-Follow Premium chrome extension. For a granular checklist of current progress, see [tasks.md](./tasks.md).

## Phase 1: Research & Discovery
- **DOM Analysis**: Inspect X (Twitter) threads to identify stable CSS selectors for:
  - Verified badges (blue checkmarks).
  - "Follow" buttons in reply threads.
  - Profile links/handles.
- **WXT Configuration**: Configure `wxt.config.ts` with necessary permissions:
  - `storage` (for settings/history).
  - `host_permissions` for `https://x.com/*`.

## Phase 2: Core Automation Logic
- **Content Script Implementation**:
  - Scraper utility to extract all premium users from the current view.
  - MutationObserver to detect new replies as the user scrolls.
- **Follow Queue Engine**:
  - Create a robust queue that processes follow actions.
  - Implement **Randomized Delays** (Human-like behavior) to prevent banning.
  - Implement a "Stop/Pause" mechanism.

## Phase 3: UI/UX Implementation
- **Popup UI (Vue 3)**:
  - Display "Premium Users Found" count.
  - Global "Follow All" button.
  - Session history/logs.
- **In-Page Overlay (Optional but Recommended)**:
  - Inject a "Follow All Premium" button directly into the X thread header or as a FAB (Floating Action Button).
  - Use Vue 3 Shadow DOM injection for styling isolation.

## Phase 4: Data & Persistence
- **Storage Management**:
  - Track which users have been followed to avoid duplicate actions.
  - Save user preferences (e.g., custom delay intervals).
- **Badge Updates**:
  - Update the extension icon badge with the number of detected premium users.

## Phase 5: Hardening & Safety
- **Anti-Bot Mitigation**: Ensure the script doesn't trigger X's automated bot detection.
- **Error Handling**: Gracefully handle "Rate Limited" or "Login Required" states.
- **Selective Following**: Option to filter by follower count or bio keywords (Phase 2 extension).

## Phase 6: Testing & Deployment
- **Developer Testing**: Manual testing on various thread depths and widths.
- **Packaging**: Use `npm run zip` to prepare for Chrome Web Store submission.
