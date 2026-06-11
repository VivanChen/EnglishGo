# Novel Page-Turn Reader Design

## Goal

Replace the novel reader's vertical scrolling experience with a responsive book interface: a two-page spread on desktop and a single page on mobile, navigated horizontally.

## Reading Model

- Paginate chapter blocks from the measured page width and height instead of a fixed five-block page size.
- Keep each English and Traditional Chinese pair together whenever it fits.
- Do not show an inner vertical scrollbar.
- Recalculate pagination after viewport, font size, line height, focus mode, or Chinese visibility changes.
- Preserve the reader's logical position by mapping the active source block back to its new page.

## Interaction

- Desktop shows two consecutive pages and advances by two pages.
- Mobile shows one page and advances by one page.
- Support previous/next controls, keyboard arrow keys, and horizontal swipe gestures.
- Use a short 3D page-turn animation with a reduced-motion fallback.
- Reading aloud follows the visible spread and continues to map active speech to the correct page.

## Visual Design

- Use warm paper surfaces, a central spine on desktop, restrained shadows, and page numbers.
- Keep controls outside the paper content so the available text height is stable.
- Maintain the existing reading settings, bilingual text, vocabulary, quiz, chapter progress, and TTS controls.

## Accessibility

- Keep explicit button labels and disabled states.
- Add a focusable reader region with keyboard navigation instructions through its accessible label.
- Respect `prefers-reduced-motion`.
- Do not require gestures; every gesture action has a button and keyboard equivalent.

## Verification

- Unit-test pagination grouping and spread navigation.
- Update the novel smoke tests for the new non-scrolling reader.
- Run the complete test suite, production build, and `git diff --check`.
- Verify desktop and mobile layouts in the browser, including swipe/controls and absence of reader overflow.
