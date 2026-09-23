# Elementary illustrations: batch 8

Added 10 watercolor-and-pencil illustrations on 2026-09-22:

cup, glass, bowl, bottle, spoon, fork, knife, chopsticks, pumpkin and chocolate.
All are existing local elementary vocabulary entries.

Each illustration was generated independently with built-in image_gen and
visually reviewed. Exact prompts and original source paths are recorded in
`word-illustrations-generation-batch8.json`. Final 1024 x 1024 WebP assets are
in `public/images/vocabulary/elementary/`; bilingual captions and accessible
descriptions are in `src/data/wordIllustrations.json`.

## Publication and verification

- All 10 public Storage downloads matched the local SHA-256 hashes.
- New images range from 57,374 to 147,014 bytes, each below 350 KB.
- Anonymous Data API reads returned HTTP 200, with 84 images for 78 words.
- All 84 cloud records match the bundled metadata and have valid 1024px WebP files.
- Added missing fork, chopsticks and pumpkin cloud word_bank entries without
  replacing existing vocabulary.
- Reproducible seed: `supabase/seed_word_illustrations_20260922_batch8.sql`.
- Import used JWT validation, a private token, an exact filename/hash allowlist
  and a 30-minute expiry. The importer was deactivated (HTTP 410 verified) and
  the local token removed. No database or Storage policies changed.
- Chrome desktop cup and narrow mobile chopsticks cards loaded the correct
  1024px bundled images with matching bilingual captions and no horizontal
  overflow. All four mobile rating buttons were fully visible, and scrolling
  exposed the complete captions and primary example. Requested mobile viewport
  was 390 x 844; browser zoom yielded a measured 355px CSS viewport. Override reset.
- Console inspection recorded three asynchronous browser message-channel errors
  before the card checks. No additional errors appeared during the mobile check;
  no illustration load failures were observed. A completely clean console is
  therefore not claimed.
- Production build and `git diff --check` passed. Build retains its existing
  large-chunk size warning.
- Full suite: 695/696 tests passed across 70 files. The first test in
  `src/App.learning.test.jsx` could not find the asynchronously loaded SRS card
  within the query wait. Running that entire file independently passed all
  13 tests, including the failed case. No test or application code was changed.
- All 10 new words were checked against the local elementary vocabulary.

Cloud assets and metadata are live. The bundled catalog and fallback files are
ready for the next website deployment; this task did not deploy Netlify.
