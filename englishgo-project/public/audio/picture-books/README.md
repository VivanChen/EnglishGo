# Prerecorded storybook audio

All five books ship complete MP3 packs: 40 page narrations and 543 unique clickable English words (including vocabulary cards and scene labels). Shared words reuse one file. Total audio size is about 17 MiB.

Run `node scripts/prepareStorybookAudio.mjs` when story text or words change, then `npm run build`. Generation uses the existing ElevenLabs endpoint, English voice `21m00Tcm4TlvDq8ikWAM`, speed 0.9. Existing valid files are skipped. The build rejects missing MP3 assets. Commit generated audio and manifests with content changes.

Since 2026-11-18 these files are the fallback, not the main voice. Pages and words are read with the learner's own speech settings (service, voice and speed): cloud voices go through the shared speech endpoint and its server cache, and "device" uses the device voice. If a cloud request fails or times out, the book plays the matching file here instead of switching to a system voice. "下載離線備用朗讀" stores this pack in Cache Storage (`storybook-audio-v1`) for offline reading.

The recordings were made in batches with different models (multilingual v2 in September, v4 in November), so their pace and tone are not uniform; they are kept only as a dependable backup.

Files use content-derived IDs and immutable cache headers. `generation-report.json` records the latest generation run.
