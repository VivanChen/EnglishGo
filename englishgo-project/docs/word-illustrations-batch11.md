# Elementary illustrations: batch 11

Added 12 independently generated watercolor-and-pencil illustrations on 2026-09-22:

chicken, tiger, lion, snake, goat, kangaroo, koala, panda, airplane, boat, truck and ship.

The catalog now contains 136 images for 130 elementary words. All 12 words already
exist in the local elementary word bank. The six missing cloud word-bank entries
(goat, kangaroo, koala, panda, truck and ship) were added with bilingual examples;
existing cloud words were preserved.

## Assets and prompts

- Generated with built-in image_gen, one independent generation per word.
- All 12 original images visually reviewed for subject, anatomy, framing and style.
- Exact prompts and original source paths: `word-illustrations-generation-batch11.json`.
- Final files: `public/images/vocabulary/elementary/<word>-01-v1.webp`.
- All files are 1024 x 1024 WebP, between 90,404 and 174,686 bytes.
- Bilingual senses, captions and accessible descriptions: `src/data/wordIllustrations.json`.
- Reproducible seeds: `supabase/seed_word_bank_20260922_batch11.sql` followed by
  `supabase/seed_word_illustrations_20260922_batch11.sql` (upload images first).

## Publication and verification

- All 12 public Storage downloads match the local SHA-256 hashes.
- Anonymous catalog reads return HTTP 200 with 136 images for 130 words.
- All 136 cloud records match local bilingual image metadata; every local image
  is a valid 1024 x 1024 WebP.
- All six added cloud vocabulary entries join to their intended illustration.
- Temporary import used JWT validation, a private token, a filename/hash allowlist,
  a 350 KB size limit, a 30-minute expiry and uploads without overwriting objects.
  The importer was deactivated and returned HTTP 410; the local token was removed.
  Database and Storage policies were not changed.
- Desktop panda card: correct full illustration and bilingual captions, no horizontal overflow.
- Mobile at 390 x 844: no horizontal overflow, all four sticky rating buttons
  inside the viewport, full illustration caption and main example reachable by scrolling.
  Temporary viewport override reset after checking.
- Browser check used the bundled WebP (decoded size 1024 x 1024). Three asynchronous
  message-channel errors were captured, and the local cloud TTS route returned 404
  with device-speech fallback. No illustration loading error was observed; this
  does not claim a clean console or verified cloud audio.
- Production build passed with the existing large-chunk warning.
- Additional production-browser check: the panda word card loaded but no back
  illustration appeared. Public Storage and catalog API verification passed;
  the currently deployed frontend was not changed or redeployed. Do not treat
  cloud publication as confirmation that the new images appear on production.
- Illustration component and SRS integration tests passed (5/5).
- Full suite: 701/704 tests passed across 70 files. The three failures were in
  `PetMonopolyJourney.test.jsx`: a 5-second timeout followed by two missing-DOM
  failures. Retrying the complete file with one worker and a 15-second timeout
  passed 12/12 tests and exited 0. No pet-game code was changed.
- `git diff --check` passed.

Cloud images and metadata are live. Bundled assets are ready for the next website
deployment. Netlify was not deployed in this task.
