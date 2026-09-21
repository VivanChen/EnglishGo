# Elementary illustrations: batch 3

Added 12 watercolor-and-pencil images for 10 existing elementary words:
bag, ball, bread, egg, flower, hat, milk, tree, in, and on.
In has a cat inside a box and apples inside a basket. On has a book resting
on a table and a cat sitting on a chair.

Generated with the built-in image_gen tool and the approved style reference.
Exact prompts and original paths: `word-illustrations-generation-batch3.json`.
Final 1024px WebP files: `public/images/vocabulary/elementary/`.
Bilingual captions and offline fallback: `src/data/wordIllustrations.json`.

## Cloud publication

- All 12 uploads were downloaded publicly and matched local SHA-256 hashes.
- New asset size: 1,989,672 bytes. Each file is below the 350 KB bucket limit.
- Anonymous Data API reads returned HTTP 200 and all 12 new metadata entries.
- Elementary coverage now totals 28 words and 34 images.
- The temporary importer was deactivated (HTTP 410 verified), its local token
  removed, and the existing bucket/table permissions preserved.
- Ball's unsuitable main example was replaced with “Let's play with the ball.”
  / “我們一起玩球吧。”. The seed includes a guarded update of the old example.

No frontend logic changes were required. Cloud additions are available through
the existing loader. Bundled offline additions require a normal repository deploy;
this batch has not been committed or pushed to GitHub.

## Verification

- All 34 local catalog entries had valid asset paths, bilingual captions and
  unique level/word/order keys.
- Desktop in card loaded both new images directly from Supabase Storage.
- Narrow mobile in card switched to 2/2, with no horizontal page overflow.
- Viewport override was reset after checking.
- Browser console recorded extension-style asynchronous message-channel errors;
  the inspected images loaded successfully with no broken media observed.
- Production build and `git diff --check` passed (existing large-chunk warning).
- Full suite passed: 70 test files, 692 tests (two workers, 15-second timeout).
- Desktop on card also loaded both cloud images with the matching bilingual captions.
