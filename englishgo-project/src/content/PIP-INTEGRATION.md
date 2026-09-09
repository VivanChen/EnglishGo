# Pip and the Lost Star integration

The source of truth is `src/content/pip-and-the-lost-star.html`, copied verbatim from the user's HTML. Its eight story pages, Traditional Chinese translations and 37 vocabulary entries are mirrored in `src/data/pipBook.js` and checked against the source in tests.

`node scripts/buildPipBook.mjs` produces `public/picture-books/pip-and-the-lost-star.html` and the content-addressed audio manifest. The normal production build runs this command. Edit the source or enhancement layer rather than hand-editing the generated HTML.

The original cover, ending, scene composition, labels, stars, word cards, self-reading mode, keyboard navigation and cursor sparkles are retained. The enhancement layer replaces fox/tree/basket artwork, fixes 3D preservation, adds repeatable object motion, readable mobile flow, API narration, pause/resume, slow playback and eight-page preloading. Narration failures are reported instead of silently falling back to a system voice. Word highlighting is approximate for cloud audio; native boundaries remain supported by the original UI.

The React host embeds the actual HTML and exposes all 37 original vocabulary cards. Same-origin framing is allowed in both Netlify configurations; other origins remain blocked. Messages validate both source window and origin.

New Pip audio identifiers are included in the shared novel-audio catalog. Live fixed audio requires deploying that catalog along with the frontend. Browser QA uses controlled WAV responses to validate playback/highlighting and controlled failures to check recovery; it does not certify new production narration has already been generated.
