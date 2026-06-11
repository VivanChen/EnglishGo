# Novel Page-Turn Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, horizontally paginated novel reader with a desktop two-page spread and mobile single-page navigation.

**Architecture:** Add pure pagination and spread-navigation helpers, then let `NovelM` measure hidden block samples at the actual page width. The component groups measured blocks into pages, renders one or two paper sheets, and maps TTS/progress to source block indexes.

**Tech Stack:** React 18, browser `ResizeObserver`, CSS transforms, Vitest, Testing Library.

---

### Task 1: Pagination Helpers

**Files:**
- Create: `englishgo-project/src/features/novelPagination.js`
- Create: `englishgo-project/src/features/novelPagination.test.js`

- [x] **Step 1: Write failing tests**

Test that measured block heights are grouped without exceeding capacity, oversized blocks remain addressable, desktop navigation advances by two, mobile navigation advances by one, and block indexes map back to pages.

- [x] **Step 2: Verify the tests fail**

Run: `npm test -- src/features/novelPagination.test.js`

Expected: FAIL because `novelPagination.js` does not exist.

- [x] **Step 3: Implement pure helpers**

Export `paginateByHeight`, `spreadStartForPage`, `nextSpreadStart`, `previousSpreadStart`, and `findPageForBlock`.

- [x] **Step 4: Verify the tests pass**

Run: `npm test -- src/features/novelPagination.test.js`

Expected: PASS.

### Task 2: Responsive Book Reader

**Files:**
- Modify: `englishgo-project/src/features/NovelM.jsx`
- Modify: `englishgo-project/src/App.smoke.test.jsx`

- [x] **Step 1: Add failing UI assertions**

Assert that the reader panel has hidden vertical overflow, mobile renders one sheet, desktop renders a two-column spread, and navigation uses the correct page step.

- [x] **Step 2: Verify the UI tests fail**

Run: `npm test -- src/App.smoke.test.jsx`

Expected: FAIL on the old vertically scrolling panel.

- [x] **Step 3: Implement measurement and rendering**

Measure bilingual block cards in an off-screen page probe, paginate using the helper, render responsive page sheets, add swipe and keyboard navigation, and preserve TTS/progress mapping.

- [x] **Step 4: Verify the UI tests pass**

Run: `npm test -- src/App.smoke.test.jsx`

Expected: PASS.

### Task 3: Full Verification

**Files:**
- Verify all modified files.

- [x] **Step 1: Run automated checks**

Run: `npm test`, `npm run build`, and `git diff --check`.

Expected: all commands succeed.

- [x] **Step 2: Run browser QA**

Open the novel reader at desktop and mobile widths. Confirm two pages versus one page, horizontal navigation, no inner vertical scrollbar, readable text, stable controls, and no console errors.
