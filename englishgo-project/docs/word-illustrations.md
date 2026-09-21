# Elementary vocabulary illustrations

## Image delivery repair (2026-09-22)

The catalog now contains 44 images for 38 elementary words. All 44 public
Supabase Storage downloads matched the bundled files by SHA-256 during the audit.
The cloud metadata also points to the corresponding Storage and fallback paths.

Both Netlify configurations permit Supabase in `img-src`. Previously, browsers
blocked every cloud illustration, and only the initial 10 bundled images could
recover through the fallback. The later 34 fallback files and their catalog are
included together in this release.

Missing vocabulary images return HTTP 404 instead of the SPA document. Service
worker v1.2.7 clears the old caches, rejects HTML image responses, and bypasses
old HTML cache entries. Offline vocabulary failures reach the card's accessible
description instead of displaying the unrelated app icon. Valid cached images
remain available offline.

The first approved watercolor/pencil batch contains 10 illustrations for 7 words:
apple, umbrella, jump, sleepy, happy (one each), under (two), internet (three).
Each scene describes the same intended sense of its word with a matching English
sentence, Traditional Chinese translation and accessible image description.

## Assets and cloud data

- Runtime files: `public/images/vocabulary/elementary/*-v1.webp` (1024 × 1024).
- Bundled offline catalog: `src/data/wordIllustrations.json`.
- Original prompts and built-in image_gen provenance: `word-illustrations-generation.json`.
- Supabase project: `jbspxqebcrkilfcddluo`.
- Storage bucket: `word-illustrations`, public reads, WebP only; no public write policy.
- Metadata: `public.word_illustrations`, ordered by `sort_order`, linked to
  `word_bank(word, level)`. Anonymous/authenticated clients have SELECT only.
- Applied schema: `supabase/word_illustrations_schema.sql`.
- Applied content: `supabase/seed_word_illustrations_20260921.sql`.

The 10 public files were downloaded and SHA-256 checked against the local files.
The one-time JWT-protected import function additionally required a random secret,
checked the exact allowlisted filenames and image hashes, and had a 30-minute
expiry. After import it was replaced with an inert HTTP 410 response; the local
secret was removed. It cannot accept further uploads. `uploadWordIllustrations.mjs`
documents the import client, and requires a newly provisioned private session for
any future batch. Never enable anonymous Storage writes for imports.

## Card behavior

Elementary card fronts retain the existing GIF and fallback behavior. Revealed
backs use the illustration catalog only, with no GIF or image-search fallback.
Words outside this first batch continue to show their meaning and example until
an illustration is added. Junior and senior behavior is unchanged.

The back requests cloud metadata; unavailable/empty cloud results retain bundled
content. Broken remote images fall back to their bundled image, then to their
description if both fail. A single scene is centered; multiple scenes are shown
side by side or in a manually controlled scroll-snap carousel in a narrow card.
The layout adapts to the card width, including when the dictionary is open.

## Extend the catalog

Generate each scene independently using the approved style reference, inspect
the full-size result, encode a versioned WebP and add its bilingual metadata to
the local catalog. Upload approved assets to Storage using an authorized admin
session, then upsert catalog rows. Add missing vocabulary to both cloud and local
fallback data. Keep stable sense descriptions, order, versions and prompt history.
Do not label a word as `Supplemental` unless the generic local example override
is appropriate; the internet entry uses `Technology` to preserve its curated text.

Cloud images and metadata are live. The UI source changes need the next normal
website deployment to appear on the production Netlify site.

## Verification (2026-09-21)

- Storage: 10 public WebP downloads matched local SHA-256 hashes; total 1,891,702 bytes.
- Database: 10 records across 7 words; anonymous API reads returned HTTP 200.
  Anonymous INSERT and authenticated UPDATE privileges are absent.
- Front/back integration test verifies GIF preservation on the front, two under
  illustrations after reveal, no GIF on the back, and GIF restoration on flip-back.
- Component tests cover captions, speech, navigation, database outages, late responses,
  image fallback and grade isolation.
- Full suite with two workers: 691/692 passed; one existing pet-game test exceeded
  its five-second timeout. That complete 12-test file plus the final front/back
  test passed separately with a 15-second timeout (13/13).
- Desktop and narrow mobile browser checks: real cloud images loaded, internet's
  three scenes navigated to 3/3, no horizontal page overflow, dictionary usable,
  single apple image centered. Viewport overrides were reset after checking.
- Production build and `git diff --check` passed. Existing unrelated pet edits
  in the workspace were preserved.
