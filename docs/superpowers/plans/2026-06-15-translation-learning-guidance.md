# AI Translation Learning Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add concise translation explanations, English stress/chunk guidance, 20-unit input limits, and a persistent one-request-per-minute browser cooldown to the existing safe translation reader.

**Architecture:** Extend the existing translation service so one Gemini request returns translation and strictly validated teaching data. Keep cooldown persistence and countdown rendering in `TranslationReader`, with the service notifying the component immediately before the first network request so locally rejected input does not consume cooldown.

**Tech Stack:** React 18, Gemini `generateContent` REST API, Web Speech/existing English TTS, localStorage, Vitest, Testing Library, Vite, Netlify.

---

## File Structure

- Modify `englishgo-project/src/features/translationService.js`
  - Own 20-unit limits, one-call teaching response schema, prompts, and strict response validation.
- Modify `englishgo-project/src/features/translationService.test.js`
  - Cover boundaries, request payload, teaching response validation, safety, and request-start callback timing.
- Modify `englishgo-project/src/features/TranslationReader.jsx`
  - Own cooldown persistence/countdown, direct teaching display, stress markup, and existing full-sentence narration.
- Modify `englishgo-project/src/features/TranslationReader.test.jsx`
  - Cover cooldown behavior, persistence privacy, teaching UI, normal-speed English narration, and responsive CSS.
- Modify `englishgo-project/src/App.jsx`
  - Update menu copy from the old 200-word limit to the new concise-translation limit.
- Modify `englishgo-project/src/App.smoke.test.jsx`
  - Verify the real module exposes the 20-word/20-character limit.
- Update `docs/superpowers/plans/2026-06-15-translation-learning-guidance.md`
  - Mark implementation and verification steps complete.

No database, Supabase, Netlify Function, ElevenLabs function, or environment-variable changes are required.

### Task 1: Extend The Translation Service Contract

**Files:**
- Modify: `englishgo-project/src/features/translationService.test.js`
- Modify: `englishgo-project/src/features/translationService.js`

- [ ] **Step 1: Write failing 20-unit boundary tests**

Change the existing limit expectations and table rows:

```js
expect(MAX_ENGLISH_WORDS).toBe(20);
expect(MAX_CHINESE_CHARACTERS).toBe(20);

it.each([
  [19, true],
  [20, true],
  [21, false],
])("validates an English source containing %i words", (count, isValid) => {
  const text = Array.from({ length: count }, () => "word").join(" ");
  if (isValid) {
    expect(validateTranslationInput(text, "en-zh")).toMatchObject({
      sourceLanguage: "en-US",
      targetLanguage: "zh-TW",
    });
    return;
  }
  expect(() => validateTranslationInput(text, "en-zh")).toThrow(
    expect.objectContaining({ code: "source_too_long" }),
  );
});
```

Add the equivalent `19`, `20`, and `21` CJK-character test and update overlong translated-output tests to use `21`.

- [ ] **Step 2: Run the limit tests and verify RED**

Run:

```powershell
npx vitest run src/features/translationService.test.js --maxWorkers=1
```

Expected: FAIL because the exported limits remain `200` and `400`.

- [ ] **Step 3: Implement the 20-unit limits**

Change:

```js
export const MAX_ENGLISH_WORDS = 20;
export const MAX_CHINESE_CHARACTERS = 20;
```

Keep the existing behavior that checks both English and Chinese counts in mixed input.

- [ ] **Step 4: Add failing teaching-contract tests**

Update the safe response helper to return:

```js
{
  sourceLanguage,
  targetLanguage,
  safe,
  reason,
  translation,
  explanation: "這句用 want to 表達想做某事，後半句用 but 連接相反想法。",
  keyPhrases: [
    { english: "want to", meaning: "想要做某事" },
  ],
  pronunciationSegments: [
    { text: "I want to eat hot pot", stressedWords: ["want", "hot", "pot"] },
    { text: "but I don't want to smell like it", stressedWords: ["don't", "smell"] },
  ],
}
```

Assert a safe service result contains all three teaching fields, the request schema requires them, `maxOutputTokens` is `700`, and the schema still omits `additionalProperties`.

Add rejection tests for:

