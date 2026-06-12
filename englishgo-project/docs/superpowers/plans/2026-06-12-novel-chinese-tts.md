# Novel Chinese TTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the selected Chinese narration voice with natural-speed playback and a dedicated multilingual model while preserving existing English TTS behavior.

**Architecture:** The browser patch owns playback speed and will force marked Chinese novel speech to `1.0x`. The Netlify function owns synthesis selection and will choose a Chinese-specific model independently from the English/default model. Supabase Storage cache keys already include voice and model, so changed settings create isolated new audio objects.

**Tech Stack:** React/Vite, browser SpeechSynthesis patch, Netlify Functions, ElevenLabs TTS API, Supabase Storage, Vitest.

---

### Task 1: Chinese Playback Speed

**Files:**
- Modify: `public/elevenlabs-tts-patch.js`
- Test: `src/elevenlabs-tts-patch.test.js`

- [ ] **Step 1: Write the failing browser test**

Add a test that stores English speed `0.9`, speaks a marked `zh-TW` utterance, waits for audio creation, and expects:

```js
expect(audio.playbackRate).toBe(1);
```

- [ ] **Step 2: Verify the test fails**

Run:

```powershell
npm test -- --run src/elevenlabs-tts-patch.test.js
```

Expected: the new test fails because the audio currently receives the global `0.9` setting.

- [ ] **Step 3: Implement language-specific playback speed**

In the browser patch, derive playback speed from the utterance language:

```js
audio.playbackRate = isChineseLang(utterance.lang) ? 1 : settings.speed;
```

Also send `speed: 1` for Chinese API requests so diagnostics and request semantics match playback.

- [ ] **Step 4: Verify browser tests pass**

Run:

```powershell
npm test -- --run src/elevenlabs-tts-patch.test.js
```

Expected: all patch tests pass.

### Task 2: Dedicated Chinese Model

**Files:**
- Modify: `netlify/functions/elevenlabs-tts.js`
- Test: `src/elevenlabs-tts-function.test.js`

- [ ] **Step 1: Write the failing function test**

Set:

```js
process.env.ELEVENLABS_MODEL_ID = "eleven_flash_v2_5";
process.env.ELEVENLABS_ZH_MODEL_ID = "eleven_multilingual_v2";
```

Send a Chinese request and assert that the ElevenLabs request body contains:

```js
expect(JSON.parse(init.body).model_id).toBe("eleven_multilingual_v2");
```

Add an English request assertion that still uses `eleven_flash_v2_5`.

- [ ] **Step 2: Verify the function test fails**

Run:

```powershell
npm test -- --run src/elevenlabs-tts-function.test.js
```

Expected: the Chinese assertion fails because both languages currently use `ELEVENLABS_MODEL_ID`.

- [ ] **Step 3: Implement model selection**

Select the model by language:

```js
const modelId = isChineseLang(lang)
  ? getEnv("ELEVENLABS_ZH_MODEL_ID") || "eleven_multilingual_v2"
  : getEnv("ELEVENLABS_MODEL_ID") || DEFAULT_MODEL_ID;
```

- [ ] **Step 4: Verify function tests pass**

Run:

```powershell
npm test -- --run src/elevenlabs-tts-function.test.js
```

Expected: all function tests pass.

### Task 3: Full Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run the focused TTS tests**

```powershell
npm test -- --run src/elevenlabs-tts-patch.test.js src/elevenlabs-tts-function.test.js
```

- [ ] **Step 2: Run the full suite**

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Build production assets**

```powershell
npm run build
git restore -- src/data/recentFeatures.generated.js
git diff --check
```

Expected: build succeeds and diff check is clean.

### Task 4: Production Configuration And Cache Verification

**Files:**
- Netlify environment only.

- [ ] **Step 1: Update Netlify variables**

Set production/all contexts:

```text
ELEVENLABS_ZH_VOICE_ID=r6qgCCGI7RWKXCagm158
ELEVENLABS_ZH_MODEL_ID=eleven_multilingual_v2
```

- [ ] **Step 2: Commit and push implementation**

```powershell
git add public/elevenlabs-tts-patch.js netlify/functions/elevenlabs-tts.js src/elevenlabs-tts-patch.test.js src/elevenlabs-tts-function.test.js
git commit -m "fix: naturalize Chinese novel narration"
git push origin main
```

- [ ] **Step 3: Wait for the production deploy**

Confirm the latest Netlify deploy is ready and corresponds to the pushed commit.

- [ ] **Step 4: Verify cache miss and hit**

Send a unique marked Chinese novel sentence twice. Confirm:

```text
First request: X-TTS-Source: elevenlabs
Second request: X-TTS-Source: supabase-cache
```

Query `storage.objects` and confirm a new object exists under:

```text
r6qgCCGI7RWKXCagm158/
```

- [ ] **Step 5: Verify English remains unchanged**

Send an English request and confirm its configured English voice/model path remains active.
