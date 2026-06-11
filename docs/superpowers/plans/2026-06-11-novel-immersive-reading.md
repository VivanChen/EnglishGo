# Novel Immersive Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every opened novel chapter start in a wide immersive book layout with a compact toolbar and a reversible full-controls view.

**Architecture:** Keep immersive mode as chapter-session React state rather than a persisted reading preference. Wrap the chapter reader in a responsive shell that can escape the application's 760px content constraint on desktop, while the existing measured pagination reacts to the wider reader through `ResizeObserver`.

**Tech Stack:** React 18, inline responsive styles, Vitest, Testing Library, Browser/Playwright.

---

### Task 1: Immersive Mode Contract

**Files:**
- Modify: `englishgo-project/src/App.smoke.test.jsx`

- [x] **Step 1: Add failing chapter-entry assertions**

Assert that opening a chapter shows `novel-immersive-toolbar` and `novel-immersive-shell`, hides the hero, full settings, and chapter navigation, and exposes an `退出沉浸` button.

- [x] **Step 2: Add failing exit assertions**

Click `退出沉浸` and assert the hero, full settings, and chapter navigation return without changing the current page.

- [x] **Step 3: Add responsive assertions**

Assert the desktop shell uses `min(1120px, calc(100vw - 32px))`, while mobile remains `100%` wide with one visible book page.

- [x] **Step 4: Run focused tests**

Run: `npm test -- src/App.smoke.test.jsx -t "novel"`

Result: PASS, 7 novel tests.

### Task 2: Immersive Reader Implementation

**Files:**
- Modify: `englishgo-project/src/features/NovelM.jsx`

- [x] **Step 1: Add chapter-session immersive state**

Initialize immersive mode to true when a chapter opens or resumes. Do not persist it in `novelReadingPrefs`.

- [x] **Step 2: Add the compact toolbar**

Render chapter title, page/spread, progress, page TTS, Chinese toggle, font size controls, line spacing, vocabulary, quiz, and `退出沉浸`.

- [x] **Step 3: Restore the full view**

Hide the hero, settings, and chapter navigation while immersive. In full view, show an `進入沉浸` button and retain every existing control.

- [x] **Step 4: Add the wide responsive shell**

Center a desktop shell up to 1120px using viewport-relative width and keep mobile at 100%. Increase immersive reader height while preserving no-overflow pagination.

- [x] **Step 5: Run focused tests**

Run: `npm test -- src/App.smoke.test.jsx -t "novel"`

Result: PASS, 7 novel tests.

### Task 3: Verification

**Files:**
- Verify all modified files.

- [x] **Step 1: Run deterministic checks**

Run: `npm test`, `npm run build`, and `git diff --check`.

Result: PASS, 93 tests and production build.

- [x] **Step 2: Run browser QA**

Verify desktop wide two-page layout, mobile single-page layout, exit/re-enter behavior, swipe navigation, no clipped toolbar or page content, no horizontal overflow, and no console errors.

Result: PASS at 1280x720 and 390x844.
