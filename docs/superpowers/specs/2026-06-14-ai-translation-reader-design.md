# AI Translation Reader Design

## Goal

Add a student-safe translation and narration module to EnglishGo. A user can enter
Traditional Chinese or English, translate in either direction with Gemini, and
listen only after the source and translated text pass content validation.

The selected direction is:

- Add a standalone `AI 翻譯朗讀` module under the `學習` group.
- Detect Chinese-to-English or English-to-Chinese automatically.
- Allow the user to override the direction with a swap control.
- Limit English to 200 words and Chinese to 400 CJK characters.
- Use one structured Gemini request for safety classification and translation.
- Never translate or narrate content classified as unsuitable for students.
- Keep user input and results out of Supabase, localStorage, and other persistence.

## User Experience

### Entry Point

Add a module card to the existing `學習` group:

- Title: `AI 翻譯朗讀`
- Description: `中英互譯、內容檢核與朗讀`
- Tag: `最多 200 words`

The module uses the current grade theme and the shared Gemini API key. If the key
is missing, the page explains that Gemini is required and links to the existing
API Key settings page.

### Translation Workspace

The workspace contains:

- A direction control showing `自動判斷`, `中翻英`, or `英翻中`.
- A swap button that switches the two explicit directions. Using it from
  `自動判斷` selects the opposite of the currently detected direction.
- One multiline source input.
- A live count:
  - Chinese: `0/400 字`
  - English: `0/200 words`
- A primary `AI 翻譯與檢核` action.
- A clear action.
- A result area with source and translation panels.

Desktop presents source and translation side by side. A narrow mobile viewport
uses one column. Text, counters, errors, and actions must wrap without horizontal
overflow or clipped bottom controls.

### Safe Results

After a successful request, show:

- The confirmed source and target languages.
- The original text.
- The translated text.
- A narration button for each text.
- A copy translation action.
- A stop narration action while speech is active.

Editing the source, changing direction, or clearing the form immediately removes
the previous result and stops active narration. This prevents stale text from
being copied or spoken.

### Rejected Results

For unsuitable content, show only:

`內容不適合學生使用，無法翻譯或朗讀。`

Do not show a translation, provider safety details, the rejected text in a result
panel, or narration controls. The source remains in the input so the user can
revise it, but it is never persisted.

## Language And Length Rules

### Language Detection

Automatic detection compares CJK characters with Latin word tokens:

- If the CJK character count is greater than zero and is at least the Latin word
  count, treat the source as Chinese.
- Otherwise, if the Latin word count is greater than zero, treat the source as
  English.
- Empty, numeric-only, punctuation-only, or otherwise indeterminate text is
  rejected before the API request.
- The explicit direction control always overrides automatic detection.

The result returned by Gemini must match the requested or detected direction.
Mismatched language metadata is treated as an invalid AI response.

### Counting

English words are tokens containing at least one Latin letter. They may include
internal digits, apostrophes, or hyphens. Pure numbers do not count as words.
Surrounding punctuation and repeated whitespace do not increase the count.

Chinese length counts CJK Unified Ideographs and compatibility ideographs.
Whitespace and punctuation do not increase the count.

Limits apply to both source and translated text:

- English: at most 200 words.
- Chinese: at most 400 CJK characters.

An over-limit source is rejected before Gemini is called. An over-limit
translation is rejected after response validation and receives no narration
controls.

## Content Safety Policy

The feature is intended for elementary, junior-high, and senior-high students.
It blocks content whose purpose is:

- Sexual or pornographic content.
- Hate, slurs, or dehumanization of protected groups.
- Bullying, targeted harassment, threats, or abusive insults.
- Self-harm encouragement, methods, or graphic descriptions.
- Graphic violence or credible violent threats.
- Drug production, trafficking, or instructions for misuse.
- Instructions that meaningfully facilitate crime or dangerous wrongdoing.
- Profanity or sexualized insults directed at a person.

Benign educational context can pass, including age-appropriate health education,
historical discussion, news reporting, prevention guidance, and non-graphic
fiction. The classifier evaluates context and intent rather than rejecting every
appearance of a sensitive word.

### Layered Validation

1. Local validation rejects empty, indeterminate, over-limit, or clearly
   disallowed text before any API call.
2. Gemini receives an explicit student-safety policy and provider safety settings.
3. Gemini returns a structured safety decision together with a translation only
   when safe.
4. The client validates the schema, language direction, output limits, and a
   second local safety scan of the translated text.
5. Narration controls are created only from a validated safe result.

Local rules provide fast rejection for obvious cases. Gemini remains responsible
for contextual classification. The interface must not claim that automated
moderation is perfect.

## Gemini Contract

Use the existing browser-stored Gemini API key and the same supported model
fallback strategy already used by EnglishGo. Do not add a new server-side key.

The request asks for JSON only:

```json
{
  "sourceLanguage": "zh-TW",
  "targetLanguage": "en-US",
  "safe": true,
  "reason": "",
  "translation": "Translated text"
}
```

Contract rules:

- `sourceLanguage` and `targetLanguage` must be `zh-TW` or `en-US`.
- The two languages must differ and match the requested direction.
- `safe` must be a boolean.
- If `safe` is false, `translation` must be empty.
- If `safe` is true, `translation` must be non-empty and within its language
  limit.
- `reason` is diagnostic data only. It may be mapped to a generic user message
  but is not rendered verbatim.
- Markdown fences, extra prose, missing fields, invalid JSON, or contradictory
  fields cause the request to fail closed.

