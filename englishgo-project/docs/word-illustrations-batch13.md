# Elementary illustrations: batch 13

Added 20 independently generated illustrations on 2026-09-22:
cloud, rainbow, rain, snow, wind, leaf, branch, grass, rock, sand, pond, cave,
towel, lamp, sofa, refrigerator, fan, television, gate and wall.
The catalog now contains 168 images for 162 elementary words.

## Assets and prompts

- Generated using built-in image_gen, one image per word; all originals visually reviewed.
- Same watercolor-and-colored-pencil style with ivory paper, no labels or watermarks.
- Final files: `public/images/vocabulary/elementary/<word>-01-v1.webp`.
- All 20 images are 1024 x 1024 WebP, 69,540–234,380 bytes each; 3,060,740 bytes total.
- Exact prompts and source PNG paths: `word-illustrations-generation-batch13.json`.
- Original PNG copies: `.superpowers/word-art/originals/<word>-01-v1.png`.
- Bilingual senses, captions and accessible descriptions: `src/data/wordIllustrations.json`.
- All 20 words already exist in the local elementary bank. Added six missing cloud
  word-bank entries (towel, lamp, sofa, refrigerator, television, wall), preserving existing rows.
- Reproducible seeds: `supabase/seed_word_bank_20260922_batch13.sql` then
  `supabase/seed_word_illustrations_20260922_batch13.sql`, after uploading assets.

## Publication and verification

- All 20 public Storage downloads match local SHA-256 hashes.
- Anonymous catalog reads return HTTP 200: 168 images for 162 words.
- All 168 cloud entries match local bilingual metadata; all local images are valid 1024 x 1024 WebP.
- All 20 new illustration words join to the intended elementary word-bank entries.
- The temporary importer required JWT validation and a private token, accepted only
  the 20 approved paths and hashes, limited streamed uploads to 350 KB, expired after
  30 minutes and never overwrote Storage objects. It was closed (verified HTTP 410)
  and its local private token removed. Database and Storage policies unchanged.
- Production build passed with the existing chunk-size warning.
- Desktop 1440 px and mobile 390/320 px: cloud, refrigerator and wall cards decoded
  the correct bundled 1024 x 1024 images, used `object-fit: contain`, and had no
  horizontal overflow. Bilingual captions were present in all nine samples.
- At 390 x 844, scrolling brought the cloud caption fully into view above all four
  rating buttons. The complete illustration remains accessible by scrolling.
- Browser failures were local Vite requests to `/.netlify/functions/elevenlabs-tts`
  returning HTTP 404; the app reported device-speech fallback. Cloud audio is not
  verified by this image batch. No broken illustration was found.
- Full test suite: in progress.

Cloud images and metadata are published. Bundled assets are ready for the next
website deployment. Netlify was not deployed and production-page rendering was
not verified in this batch.
