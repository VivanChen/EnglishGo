# Elementary illustrations: batch 7

Added 10 watercolor-and-pencil illustrations on 2026-09-22:
guava, papaya, pineapple, kiwi, mango, cheese, butter, popcorn, hot dog and salad.
All are existing local elementary vocabulary entries.

Each illustration was generated independently with built-in image_gen and
visually reviewed. Exact prompts and original source paths are recorded in
`word-illustrations-generation-batch7.json`. Final 1024 x 1024 WebP assets are
in `public/images/vocabulary/elementary/`; bilingual captions and accessible
descriptions are in `src/data/wordIllustrations.json`.

## Publication and verification

- All 10 public Storage downloads matched the local SHA-256 hashes.
- Each new image is below 350 KB.
- Anonymous Data API reads returned HTTP 200, with 74 images for 68 words.
- All 74 cloud records match the bundled metadata and have valid 1024px WebP files.
- Added seven missing cloud word_bank entries without replacing existing words.
- Reproducible seed: `supabase/seed_word_illustrations_20260922_batch7.sql`.
- Import used JWT validation, a private token, exact filename/hash allowlist and
  a 30-minute expiry. The importer was then deactivated (HTTP 410 verified) and
  the local token removed. No database or Storage policies changed.
- Desktop guava and 390px mobile hot dog cards loaded their 1024px bundled
  illustrations with matching bilingual captions, no horizontal overflow,
  usable rating controls and no recorded browser errors. Viewport reset.
- Full suite: all 70 test files and 696 tests passed (two workers, 15s timeout).
- Production build and `git diff --check` passed; build retains the existing
  large-chunk size warning.

Cloud assets and metadata are live. The bundled catalog and fallback files are
ready for the next website deployment; this task did not deploy Netlify.
