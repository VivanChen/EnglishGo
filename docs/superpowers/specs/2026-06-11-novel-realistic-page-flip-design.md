# Novel Realistic Page Flip Design

## Goal

Replace the current small page tilt with a clear, book-like page turn while preserving the existing desktop two-page spread, mobile single-page reader, navigation methods, reading progress, and TTS behavior.

## Selected Direction

Use the approved **B: Realistic Page Flip** treatment.

- Forward navigation turns the visible right-hand sheet across the spine toward the left.
- Backward navigation turns a sheet from the left toward the right.
- The animation lasts about 520 ms.
- A moving shadow and visible paper back provide depth without cinematic warping.
- Page content changes only after the turn reaches its midpoint or completion, preventing text flashes and duplicated readable content.

## Interaction Contract

The animation applies to every page navigation path:

- Previous and next buttons.
- Left and right arrow keys.
- Horizontal swipe gestures.
- Automatic page changes that keep the active TTS paragraph visible.

Only one turn can run at a time. Navigation controls and swipe handling ignore additional turn requests until the current animation completes. This prevents skipped spreads and mismatched progress.

## Desktop Behavior

Desktop retains the two-page spread.

- Forward: the right page rotates around the center spine from `0deg` toward `-180deg`.
- Backward: a left-side overlay rotates from `0deg` toward `180deg`.
- The stationary destination spread remains underneath the animated sheet.
- The animated sheet uses front and back faces with `backface-visibility: hidden`.
- The spine shadow deepens around the midpoint and relaxes when the sheet lands.

The reader dimensions and pagination algorithm do not change.

## Mobile Behavior

Mobile retains one visible page.

- Forward turns the page from the right edge toward the left.
- Backward turns from the left edge toward the right.
- The same 520 ms timing is used, but shadows are lighter and the page remains within the reader bounds.
- No horizontal document overflow may be introduced.

## State Model

Replace the current numeric `turnDirection` presentation with an explicit transition state:

- `idle`
- `forward`
- `backward`

The state stores the source page/spread and target page/spread during the transition. The visible destination pages are rendered underneath the animated source sheet. At animation completion:

1. Commit the target page.
2. Clear the transition state.
3. Restore navigation input.
4. Preserve the existing reading-progress update flow.

A timeout fallback slightly longer than the CSS duration clears the transition if `animationend` is not delivered.

## Accessibility

Honor `prefers-reduced-motion: reduce`.

- Disable the 3D rotation and moving shadow.
- Change the page immediately.
- Use a 120 ms opacity fade instead.
- Keep keyboard focus on the reader or the activated navigation control.

The animation is decorative; page navigation must remain fully functional without it.

## Visual Details

- Duration: 520 ms.
- Easing: a restrained custom cubic-bezier curve with faster initial lift and a softer landing.
- Perspective: reuse the reader spread perspective near 1400px.
- Paper front: current page background and content snapshot.
- Paper back: warm off-white surface with a subtle reverse-page impression, not readable mirrored text.
- Shadows: strongest near 90 degrees, with no dark overlay across stationary text.
- Borders and corner radii continue the current book styling.

## Testing

Automated smoke coverage will verify:

- Forward navigation exposes a `forward` page-turn state before landing on the target spread.
- Backward navigation exposes a `backward` state.
- Navigation is locked while a turn is active.
- The correct target page is committed after completion.
- Desktop still renders two pages and mobile still renders one.
- Reduced-motion mode skips the 3D transition.

Browser QA will verify:

- Desktop forward and backward turns cross the spine in the correct direction.
- Mobile turns remain inside the viewport.
- Rapid clicks do not skip pages.
- Buttons, keyboard, and swipe produce the same animation.
- Text does not flash, mirror, overlap, or become clipped.
- No horizontal overflow or console errors occur.

## Out Of Scope

- Dragging the page interactively with the pointer.
- Audio or sound effects for page turns.
- Canvas, WebGL, or third-party page-flip libraries.
- Persisting animation preferences.
- Changing pagination, typography, TTS routing, vocabulary, quiz, or chapter progress behavior.
