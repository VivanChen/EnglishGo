# Elementary illustrations: batch 6

Added 10 watercolor-and-pencil illustrations on 2026-09-22:
grape, watermelon, strawberry, lemon, peach, ice cream, pizza, hamburger,
candy and noodles. All are existing local elementary vocabulary entries.

Each image was generated independently with built-in image_gen and visually
reviewed. The exact prompts and original source paths are in
`word-illustrations-generation-batch6.json`. Final 1024 x 1024 WebP assets are
in `public/images/vocabulary/elementary/`, with matching bilingual captions
and accessible descriptions in `src/data/wordIllustrations.json`.

## Publication and verification

- All 10 public Storage downloads matched the local SHA-256 hashes.
- Each new WebP is below 350 KB.
- Anonymous Data API reads returned HTTP 200, with 64 images for 58 words.
- All 64 cloud records match the bundled metadata and have valid 1024px WebP files.
- Added the six missing cloud word_bank entries without replacing existing words.
- Reproducible seed: `supabase/seed_word_illustrations_20260922_batch6.sql`.
- Import used JWT validation, a private token, exact filename/hash allowlist and
  a 30-minute expiry. Afterwards the endpoint was deactivated (HTTP 410 verified)
  and the local token removed. No database or Storage policies were changed.
- Production build passed with the existing large-chunk warning.
- Full suite: 694/696 tests passed across 70 files. A focused rerun passed
  all 75 tests in App.learning, App.smoke,
  App.illustrations and WordIllustrations with one worker and a 15-second
  timeout. The first full run encountered a five-card mission timeout and
  a song playback recovery assertion failure; both passed on this rerun.
- Desktop watermelon and 390px mobile watermelon/ice cream cards loaded their
  1024px bundled pictures with matching bilingual captions, no page overflow,
  usable rating controls and no recorded browser errors. Viewport override reset.

Cloud assets and metadata are live. The bundled catalog and fallback files are
ready for the next website deployment; this task did not deploy Netlify.
