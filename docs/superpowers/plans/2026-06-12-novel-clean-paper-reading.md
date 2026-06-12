# Novel Clean Paper Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the responsive novel reader with clean warm-white paper, clearer book structure, English serif prose, lighter Chinese translation blocks, and a faster 400 ms page turn.

**Architecture:** Keep the existing pagination, page-turn state, speech routing, progress persistence, and responsive page-count behavior. Express the approved visual contract through stable test IDs and inline style values in `NovelM.jsx`, then update the existing smoke coverage before implementing each production change.

**Tech Stack:** React 18, CSS 3D transforms, Vitest, Testing Library, Vite, Browser/Playwright.

---

## File Structure

- Modify `englishgo-project/src/features/NovelM.jsx`
  - Owns the novel page surface, prose and translation typography, spine decoration, page-turn timing, and fallback timer.
- Modify `englishgo-project/src/App.smoke.test.jsx`
  - Owns the rendering and interaction contract for the novel reader.

No content, TTS service, database, Supabase, or Netlify files change.

### Task 1: Lock The Clean-Paper Visual Contract

**Files:**
- Test: `englishgo-project/src/App.smoke.test.jsx`

- [x] **Step 1: Add failing clean-paper and typography assertions**

Extend `adjusts novel reading comfort settings` after the reader opens:

```jsx
expect(screen.getByTestId('novel-reader-panel')).toHaveStyle({
  background: '#E8E4DA',
});
expect(screen.getByTestId('novel-book-spread')).toHaveAttribute(
  'data-book-style',
  'clean-paper',
);
expect(screen.getByTestId('novel-book-spine')).toBeInTheDocument();

const englishParagraphs = await screen.findAllByTestId('novel-reader-text');
expect(englishParagraphs[0]).toHaveStyle({
  fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
});

const translations = screen.getAllByTestId('novel-reader-translation');
expect(translations[0]).toHaveStyle({
  fontFamily: 'inherit',
  borderLeft: '3px solid #D6B873',
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/App.smoke.test.jsx -t "adjusts novel reading comfort settings"
```

Expected: FAIL because `data-book-style`, `novel-book-spine`, and `novel-reader-translation` do not yet exist and the old colors/fonts remain.

- [x] **Step 3: Commit the failing test**

```powershell
git add -- englishgo-project/src/App.smoke.test.jsx
git commit -m "Test clean paper novel reader styling"
```

### Task 2: Implement Clean Paper Pages And Typography

**Files:**
- Modify: `englishgo-project/src/features/NovelM.jsx`
- Test: `englishgo-project/src/App.smoke.test.jsx`

- [x] **Step 1: Add stable reading font constants**

Near the novel block helpers, add:

```jsx
const NOVEL_READING_FONT='Georgia, Cambria, "Times New Roman", serif';
const NOVEL_PAPER="#FFFEF9";
const NOVEL_SURROUND="#E8E4DA";
```

- [x] **Step 2: Apply the English and Chinese typography split**

Set English prose to:

```jsx
fontFamily:NOVEL_READING_FONT
```

Add `data-testid="novel-reader-translation"` to the visible Chinese translation container and style it with:

```jsx
fontFamily:"inherit",
background:"#FFF8E9",
border:"none",
borderLeft:"3px solid #D6B873",
borderRadius:"2px 7px 7px 2px"
```

Keep the Chinese audio button and its `speakNovelText(b.zh,"zh-TW",1,b.i)` call unchanged.

- [x] **Step 3: Refine the page and surround surfaces**

Update `pageSheetStyle` to use `NOVEL_PAPER`, a neutral border, restrained outer shadow, and symmetrical inner-page shading. Update `novel-reader-panel` to use `NOVEL_SURROUND`.

Add:

```jsx
data-book-style="clean-paper"
```

to `novel-book-spread`.

Replace the anonymous desktop spine layer with:

```jsx
<div
  data-testid="novel-book-spine"
  aria-hidden="true"
  style={{
    position:"absolute",
    zIndex:3,
    left:"50%",
    top:10,
    bottom:0,
    width:10,
    transform:"translateX(-50%)",
    background:"linear-gradient(90deg,rgba(67,56,42,.08),rgba(255,255,255,.82),rgba(67,56,42,.08))",
    boxShadow:"0 0 12px rgba(55,45,32,.09)",
    pointerEvents:"none",
  }}
/>
```

- [x] **Step 4: Ensure pagination remeasures after font availability**

Add an effect that increments `layoutVersion` after `document.fonts.ready` resolves:

```jsx
useEffect(()=>{
  let active=true;
  document.fonts?.ready?.then(()=>{
    if(active)setLayoutVersion(v=>v+1);
  });
  return()=>{active=false};
},[]);
```

The existing `useLayoutEffect` then reuses the measured block heights without changing the pagination model.

