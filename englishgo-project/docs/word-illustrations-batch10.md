# Elementary illustrations: batch 10

Added 30 independently generated watercolor-and-pencil illustrations on 2026-09-22:

cap, pen, eraser, ruler, notebook, paper, desk, table, bed, clock, mirror, door,
window, computer, phone, toy, doll, kite, soccer, basketball, baseball, gift,
duck, cow, pig, sheep, horse, monkey, bee and mouse.

All 30 are existing elementary words in both local and cloud word banks and
previously had no illustration. The catalog now has 124 images for 118 words.

Each image was generated with built-in image_gen and visually reviewed for the
intended subject, framing, style and bilingual caption alignment. Soccer uses a
kicking scene to convey the sport. Exact prompts and original PNG source paths
are in `word-illustrations-generation-batch10.json`. Final 1024 x 1024 WebP
files are in `public/images/vocabulary/elementary/`; bilingual examples,
senses and accessible descriptions are in `src/data/wordIllustrations.json`.

## Publication and verification

- All 30 public Storage downloads matched the local SHA-256 hashes.
- Files range from 67,256 to 178,378 bytes (all below 350 KB).
- Anonymous catalog reads return HTTP 200: 124 images, 118 words.
- All 124 cloud records match local bilingual metadata and have valid 1024px WebP assets.
- Reproducible seed: `supabase/seed_word_illustrations_20260922_batch10.sql`.
- Import used JWT validation, a private token, exact filename/hash allowlist and
  a 30-minute expiry. Existing objects could not be overwritten.
  Importer deactivation returned HTTP 410; its local private token was removed.
  No database or Storage policies changed.
- Desktop soccer card: correct 1024px illustration and bilingual captions.
- Phone check requested 390 x 844; existing browser zoom measured 355 x 767 CSS
  pixels. No horizontal overflow; all four sticky rating buttons visible.
  Scrolling revealed the full illustration caption and main example.
  Temporary viewport override reset.
- Browser checks used bundled images. Initial navigation captured three
  asynchronous browser message-channel errors. Local cloud TTS returned 404
  and used device speech fallback. These checks do not claim a clean console
  or working cloud audio; no illustration loading failure was observed.
- Production build passed with the existing large-chunk warning.
- Illustration component and SRS integration tests passed (5/5) within the full run.
- Full suite: 701/704 tests passed across 70 files. Three failures in
  `App.learning.test.jsx` and `App.smoke.test.jsx` could not find the SRS card,
  AI tutor or translation-reader UI after navigation. These flows were not
  modified by the image batch. Retrying both complete files with one worker
  passed all 70/70 tests and exited 0, with no unhandled errors reported.
- `git diff --check` passed.

Cloud images and metadata are live. Bundled assets are ready for the next
website deployment; Netlify was not deployed in this task.
