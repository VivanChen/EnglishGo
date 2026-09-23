# Elementary illustrations: batch 14

Added 12 independently generated illustrations on 2026-09-23:

body, tooth, neck, shoulder, finger, heart, stomach, knee, doctor, nurse, medicine, headache.

The local catalog now contains 180 images for 174 elementary words.

## Assets and prompts

- Generated with built-in image_gen; each image was reviewed for subject clarity, child-friendly presentation and style.
- Final files: `public/images/vocabulary/elementary/<word>-01-v1.webp`.
- All 12 images are 1024 × 1024 WebP, from 69,114 to 231,060 bytes; 1,494,924 bytes total.
- Original PNGs are preserved in `.superpowers/word-art/originals/`; exact prompts and source paths are in `word-illustrations-generation-batch14.json`.
- Bilingual senses, examples, captions and accessible descriptions are in `src/data/wordIllustrations.json`.
- The 12 words already exist in the local elementary word list. Added seven missing cloud vocabulary rows without replacing existing data; apply `supabase/seed_word_bank_20260923_batch14.sql` before the illustration metadata seed.
- Illustration metadata seed: `supabase/seed_word_illustrations_20260923_batch14.sql`; upload all image files before applying it.

## Publication

All 12 public Supabase Storage downloads match the bundled WebP files by SHA-256.
The database contains 12 illustration rows for 12 words; every illustration joins
to an elementary word-bank entry. Seven missing cloud word-bank rows were added
without replacing existing data.

The temporary importer required a valid JWT and a fresh random 256-bit token. It
accepted only these 12 approved paths and hashes, limited image bodies to 350 KB,
used non-overwriting uploads, and expired after 30 minutes. It was redeployed as
an inert HTTP 410 handler after upload; the local private token was removed. The
function still requires JWT verification, and Storage/Database policies were not
changed.

Cloud images and metadata are published. Bundled assets are ready for the next
website deployment; production page rendering was not checked in this batch.