Configure Gemini harm categories for harassment, hate speech, sexually explicit
content, and dangerous content to block medium-and-higher risk responses. If the
provider blocks the prompt or response, treat it as an unsafe result and do not
offer narration.

## Narration

Narration reuses the application's existing shared speech functions:

- English uses the existing English TTS path and current voice/speed settings.
- Chinese uses `zh-TW` browser Web Speech only.
- Chinese must not call the ElevenLabs/Netlify TTS endpoint.
- Source and translated text are narrated independently.
- Starting one narration stops the other.
- Leaving the module, editing the input, changing direction, clearing, or
  submitting another request stops speech.

Only a validated result object can be passed to a narration handler. Raw input
must never be narrated directly.

## Architecture

### Translation Module

Create an isolated feature component, expected at:

`englishgo-project/src/features/TranslationReader.jsx`

Responsibilities:

- Render the direction, input, count, result, copy, and speech controls.
- Call the translation service with the shared Gemini key.
- Manage loading, rejection, provider error, and safe-result states.
- Clear stale results and speech at the required transitions.
- Link to the existing API Key settings action.

### Validation And Gemini Service

Create a focused module, expected at:

`englishgo-project/src/features/translationService.js`

Responsibilities:

- Detect input language.
- Count English words and Chinese characters.
- Validate source and result limits.
- Perform the local safety scan.
- Build the Gemini prompt and request payload.
- Parse and strictly validate the Gemini JSON response.
- Normalize provider failures into safe UI outcomes.

Pure counting, detection, validation, and response parsing functions must be
exported for direct unit testing. Network calls accept `fetch` and an abort signal
so tests do not depend on the live Gemini service.

### App Integration

Update `englishgo-project/src/App.jsx` only for:

- Importing and routing the new feature component.
- Passing `apiKey`, `onOpenSettings`, `speak`, `speakWebSpeech`, `stopSpeech`,
  theme, and header dependencies.
- Adding the module metadata to the active menu implementation.
- Giving the module a suitable content width.

Do not add translation business logic to `App.jsx`.

## State And Privacy

The feature keeps source text, result text, and safety state in component memory
only.

It does not write this data to:

- Supabase.
- localStorage or sessionStorage.
- URL parameters.
- Application learning history.
- Logs or analytics.

The user's existing Gemini API key storage behavior remains unchanged.

## Error Handling

- Missing API key: show the existing settings action and do not send the text.
- Empty or indeterminate text: show a concise validation message.
- Source over limit: show the exact current and maximum count.
- Local safety rejection: show the generic student-safety message without an API
  call.
- Gemini safety block or `safe: false`: show the same generic message.
- Invalid JSON, schema mismatch, language mismatch, or over-limit output: fail
  closed, retain the input, and show a retryable AI response error.
- Network, quota, permission, or model failure: retain the input, show a concise
  mapped error, and do not display narration controls.
- A second submission aborts the first request.

## Automated Testing

Add unit coverage for:

- English word counting at 199, 200, and 201 words.
- Chinese character counting at 399, 400, and 401 characters.
- Punctuation, whitespace, apostrophes, and hyphenated English words.
- Automatic Chinese and English detection.
- Indeterminate input rejection.
- Explicit direction overriding detection.
- Clear local policy violations rejected without calling `fetch`.
- Educational sensitive context not rejected solely by a keyword.
- Valid Chinese-to-English and English-to-Chinese Gemini responses.
- `safe: false` responses returning no translation.
- Provider safety blocks returning no translation.
- Invalid JSON, missing fields, language mismatch, and contradictory responses.
- Over-limit translated English or Chinese.

Add component or smoke coverage for:

- Opening `AI 翻譯朗讀` from the learning menu.
- Missing-key navigation to settings.
- A safe translation displaying two narration controls.
- An unsafe result displaying no narration controls.
- Editing source text clearing a prior result.
- Direction swap behavior.
- English narration using the English speech path.
- Chinese narration using browser speech without requesting API TTS.
- Desktop result layout and narrow mobile single-column behavior.

Tests must verify the red-green TDD cycle before production implementation.

## Browser QA

Verify at desktop and a narrow mobile viewport:

- The new module is reachable from `學習`.
- Direction, counter, input, and primary action are immediately understandable.
- English and Chinese limits update correctly while typing.
- Safe results render without text overlap or clipped actions.
- Unsafe results expose no copy or narration route.
- Mobile uses one column with no horizontal overflow.
- The last line of Chinese text and bottom actions are not clipped.
- English and Chinese narration buttons invoke their intended speech paths.
- Changing or clearing text stops speech and removes stale results.
- Missing-key and API failure states have a clear recovery action.
- No console errors or failed local assets appear.

## Success Criteria

The feature is complete when:

- Users can translate Traditional Chinese to English and English to Traditional
  Chinese with automatic or explicit direction.
- English input and output are limited to 200 words; Chinese input and output are
  limited to 400 CJK characters.
- Unsafe content cannot produce a translation, copy action, or narration control.
- English uses the existing English TTS path and Chinese remains browser speech
  only.
- No translation text is persisted.
- Unit, smoke, and full test suites pass.
- The production build passes.
- Desktop and mobile browser QA show no clipping, overflow, stale results, or
  console errors.
- The committed change is pushed and the Netlify production deployment is
  verified.

## Out Of Scope

- Translation history, favorites, or database storage.
- Document or file uploads.
- More than one source text per request.
- Languages other than Traditional Chinese and English.
- Grammar correction, rewriting styles, or vocabulary extraction.
- Raw provider moderation details shown to users.
- A new server-side Gemini key or a new authentication system.
- Narrating rejected, unvalidated, or over-limit text.
