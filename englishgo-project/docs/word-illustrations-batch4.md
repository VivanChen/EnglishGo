# Elementary illustrations: batch 4

Added 10 watercolor-and-pencil images for existing elementary words:
rabbit, turtle, bear, elephant, bus, bike, car, cake, sun, and moon.
Each image includes a matching English example, Traditional Chinese translation,
and accessible image description in `src/data/wordIllustrations.json`.

Generated individually with the built-in image_gen tool, using the existing cat
illustration as the style reference. Exact prompts and original source paths are
recorded in `word-illustrations-generation-batch4.json`.
Final assets are 1024 x 1024 WebP files under
`public/images/vocabulary/elementary/<word>-01-v1.webp`.

## Cloud publication

- All 10 Storage uploads were downloaded publicly and matched local SHA-256 hashes.
- Total new asset size: 1,304,412 bytes; each file is below the 350 KB bucket limit.
- Anonymous Data API returned HTTP 200 and all 10 new records.
- Local and cloud catalogs now cover 38 elementary words with 44 images.
- Reproducible content seed: `supabase/seed_word_illustrations_20260921_batch4.sql`.
- Temporary import used JWT verification, a private token, exact file/hash allowlist,
  and 30-minute expiry. It was deactivated afterward (HTTP 410 verified), and the
  local token removed. Existing table and bucket permissions were preserved.

Cloud additions are available through the existing loader. Local fallback assets
and metadata require the next repository deployment; no commit, push, or Netlify
deployment was performed for this batch.

## Verification

- All 44 local entries have existing asset paths, bilingual captions, and unique
  level/word/order keys. All 10 generated images were visually inspected.
- Desktop rabbit card rendered its 1024px local image and matching captions.
- At 390 x 844, the rabbit image, bilingual caption, speech control, and rating
  buttons remain visible when scrolled into view; no horizontal overflow.
- Browser console contained no errors; the viewport override was reset.
- Final production build passed with the existing large-chunk warning.
- `git diff --check` passed.
- Full suite: 691/692 passed; the browser-back navigation smoke test failed during
  the concurrent test/build run. The complete smoke file and both illustration
  test files passed on isolated rerun: 3 files, 62/62 tests. No test or runtime
  behavior was changed to obtain the rerun result.
- The final build contains all 10 new WebP assets.
