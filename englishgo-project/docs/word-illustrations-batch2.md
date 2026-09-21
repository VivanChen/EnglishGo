# Elementary illustrations: batch 2

Added 12 watercolor-and-pencil images for 11 existing elementary words:
cat, dog, bird, fish, banana, book, pencil, chair, read, hungry, and between.
Between has two scenes: a cat between flowerpots and a child between friends.

Generated with the built-in image_gen tool using the previously approved style.
The exact prompts and original file paths are in
`word-illustrations-generation-batch2.json`. Final 1024px WebP assets live in
`public/images/vocabulary/elementary/`; metadata and offline fallback entries
are in `src/data/wordIllustrations.json`.

## Cloud publication

- All 12 files were uploaded to the existing public `word-illustrations` bucket.
- All 12 public downloads matched their local SHA-256 hashes, totaling 1,935,050 bytes.
- The anonymous Data API returned HTTP 200 and all 12 new catalog records.
- The elementary catalog now contains 22 images across 18 words.
- The temporary importer was deactivated and verified to return HTTP 410;
  its local import token was removed. Storage/table permissions were unchanged.
- The existing incorrect elementary cat example was corrected to
  “The cat is sitting.” / “貓正坐著。”. The seed includes a guarded update.

No frontend logic changes were needed. Cloud additions are available through
the already-deployed illustration loader. The new bundled offline assets become
available on the production site after the next normal repository deployment.

## Verification

- Every local catalog entry has an existing asset, bilingual captions and a
  unique grade/word/order combination (22 entries checked).
- Desktop between card loaded both images directly from Supabase Storage.
- Narrow mobile layout switched to 2/2; page width equaled viewport width.
- The temporary mobile viewport override was reset.
- Browser console recorded extension-style asynchronous message-channel errors;
  both cloud illustrations loaded successfully with no broken images observed.
- Production build passed with the existing chunk-size warning.
- Full test suite passed: 70 files, 692 tests, with two workers and a 15-second
  per-test timeout. The front/back GIF and illustration integration test passed.
- The cat card was reopened and its corrected main example was verified in the UI.
- `git diff --check` passed. This batch has not been committed or pushed to GitHub.