```js
[
  ["blank explanation", { explanation: " " }],
  ["four key phrases", { keyPhrases: Array(4).fill({ english: "a", meaning: "一個" }) }],
  ["unknown response key", { extra: "not allowed" }],
  ["segment not in English sentence", {
    pronunciationSegments: [{ text: "Unrelated sentence", stressedWords: ["Unrelated"] }],
  }],
  ["stress word absent from segment", {
    pronunciationSegments: [{ text: "I walk to school", stressedWords: ["quickly"] }],
  }],
]
```

Also test `explanation` over 240 characters, phrase values over 80 characters, more than six pronunciation segments, and unsafe teaching text.

- [ ] **Step 5: Run the teaching tests and verify RED**

Run:

```powershell
npx vitest run src/features/translationService.test.js --maxWorkers=1
```

Expected: FAIL because the service response schema and parser do not contain the new teaching fields.

- [ ] **Step 6: Implement the teaching request and strict parser**

Extend `buildTranslationResponseSchema()` with:

```js
explanation: { type: "STRING" },
keyPhrases: {
  type: "ARRAY",
  maxItems: 3,
  items: {
    type: "OBJECT",
    properties: {
      english: { type: "STRING" },
      meaning: { type: "STRING" },
    },
    required: ["english", "meaning"],
  },
},
pronunciationSegments: {
  type: "ARRAY",
  maxItems: 6,
  items: {
    type: "OBJECT",
    properties: {
      text: { type: "STRING" },
      stressedWords: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
    },
    required: ["text", "stressedWords"],
  },
},
```

Add all three fields to `required`, set `maxOutputTokens: 700`, and update the system instruction to require concise Traditional Chinese explanation, at most three key phrases, and English semantic chunks without IPA or Chinese homophones.

Add focused helpers:

```js
function normalizeEnglishForMatch(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Script=Latin}0-9'\u2019]+/gu, " ")
    .trim();
}

function validateTeachingGuidance(parsed, englishText) {
  const explanation = parsed.explanation.trim();
  if (!explanation || explanation.length > 240) {
    throw createInvalidResponseError();
  }

  if (!Array.isArray(parsed.keyPhrases) || parsed.keyPhrases.length > 3) {
    throw createInvalidResponseError();
  }
  const keyPhrases = parsed.keyPhrases.map(phrase => {
    if (
      !isPlainObject(phrase) ||
      Object.keys(phrase).length !== 2 ||
      !Object.hasOwn(phrase, "english") ||
      !Object.hasOwn(phrase, "meaning") ||
      typeof phrase.english !== "string" ||
      typeof phrase.meaning !== "string"
    ) {
      throw createInvalidResponseError();
    }
    const english = phrase.english.trim();
    const meaning = phrase.meaning.trim();
    if (
      !english ||
      !meaning ||
      english.length > 80 ||
      meaning.length > 80 ||
      countEnglishWords(english) === 0
    ) {
      throw createInvalidResponseError();
    }
    return { english, meaning };
  });

  if (
    !Array.isArray(parsed.pronunciationSegments) ||
    parsed.pronunciationSegments.length === 0 ||
    parsed.pronunciationSegments.length > 6
  ) {
    throw createInvalidResponseError();
  }

  const normalizedEnglish = normalizeEnglishForMatch(englishText);
  let searchFrom = 0;
  const pronunciationSegments = parsed.pronunciationSegments.map(segment => {
    if (
      !isPlainObject(segment) ||
      Object.keys(segment).length !== 2 ||
      !Object.hasOwn(segment, "text") ||
      !Object.hasOwn(segment, "stressedWords") ||
      typeof segment.text !== "string" ||
      !Array.isArray(segment.stressedWords)
    ) {
      throw createInvalidResponseError();
    }

    const text = segment.text.trim();
    const normalizedSegment = normalizeEnglishForMatch(text);
    const segmentPosition = normalizedEnglish.indexOf(
      normalizedSegment,
      searchFrom,
    );
    if (!normalizedSegment || segmentPosition < 0) {
      throw createInvalidResponseError();
    }
    searchFrom = segmentPosition + normalizedSegment.length;

    const segmentWords = new Set(normalizedSegment.split(" "));
    const stressedWords = segment.stressedWords.map(word => {
      if (typeof word !== "string") throw createInvalidResponseError();
      const stressedWord = word.trim();
      const normalizedWord = normalizeEnglishForMatch(stressedWord);
      if (
        !normalizedWord ||
        countEnglishWords(stressedWord) !== 1 ||
        !segmentWords.has(normalizedWord)
      ) {
        throw createInvalidResponseError();
      }
      return stressedWord;
    });

    return { text, stressedWords };
  });

  const guidanceText = [
    explanation,
    ...keyPhrases.flatMap(phrase => [phrase.english, phrase.meaning]),
    ...pronunciationSegments.flatMap(segment => [
      segment.text,
      ...segment.stressedWords,
    ]),
  ].join("\n");
  if (hasClearlyUnsafeContent(guidanceText)) {
    return { status: "unsafe" };
  }

  return {
    explanation,
    keyPhrases,
    pronunciationSegments,
  };
}
```

