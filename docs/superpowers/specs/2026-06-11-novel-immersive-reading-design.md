# Novel Immersive Reading Design

## Goal

Make the page-turn novel reader the primary chapter experience by entering a spacious immersive layout automatically while keeping all existing reading and learning features accessible.

## Entry And Exit

- Opening or resuming a chapter starts in immersive mode.
- A compact toolbar provides an explicit `退出沉浸` action.
- Exiting immersive mode restores the chapter illustration, full reading controls, reading settings, and chapter navigation.
- The mode applies only to the current chapter session. Returning to the chapter list and opening a chapter starts immersive mode again.

## Immersive Toolbar

- Show the chapter number and title, current page or spread, and chapter progress.
- Keep high-frequency controls available: Chinese visibility, font decrease, font increase, line spacing, vocabulary, quiz, and exit.
- Use compact icon or short-label controls with accessible labels.
- Allow wrapping on narrow screens without clipping text or actions.

## Book Layout

- Desktop keeps the two-page spread and expands it beyond the application's normal 760px content width, up to 1120px while respecting viewport margins.
- Mobile keeps one page and the current safe-area-aware page actions.
- The book remains horizontally centered.
- Page height uses more of the viewport in immersive mode without creating an inner vertical scrollbar.
- Existing measured pagination recalculates when the wider layout changes available page dimensions.

## Preserved Behavior

- Keep horizontal swipe, previous/next buttons, keyboard arrows, reduced-motion support, page-turn animation, bilingual TTS, active speech tracking, progress persistence, vocabulary, and quiz behavior.
- Exiting immersive mode must not reset the current page or stop progress tracking.

## Testing And QA

- Add smoke coverage proving chapters enter immersive mode, the compact toolbar is shown, full controls are hidden, and exit restores them.
- Assert the desktop immersive shell uses the wider responsive width and mobile remains single-page.
- Run the full test suite, production build, and `git diff --check`.
- Verify desktop and mobile rendering, page overflow, tool accessibility, swipe behavior, and console errors in the browser.
