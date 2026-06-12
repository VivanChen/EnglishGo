# Novel Clean Paper Reading Design

## Goal

Improve the English novel reader so it feels closer to reading a physical book while remaining comfortable for long sessions.

The selected direction is:

- **Priority A:** Make the reader feel like a real book.
- **Visual style A:** Clean paper.
- **Page-turn duration:** 400 ms.

This iteration refines the existing responsive reader. It does not add a new reading mode or change the content, speech, quiz, or persistence architecture.

## Visual Direction

### Paper And Surround

- Replace the current strongly yellow reader surround with a quieter neutral warm gray.
- Use a warm off-white page surface close to white, avoiding an aged or strongly yellow paper effect.
- Keep paper texture implicit through borders, shadows, and color rather than adding a bitmap texture.
- Use restrained outer shadows so the spread separates from the reader surround without appearing like a floating card.

### Book Structure

- Desktop continues to display a two-page spread.
- Mobile continues to display one page.
- Strengthen the desktop center spine with:
  - A narrow central gutter.
  - Symmetrical inner-page shading.
  - A subtle highlight at the fold.
- Refine outer page edges and corner radii so the two pages read as one open book.
- Keep all decorative layers behind readable content and non-interactive.

### Typography

- English novel prose uses a readable serif stack suitable for narrative text.
- Interface text, page metadata, buttons, and Traditional Chinese text retain the existing sans-serif stack.
- English and Chinese text keep the existing user-controlled font size and line-height behavior.
- Font changes must not alter the existing block pairing or pagination data model.
- Pagination must remeasure after the serif font is available so no prose is clipped.

### Chinese Translation Blocks

- Retain the current warm translation treatment, but reduce the full bordered-box appearance.
- Use a light warm background and a restrained left accent to distinguish translation from English prose.
- Chinese translation remains visually secondary but must retain sufficient contrast.
- The Chinese pronunciation button continues to use the novel-only Chinese API TTS route.

## Page-Turn Motion

- Change the page-turn duration from 520 ms to **400 ms**.
- Apply the duration consistently to:
  - Previous and next buttons.
  - Left and right arrow keys.
  - Horizontal swipe gestures.
  - Automatic page changes during chapter narration.
- Preserve the current forward and backward rotation directions.
- Preserve the current single-transition lock so repeated input cannot skip spreads.
- Increase the perceived paper weight through shadow timing:
  - Light shadow during lift.
  - Strongest shadow near the center of the turn.
  - Fast shadow reduction as the page lands.
- Keep the decorative paper back free of readable mirrored content.
- Reduce the timeout fallback from 620 ms to a value slightly above the new animation duration.

## Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- Do not perform the 3D page rotation.
- Use the existing short opacity transition.
- Commit the same target page.
- Preserve keyboard, button, swipe, narration, focus, and progress behavior.

## Interaction And Data Contracts

The following behavior remains unchanged:

- Desktop two-page and mobile one-page pagination.
- Button, keyboard, and swipe navigation.
- Reading-progress persistence and resume position.
- Font-size and line-height preferences.
- English, Chinese, and bilingual narration controls.
- Novel-only Chinese API TTS routing.
- ElevenLabs voice configuration and cached audio storage behavior.
- Vocabulary and quiz panels.
- Chapter completion and XP.

The reader must remain focused after keyboard navigation. Pointer-activated controls keep their normal browser focus behavior.

## Implementation Boundaries

Keep the implementation scoped to the novel reader and its tests.

Expected files:

- `englishgo-project/src/features/NovelM.jsx`
- `englishgo-project/src/App.smoke.test.jsx`

No database migration, Netlify configuration, novel content, or TTS service change is required.

## Automated Testing

Add or update smoke coverage to verify:

- The page-turn layer uses a 400 ms animation.
- Forward and backward navigation still expose the correct transition direction.
- Navigation remains disabled while a turn is active.
- Desktop still renders two pages.
- Mobile still renders one page.
- English prose receives the serif reading font.
- Traditional Chinese translation remains on the sans-serif UI font.
- Reading size and line-height controls still affect both pagination and visible content.
- The reduced-motion CSS rule remains present and overrides the 3D animation.

Tests should assert stable behavior or explicit style contracts rather than browser-rendered shadow pixels.

## Browser QA

Verify at desktop and narrow mobile viewports:

- The desktop spread reads as one open book with a clear but subtle spine.
- Warm off-white paper is comfortable and not visibly yellow.
- English serif prose and Chinese sans-serif translation are easy to distinguish.
- Translation styling does not dominate the page.
- Forward and backward turns complete in about 400 ms and land cleanly.
- Rapid input does not skip pages.
- No prose, translation, controls, or page metadata are clipped.
- No horizontal document overflow is introduced.
- No console errors or failed local assets appear.

## Success Criteria

The iteration is complete when:

- The reader clearly resembles a clean physical book on desktop and mobile.
- Continuous page navigation feels faster than the current 520 ms version.
- Existing reading, narration, progress, quiz, and responsive behavior remains intact.
- Automated tests and the production build pass.
- Desktop and mobile browser QA show no clipping, overflow, or console errors.

## Out Of Scope

- Aged paper, visible paper grain, or bitmap textures.
- Page-curl dragging or interactive physics.
- Page-turn sound effects.
- New reading themes or a theme selector.
- Toolbar redesign or control consolidation.
- New bookmarks, annotations, highlights, or progress navigation.
- Changes to Chinese voice selection, ElevenLabs routing, Supabase, or Netlify.