Return:

```js
{
  status: "safe",
  sourceText: expected.sourceText,
  sourceLanguage: safeResponse.sourceLanguage,
  targetLanguage: safeResponse.targetLanguage,
  translation,
  explanation,
  keyPhrases,
  pronunciationSegments,
}
```

For `safe: false`, require empty translation, empty explanation, and empty teaching arrays before returning `{ status: "unsafe" }`.

- [ ] **Step 7: Add a failing request-start callback test**

Assert:

```js
const onRequestStart = vi.fn();
const fetchImpl = vi.fn(async () => successfulResponse);

await translateStudentText({
  text: "Hello students.",
  direction: "en-zh",
  apiKey: "key",
  fetchImpl,
  onRequestStart,
});

expect(onRequestStart).toHaveBeenCalledTimes(1);
expect(onRequestStart.mock.invocationCallOrder[0])
  .toBeLessThan(fetchImpl.mock.invocationCallOrder[0]);
```

Also assert `onRequestStart` is not called for missing keys, overlong input, or locally unsafe input, and is called only once when model fallback sends a second fetch.

- [ ] **Step 8: Implement request-start notification**

Extend the service signature:

```js
export async function translateStudentText({
  text,
  direction = "auto",
  apiKey,
  signal,
  fetchImpl = fetch,
  onRequestStart,
}) {
```

After local validation and before entering the model loop:

```js
onRequestStart?.();
```

- [ ] **Step 9: Run all service tests and commit**

Run:

```powershell
npx vitest run src/features/translationService.test.js --maxWorkers=1
```

Expected: all service tests pass.

Commit:

```powershell
git add -- englishgo-project/src/features/translationService.js englishgo-project/src/features/translationService.test.js
git commit -m "feat: add concise translation learning guidance"
```

### Task 2: Add Cooldown And Learning Guidance UI

**Files:**
- Modify: `englishgo-project/src/features/TranslationReader.test.jsx`
- Modify: `englishgo-project/src/features/TranslationReader.jsx`

- [ ] **Step 1: Update the component fixture and add failing guidance UI tests**

Extend the mock safe result with:

```js
explanation: "這句使用 every day 表達每天固定發生的事情。",
keyPhrases: [
  { english: "walk to school", meaning: "走路去學校" },
  { english: "every day", meaning: "每天" },
],
pronunciationSegments: [
  { text: "I walk to school", stressedWords: ["walk", "school"] },
  { text: "every day", stressedWords: ["every", "day"] },
],
```

After translation, assert:

```js
expect(screen.getByRole("heading", { name: "為什麼這樣翻" })).toBeInTheDocument();
expect(screen.getByText("這句使用 every day 表達每天固定發生的事情。")).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "重要片語" })).toBeInTheDocument();
expect(screen.getByText("walk to school")).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "英文怎麼念" })).toBeInTheDocument();
expect(screen.getByTestId("pronunciation-guide")).toHaveTextContent(
  "I walk to school / every day",
);
```

Assert `walk`, `school`, `every`, and `day` render inside `<strong>` elements.

- [ ] **Step 2: Run the guidance component test and verify RED**

Run:

```powershell
npx vitest run src/features/TranslationReader.test.jsx --maxWorkers=1
```

Expected: FAIL because the learning guidance is not rendered.

- [ ] **Step 3: Implement the direct-expanded learning section**

Add CSS for an un-nested full-width learning area:

