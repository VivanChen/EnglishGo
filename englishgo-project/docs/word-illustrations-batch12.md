# Elementary illustrations: batch 12

Added 12 independently generated illustrations on 2026-09-22:
train, motorcycle, taxi, bridge, mountain, river, beach, island, lake, sea, forest and star.
The catalog now contains 148 images for 142 elementary words.

## Assets and prompts

- Generated using built-in image_gen, one image per word; all originals visually reviewed.
- Same watercolor-and-colored-pencil style with ivory paper, no labels or watermarks.
- Final files: `public/images/vocabulary/elementary/<word>-01-v1.webp`.
- All images are 1024 x 1024 WebP, from 115,972 to 292,568 bytes.
- Exact prompts and source PNG paths: `word-illustrations-generation-batch12.json`.
- Bilingual senses, captions and accessible descriptions: `src/data/wordIllustrations.json`.
- Added train to the local elementary bank with a bilingual example. Local bank now
  has 873 words and 36 transportation words; existing coverage assertions updated.
- Added the three absent cloud elementary entries (train, motorcycle, taxi), preserving existing rows.
- Reproducible seeds: `supabase/seed_word_bank_20260922_batch12.sql` then
  `supabase/seed_word_illustrations_20260922_batch12.sql`, after uploading assets.

## Publication and verification

- All 12 public Storage downloads match local SHA-256 hashes.
- Anonymous catalog reads return HTTP 200: 148 images for 142 words.
- All 148 cloud entries match local bilingual metadata; all local images are valid 1024 x 1024 WebP.
- The three added vocabulary entries join to the intended illustration records.
- Temporary importer required JWT validation and a private token, allowed only the
  12 approved paths and hashes, limited streamed uploads to 350 KB, expired after
  30 minutes and never overwrote Storage objects. It was closed (verified HTTP 410)
  and its local private token removed. Database and Storage policies unchanged.
- Desktop island card: correct bundled image decoded at 1024 x 1024, captions present,
  no horizontal overflow, complete island visible.
- Mobile 390 x 844: no horizontal overflow; four rating buttons visible in viewport;
  illustration captions and main example reachable by scrolling. Viewport override reset.
- Browser error/warning log was empty during this check. The UI separately reported
  cloud TTS HTTP 404 and used device-speech fallback; cloud audio was not verified.
- Production build passed with the existing chunk-size warning.
- Full suite initially passed 702/704 tests; two assertions still expected the
  previous elementary/transportation word counts. Updated both assertions for
  the added train entry. Complete vocabulary/illustration files passed 16/16 on
  rerun, and the complete app smoke file passed 57/57. No remaining test failures.
- `git diff --check` passed; 12 original PNG sources and 12 final WebPs exist,
  and all 148 catalog IDs are unique. Final batch size is 2,314,320 bytes.

Cloud images and metadata are published. Bundled assets are ready for the next
website deployment. Netlify was not deployed and production-page rendering was
not verified in this batch.
