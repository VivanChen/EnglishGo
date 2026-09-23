# Elementary illustrations: batch 9

Added 10 watercolor-and-pencil illustrations on 2026-09-22:

shirt, tshirt, pants, shorts, skirt, dress, shoes, socks, coat and jacket.
All 10 are existing elementary vocabulary entries in both the local and cloud
word banks. The existing `tshirt` lookup key is preserved; its caption uses
the standard spelling `T-shirt`. No vocabulary entries were replaced.

Each illustration was generated independently with built-in image_gen and
visually reviewed for recognizable clothing, full framing and matching captions.
Exact prompts and original source paths are recorded in
`word-illustrations-generation-batch9.json`. Final 1024 x 1024 WebP assets are
in `public/images/vocabulary/elementary/`; bilingual captions and accessible
descriptions are in `src/data/wordIllustrations.json`.

## Publication and verification

- All 10 public Storage downloads matched the local SHA-256 hashes.
- New files range from 92,134 to 150,218 bytes, each below 350 KB.
- Anonymous Data API reads returned HTTP 200, with 94 images for 88 words.
- All 94 cloud records match the bundled metadata and have valid 1024px WebP files.
- Reproducible seed: `supabase/seed_word_illustrations_20260922_batch9.sql`.
- The temporary importer required JWT validation, a private token, an exact
  filename/hash allowlist and a 30-minute expiry. Uploads refused replacement.
  The importer was deactivated (HTTP 410 verified), and the local token removed.
  No database or Storage policies changed.
- Chrome desktop shirt and narrow mobile shoes cards displayed the correct
  1024px bundled images and matching bilingual captions without horizontal overflow.
  All four mobile rating buttons were fully visible. Scrolling exposed the full
  captions and primary example. Requested viewport: 390 x 844; the browser's
  existing zoom produced a measured 355 x 767 CSS viewport. Override reset.
- The initial localhost session logged asynchronous browser message-channel errors
  and loaded slowly. Checks completed at 127.0.0.1 with no new captured console
  errors or illustration load failures. A completely clean session is not claimed.
- Production build passed, retaining the existing large-chunk size warning.
- `git diff --check` passed.
- Focused illustration checks passed: 5/5 tests across the component and SRS
  integration files, with a clean exit and no unhandled errors.
- Full suite: 691/696 tests passed across 70 files. Five failures affected
  `App.learning.test.jsx`, `PetMonopolyJourney.test.jsx` and `NovelM.test.jsx`
  (timeouts, asynchronous card loading and a missing game element after a timeout).
  Retrying those complete files with one worker and a 15-second test timeout
  passed all 38 assertions, but the process reported one unhandled teardown error:
  the pre-existing reward animation timeout at `src/App.jsx:2183` attempted a
  state update after `window` was torn down. The retry therefore exited 1;
  this is not a clean full-suite pass. Application/test code was not changed.

Cloud assets and metadata are live. Bundled files are ready for the next website
deployment; this task did not deploy Netlify.