```css
.translation-reader-learning{grid-column:1/-1;display:grid;gap:16px;padding:16px 0;border-top:1px solid var(--tr-border)}
.translation-reader-learning h2{margin:0 0 6px;font-size:16px}
.translation-reader-learning p{margin:0;line-height:1.75}
.translation-reader-phrases{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.translation-reader-phrase{padding:10px 12px;border-left:3px solid var(--tr-accent);background:var(--tr-surface-alt)}
.translation-reader-pronunciation{font-size:18px;line-height:1.9;overflow-wrap:anywhere}
.translation-reader-pronunciation strong{color:var(--tr-accent)}
@media (max-width:680px){
  .translation-reader-phrases{grid-template-columns:1fr}
}
```

Render `explanation`, `keyPhrases`, and `pronunciationSegments` after the two result panels. Build stress markup by tokenizing each validated segment and wrapping tokens whose normalized form appears in `stressedWords`. Insert an accessible `/` separator between segments.

Add:

```jsx
function normalizeStressToken(token) {
  return token
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Script=Latin}0-9']/gu, "");
}

function PronunciationGuide({ segments }) {
  return (
    <p
      className="translation-reader-pronunciation"
      data-testid="pronunciation-guide"
    >
      {segments.map((segment, segmentIndex) => {
        const stressed = new Set(
          segment.stressedWords.map(normalizeStressToken),
        );
        return (
          <Fragment key={`${segment.text}-${segmentIndex}`}>
            {segment.text.split(/(\s+)/).map((token, tokenIndex) => {
              const content = stressed.has(normalizeStressToken(token))
                ? <strong>{token}</strong>
                : token;
              return (
                <Fragment key={`${segmentIndex}-${tokenIndex}`}>
                  {content}
                </Fragment>
              );
            })}
            {segmentIndex < segments.length - 1 ? (
              <span aria-label="短暫停頓"> / </span>
            ) : null}
          </Fragment>
        );
      })}
    </p>
  );
}
```

Import `Fragment` from React. The speech button continues to call `narrate` with the original full English string from `result.sourceText` or `result.translation`.

- [ ] **Step 4: Add failing cooldown tests**

Use fake timers and a fixed system time. Assert:

1. The first valid submit passes `onRequestStart`.
2. Invoking it stores `eg_translation_last_request_at`.
3. The button becomes disabled and displays `請等待 60 秒`.
4. At 30 seconds it displays `請等待 30 秒`.
5. At 60 seconds the button returns to `AI 翻譯與檢核`.
6. A remounted component reads the timestamp and keeps the cooldown.
7. An API rejection still keeps cooldown.
8. Missing key and local validation errors do not create the timestamp.
9. Clear, direction change, and back do not clear cooldown.

Use:

```js
vi.useFakeTimers();
vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
```

Restore real timers after each test.

- [ ] **Step 5: Run cooldown tests and verify RED**

Run:

```powershell
npx vitest run src/features/TranslationReader.test.jsx --maxWorkers=1
```

Expected: FAIL because cooldown state and persistence do not exist.

- [ ] **Step 6: Implement cooldown persistence and countdown**

Add:

```js
const TRANSLATION_COOLDOWN_MS = 60_000;
const TRANSLATION_LAST_REQUEST_KEY = "eg_translation_last_request_at";
```

Read and validate the stored timestamp on mount. Keep `cooldownUntil` in state and update a `now` state at most once per second while cooldown is active. Ignore invalid, future-distant, or expired stored values.

Pass:

```js
onRequestStart: () => {
  const startedAt = Date.now();
  localStorage.setItem(TRANSLATION_LAST_REQUEST_KEY, String(startedAt));
  setCooldownUntil(startedAt + TRANSLATION_COOLDOWN_MS);
  setNow(startedAt);
},
```

Before submitting, reject when `cooldownUntil > Date.now()` without calling `translateText`. Disable the primary button during cooldown and render:

```js
const cooldownSeconds = Math.max(
  0,
  Math.ceil((cooldownUntil - now) / 1000),
);
```

Button label:

```jsx
{cooldownSeconds > 0
  ? `請等待 ${cooldownSeconds} 秒`
  : "AI 翻譯與檢核"}
```

- [ ] **Step 7: Update limit copy and narration assertions**

Change visible copy and counts to `20 English words / 20 中文字`, `/20 words`, and `/20 字`.

Keep English narration unchanged:

```js
expect(props.speak).toHaveBeenCalledWith(
  "I walk to school every day.",
  "en-US",
  0.9,
  expect.any(Object),
);
```