- [x] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/App.smoke.test.jsx -t "adjusts novel reading comfort settings"
```

Expected: PASS.

- [x] **Step 6: Run all novel smoke tests**

Run:

```powershell
npm test -- src/App.smoke.test.jsx -t "novel"
```

Expected: all novel tests pass.

- [x] **Step 7: Commit the implementation**

```powershell
git add -- englishgo-project/src/features/NovelM.jsx englishgo-project/src/App.smoke.test.jsx
git commit -m "Refine novel reader with clean paper styling"
```

### Task 3: Lock The 400 ms Page-Turn Contract

**Files:**
- Test: `englishgo-project/src/App.smoke.test.jsx`

- [x] **Step 1: Add a failing page-turn timing assertion**

In `uses a realistic novel page turn in both directions`, after locating `forwardTurn`, add:

```jsx
expect(forwardTurn).toHaveStyle({
  animation: 'novel-sheet-forward 400ms cubic-bezier(.3,.05,.2,1) forwards',
});
```

After locating `backwardTurn`, add:

```jsx
expect(backwardTurn).toHaveStyle({
  animation: 'novel-sheet-backward 400ms cubic-bezier(.3,.05,.2,1) forwards',
});
```

Assert the embedded style includes the reduced-motion override:

```jsx
expect(document.querySelector('style')?.textContent).toContain(
  '@media (prefers-reduced-motion:reduce)',
);
expect(document.querySelector('style')?.textContent).toContain(
  'animation:novel-sheet-fade 120ms ease-out forwards!important',
);
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/App.smoke.test.jsx -t "realistic novel page turn"
```

Expected: FAIL because the current animation duration is 520 ms.

### Task 4: Implement Faster Weighted Page Turns

**Files:**
- Modify: `englishgo-project/src/features/NovelM.jsx`
- Test: `englishgo-project/src/App.smoke.test.jsx`

- [x] **Step 1: Change animation and fallback timing**

Change the page-turn layer to:

```jsx
animation:`novel-sheet-${pageTurn.direction} 400ms cubic-bezier(.3,.05,.2,1) forwards`
```

Change the fallback timer from `620` to `480`.

- [x] **Step 2: Refine the keyframe shadow curve**

Use:

```css
@keyframes novel-sheet-forward{
  0%{transform:rotateY(0);filter:brightness(1);box-shadow:-4px 2px 10px rgba(55,44,30,.10)}
  48%{filter:brightness(.9);box-shadow:-22px 8px 32px rgba(55,44,30,.25)}
  100%{transform:rotateY(-180deg);filter:brightness(1);box-shadow:-2px 1px 5px rgba(55,44,30,.05)}
}
@keyframes novel-sheet-backward{
  0%{transform:rotateY(0);filter:brightness(1);box-shadow:4px 2px 10px rgba(55,44,30,.10)}
  48%{filter:brightness(.9);box-shadow:22px 8px 32px rgba(55,44,30,.25)}
  100%{transform:rotateY(180deg);filter:brightness(1);box-shadow:2px 1px 5px rgba(55,44,30,.05)}
}
```

Keep the existing 120 ms reduced-motion fade.

- [x] **Step 3: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/App.smoke.test.jsx -t "realistic novel page turn"
```

Expected: PASS.

- [x] **Step 4: Run all novel smoke tests**

Run:

```powershell
npm test -- src/App.smoke.test.jsx -t "novel"
```

Expected: all novel tests pass.

- [x] **Step 5: Commit the motion change**

```powershell
git add -- englishgo-project/src/features/NovelM.jsx englishgo-project/src/App.smoke.test.jsx
git commit -m "Speed up weighted novel page turns"
```

### Task 5: Full Verification And Publish

**Files:**
- Verify: `englishgo-project/src/features/NovelM.jsx`
- Verify: `englishgo-project/src/App.smoke.test.jsx`
- Update: `docs/superpowers/plans/2026-06-12-novel-clean-paper-reading.md`

- [x] **Step 1: Run deterministic checks**

From `englishgo-project` run:

```powershell
npm test
npm run build
```

From the repository root run:

```powershell
git diff --check
```

Expected: zero test failures, successful Vite build, and no whitespace errors.

- [x] **Step 2: Run desktop browser QA**

At a desktop viewport verify:

- Two pages render as one open clean-paper book.
- The spine is visible but does not cover text.
- English prose is serif; Chinese translation is sans-serif.
- Forward and backward turns land cleanly in about 400 ms.
- Rapid clicks remain locked during a turn.
- No clipping, horizontal overflow, console errors, or failed local media.

- [x] **Step 3: Run mobile browser QA**

At 390 x 844 verify:

- One page renders.
- Paper, translation, and controls fit without horizontal overflow.
- Swipe and button turns remain inside the reader bounds.
- No prose, translation, page metadata, or bottom action is clipped.

- [x] **Step 4: Mark this plan complete**

Change all remaining task checkboxes from `[ ]` to `[x]`.

- [x] **Step 5: Commit verification records**

```powershell
git add -- docs/superpowers/plans/2026-06-12-novel-clean-paper-reading.md
git commit -m "Mark clean paper reader plan complete"
```

- [x] **Step 6: Push `main`**

```powershell
git push origin main
```

Expected: remote `main` advances through the clean-paper implementation commits.
