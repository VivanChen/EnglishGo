# Elementary illustrations: batch 5

Added 10 watercolor-and-pencil food illustrations on 2026-09-22:
orange (fruit), carrot, tomato, corn, rice, juice, potato, cookie, soup, sandwich.
All are existing elementary vocabulary entries. Captions describe the pictured
objects, with matching Traditional Chinese translations and accessible descriptions.

Generated individually with built-in image_gen using the existing cat artwork
as a style reference. Exact prompts and source paths are preserved in
`word-illustrations-generation-batch5.json`. All ten outputs were visually reviewed.
Final 1024 x 1024 WebP files are in `public/images/vocabulary/elementary/`.

## Publication and verification

- All 10 public Storage downloads matched the local SHA-256 hashes.
- Combined new asset size: 1,156,294 bytes; every file is below 350 KB.
- Anonymous Data API reads returned HTTP 200 and all 54 records for 48 words.
- All 54 local records have corresponding cloud records and valid 1024px WebP files.
- Reproducible seed: `supabase/seed_word_illustrations_20260922_batch5.sql`.
- Import required JWT validation, a private one-time token, an exact file/hash
  allowlist and a 30-minute expiry. After upload, the importer was deactivated
  (HTTP 410 verified), and the local token removed. No table/bucket policies changed.
- Production build passed with the existing large-chunk warning.
- Full test suite: 70 files and 696 tests passed (two workers).
- Desktop sandwich and narrow mobile juice cards loaded their 1024px cloud
  images with matching bilingual captions, no horizontal overflow, and usable
  rating controls. The viewport override was reset. The browser recorded
  extension-style asynchronous message-channel errors on the initial desktop
  visit; no failed illustration requests were observed.

The bundled catalog and all ten fallback images ship together in the repository
deployment, alongside the existing cloud-image CSP and missing-image protections.
