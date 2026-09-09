# Prerecorded storybook audio

All three books ship complete MP3 packs: 24 page narrations and 348 unique clickable English words (including vocabulary cards and scene labels). Shared words reuse one file. Total audio size is about 9.74 MiB.

Run `node scripts/prepareStorybookAudio.mjs` when story text or words change, then `npm run build`. Generation uses the existing ElevenLabs endpoint, English voice `21m00Tcm4TlvDq8ikWAM`, speed 0.9. Existing valid files are skipped. The build rejects missing MP3 assets. Commit generated audio and manifests with content changes.

The reader downloads the selected book's pages and words directly from static files, caches them in memory and Cache Storage (`storybook-audio-v1`), and reports download progress. Playback does not call the synthesis endpoint. Initial downloads still require a connection; retained audio can be reused across visits, subject to browser storage availability. Slow reading adjusts playback rate without generating new audio.

Files use content-derived IDs and immutable cache headers. `generation-report.json` records the latest generation run.