Do not narrate the slash-separated display string.

- [ ] **Step 8: Run all component tests and commit**

Run:

```powershell
npx vitest run src/features/TranslationReader.test.jsx --maxWorkers=1
```

Expected: all component tests pass.

Commit:

```powershell
git add -- englishgo-project/src/features/TranslationReader.jsx englishgo-project/src/features/TranslationReader.test.jsx
git commit -m "feat: add translation cooldown and learning UI"
```

### Task 3: Update App Integration Copy

**Files:**
- Modify: `englishgo-project/src/App.smoke.test.jsx`
- Modify: `englishgo-project/src/App.jsx`

- [ ] **Step 1: Write failing App copy tests**

Update the translation-reader smoke test to assert:

```js
expect(screen.getByText("上限 20 English words / 20 中文字")).toBeInTheDocument();
```

Assert the learning-menu translation card no longer advertises `最多 200 words` and instead shows `每分鐘 1 次`.

- [ ] **Step 2: Run focused smoke tests and verify RED**

Run:

```powershell
npx vitest run src/App.smoke.test.jsx -t "translation reader" --maxWorkers=1
```

Expected: FAIL because App metadata and component copy still use the old limits.

- [ ] **Step 3: Update translation module metadata**

In both current and legacy menu definitions use:

```js
{
  id: "translate",
  group: "learn",
  icon: "⇄",
  t: "AI 翻譯朗讀",
  d: "短句互譯、翻譯解析與英文發音",
  tag: "每分鐘 1 次",
}
```

- [ ] **Step 4: Run focused smoke tests and commit**

Run:

```powershell
npx vitest run src/App.smoke.test.jsx -t "translation reader" --maxWorkers=1
```

Expected: focused App tests pass.

Commit:

```powershell
git add -- englishgo-project/src/App.jsx englishgo-project/src/App.smoke.test.jsx
git commit -m "feat: describe guided short translations"
```

### Task 4: Full Verification, Browser QA, Push, And Deploy

**Files:**
- Verify all modified source and test files.
- Update: `docs/superpowers/plans/2026-06-15-translation-learning-guidance.md`

- [ ] **Step 1: Run feature-focused tests**

Run:

```powershell
npx vitest run src/features/translationService.test.js src/features/TranslationReader.test.jsx src/App.smoke.test.jsx --maxWorkers=1
```

Expected: all focused tests pass.

- [ ] **Step 2: Run the complete test suite**

Run:

```powershell
npx vitest run --maxWorkers=1
```

Expected: all test files pass with zero failures.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: Vite exits `0`. If prebuild changes only the generated recent-feature file, restore it:

```powershell
git restore -- src/data/recentFeatures.generated.js
```

- [ ] **Step 4: Run desktop browser QA**

At a desktop viewport verify:

- 20-word and 20-character counters and rejection messages.
- Successful translation directly shows explanation, phrases, and stress/chunk guidance.
- English narration sends the complete unmarked English sentence at rate `0.9`.
- A second submit is unavailable for 60 seconds and the countdown updates.
- Refreshing retains only cooldown, not source or result.
- No console errors or horizontal overflow.

- [ ] **Step 5: Run mobile browser QA**

At `390 x 844` verify:

- Results and learning content use one column.
- Phrase items and long English chunks wrap without overflow.
- Countdown button, final guidance line, and footer are not clipped.
- All controls remain tappable.

- [ ] **Step 6: Verify privacy and request count**

Inspect localStorage and network behavior:

- Only `eg_translation_last_request_at` is added by this feature.
- No source, translation, explanation, phrases, pronunciation guidance, or history is persisted.
- One successful action makes one Gemini request unless the existing model fallback is triggered.
- A cooldown click makes zero Gemini requests.

- [ ] **Step 7: Check diff and mark plan complete**

Run:

```powershell
git diff --check
git status --short
```

Keep existing untracked `vite-*.log` files untouched. Mark completed plan checkboxes `[x]`.

- [ ] **Step 8: Commit verification records**

```powershell
git add -- docs/superpowers/plans/2026-06-15-translation-learning-guidance.md
git commit -m "docs: complete translation learning guidance plan"
```

- [ ] **Step 9: Push and verify production**

```powershell
git push origin main
```

Verify Netlify production at `https://englishgo-vevan.netlify.app` serves the new UI and the browser console has no errors.
