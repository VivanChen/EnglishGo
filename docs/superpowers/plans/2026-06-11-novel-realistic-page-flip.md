# Novel Realistic Page Flip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved 520 ms realistic forward and backward page-turn animation to the responsive novel reader.

**Architecture:** Keep pagination and committed reading progress unchanged. Add a transition object that retains source and target spread indexes, render the target spread beneath an animated source-sheet overlay, and commit the target when the CSS animation completes or its timeout fallback fires.

**Tech Stack:** React 18, CSS 3D transforms, Vitest, Testing Library, Browser/Playwright.

---

### Task 1: Page-Turn Behavior Contract

**Files:**
- Modify: `englishgo-project/src/App.smoke.test.jsx`

- [x] **Step 1: Add a failing forward-turn test**

Open a novel chapter, click `下一頁`, and assert:

```jsx
expect(screen.getByTestId('novel-page-turn')).toHaveAttribute('data-direction', 'forward');
expect(screen.getByRole('button', { name: '下一頁' })).toBeDisabled();
```

Fire `animationEnd` on the page-turn layer and assert `Page 3` is committed.

- [x] **Step 2: Add a failing backward-turn test**

Complete a forward turn, click `上一頁`, assert `data-direction="backward"`, complete the animation, and assert `Page 1` returns.

- [x] **Step 3: Run the focused test**

Run:

```powershell
npm test -- src/App.smoke.test.jsx -t "realistic novel page turn"
```

Expected: FAIL because `novel-page-turn` does not exist.

### Task 2: Realistic Page-Turn State And Layer

**Files:**
- Modify: `englishgo-project/src/features/NovelM.jsx`

- [x] **Step 1: Replace numeric animation state**

Replace `turnDirection` with:

```jsx
const [pageTurn, setPageTurn] = useState(null);
const pageTurnTimerRef = useRef(null);
```

The transition object contains `direction`, `sourceStart`, and `targetStart`.

- [x] **Step 2: Lock and complete transitions**

Implement:

```jsx
const finishPageTurn = () => {
  if (!pageTurn) return;
  setPage(pageTurn.targetStart);
  setPageTurn(null);
};
```

Start turns only while idle, use a 620 ms fallback timer, and clear the timer on unmount.

- [x] **Step 3: Render destination and source sheets**

While turning:

- Render the target spread as the normal stationary pages.
- Render one `novel-page-turn` overlay above it.
- Forward uses the source right page on desktop and source page on mobile.
- Backward uses the source left page on desktop and source page on mobile.
- Render a decorative warm paper back without mirrored readable text.

- [x] **Step 4: Add directional CSS**

Add 520 ms keyframes:

```css
@keyframes novel-sheet-forward {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(-180deg); }
}
@keyframes novel-sheet-backward {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(180deg); }
}
```

Use `transform-style: preserve-3d`, `backface-visibility: hidden`, moving shadows, and correct left/right transform origins.

- [x] **Step 5: Add reduced-motion behavior**

Inside `@media (prefers-reduced-motion: reduce)`, remove 3D keyframes and use a 120 ms opacity transition. Navigation still commits through `animationend` or fallback.

- [x] **Step 6: Run focused novel tests**

Run:

```powershell
npm test -- src/App.smoke.test.jsx -t "novel"
```

Expected: all novel tests pass.

### Task 3: Verification And Publish

**Files:**
- Verify all intended source, test, spec, and plan files.

- [x] **Step 1: Run deterministic checks**

Run:

```powershell
npm test
npx vite build
git diff --check
```

Expected: 93 or more tests pass and build succeeds.

- [x] **Step 2: Run browser QA**

At desktop and 390 px mobile widths verify forward/backward buttons, keyboard arrows, swipe turns, rapid-click locking, correct page landing, no text mirroring, no horizontal overflow, and no console errors.

- [ ] **Step 3: Commit intended changes**

Stage the immersive reader implementation, realistic page-turn implementation, tests, and plan documents. Exclude `vite-5178.*.log`.

- [ ] **Step 4: Push `main`**

Run:

```powershell
git push origin main
```

Expected: remote `main` advances to the new implementation commit.
