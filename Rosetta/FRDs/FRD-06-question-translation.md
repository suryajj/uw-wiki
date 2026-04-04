# FRD-06: Question Translation Assistant

## Overview

The Question Translation Assistant enables students to type questions in their native language and receive grammatically correct English translations they can ask the professor. This feature removes the language barrier from classroom participation, allowing students to formulate thoughts in their strongest language while still engaging with English-speaking instructors.

**Key Design Decisions:**

1. **Text-Based Input** — Questions are typed, not spoken. This provides better accuracy and allows students to review before submitting.

2. **Language Auto-Detection** — The system automatically detects the input language, removing friction from the translation process.

3. **Context-Aware Translation** — The LLM is instructed to produce natural, classroom-appropriate English suitable for asking a professor.

4. **Session History** — Translation history persists within the session for easy reference and re-use.

5. **Speak-Out-Loud UX** — The primary action is **speaking the translation aloud** via text-to-speech (TTS). The system speaks the English translation so the student does not have to read it themselves — they can play it when called upon, or use it to practice. Copy-to-clipboard remains available for pasting into chat.

---

## User Stories

### Translating a Question

A Chinese-speaking student has a question about the lecture topic but isn't confident expressing it in English. They open the Question Assistant panel (accessible via a floating button or keyboard shortcut).

In the input field, they type their question in Chinese: "这个算法的时间复杂度是多少？" The system automatically detects the language as Chinese and displays "Chinese detected" below the input.

They click "Translate" (or press Enter). After a brief loading indicator, the English translation appears: "What is the time complexity of this algorithm?"

The translation is well-formed, grammatically correct, and appropriate for asking a professor. A **"Speak"** button (and optionally "Copy") appears next to the translation. The student clicks **"Speak"**, and the system **reads the English translation aloud** via text-to-speech — the student does not have to say it themselves. They can play it when called upon in class, or use it to practice. Copy remains available for pasting into the class chat.

### Reviewing Translation History

During the lecture, the student translates three different questions. They want to go back to the first question they translated. The Question Assistant panel shows a history section below the input area.

Each history item shows:

- The original text (in the source language)
- The translated English text
- A timestamp
- A **Speak** button (plays TTS)
- A **Copy** button

The student clicks the **Speak** button on the first translation to have the system read it aloud again, or Copy to reuse it in chat.

### Clearing History

After the lecture, the student wants to clear their translation history. They click the "Clear History" button at the bottom of the history section. A confirmation appears, and after confirming, all history items are removed.

### Using Keyboard Shortcuts

An experienced user wants to translate quickly without using the mouse. They press `Ctrl+Shift+Q` (or `Cmd+Shift+Q` on Mac) to open the Question Assistant panel. They type their question and press Enter to translate. They press the **Speak** shortcut (e.g. `Ctrl+Shift+S`) to have the system read the translation aloud, or `Ctrl+C` while focused on the result to copy it. They press Escape to close the panel.

### Handling Translation Errors

The student types a question, but the translation fails due to a network error. The panel shows an error message: "Translation failed. Please try again." A "Retry" button appears. The original text is preserved in the input field so they don't have to retype.

---

## System Behavior

### Translation Flow

```
┌─────────────────────┐
│   User types text   │
│   in native lang    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Detect language    │
│  (optional hint)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Send to OpenRouter │
│  with translation   │
│  prompt             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  LLM translates to  │
│  natural English    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Return translation │
│  and detected lang  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Add to session     │
│  history            │
└─────────────────────┘
```

### Language Detection

The system uses the LLM to detect the input language as part of the translation request. This is more reliable than client-side detection libraries and handles mixed-language input gracefully.

**Supported Languages:**

- Chinese (Mandarin) - zh
- Hindi - hi
- Spanish - es
- French - fr
- Bengali - bn
- English - en (returns as-is with grammar check)

### Translation Prompt Design

The LLM is instructed to:

1. Detect the source language
2. Translate to natural, conversational English
3. Preserve the question's intent and specificity
4. Use academic/classroom-appropriate language
5. Return a grammatically correct, complete question

If the input is already in English, the LLM performs a grammar check and returns a polished version.

### Response Time Target

Translation should complete in under 2 seconds for typical question lengths (under 200 characters). The UI shows a loading indicator during translation.

---

## API Endpoints

### Translate Question

```
POST /api/v1/translate/question
```

Request Schema:

```
{
  text: string (required, max 1000 chars),
  source_language: string | null (optional hint),
  session_id: UUID | null (optional, for context)
}
```

Response Schema:

```
{
  original_text: string,
  translated_text: string,
  detected_language: string,
  detected_language_name: string,
  confidence: number (0-1)
}
```

### Speak (Text-to-Speech) — ElevenLabs

```
POST /api/v1/translate/tts/speak
```

Request Schema:

```
{
  text: string (required, max 1000 chars — the English translation to speak)
}
```

Response:

- **Success (200):** `Content-Type: audio/mpeg`, body = raw audio bytes (MP3). Frontend streams and plays via `<audio>` or `fetch` + `AudioContext` / `HTMLAudioElement`.
- **Alternative:** Return a short-lived signed URL to an audio blob if streaming raw bytes is not preferred.

**Error Responses:**

| Status | Code            | Description                           |
| ------ | --------------- | ------------------------------------- |
| 400    | TEXT_EMPTY      | Input text is empty                   |
| 400    | TEXT_TOO_LONG   | Input exceeds 1000 characters         |
| 429    | TTS_RATE_LIMIT  | ElevenLabs or app rate limit exceeded |
| 500    | TTS_ERROR       | ElevenLabs request failed             |
| 503    | TTS_UNAVAILABLE | ElevenLabs service unavailable        |

**Configuration:** `ELEVENLABS_API_KEY` is required. `ELEVENLABS_VOICE_ID` is optional; if unset, use a default English voice supported by ElevenLabs.

### Error Responses (Translate)

| Status | Code                 | Description                             |
| ------ | -------------------- | --------------------------------------- |
| 400    | TEXT_EMPTY           | Input text is empty                     |
| 400    | TEXT_TOO_LONG        | Input exceeds 1000 characters           |
| 400    | UNSUPPORTED_LANGUAGE | Detected language not in supported list |
| 500    | TRANSLATION_ERROR    | LLM translation failed                  |
| 503    | SERVICE_UNAVAILABLE  | OpenRouter unavailable                  |

---

## System State

### Client-Side State Only

Translation history is stored in client-side state (Zustand) and persists only for the browser session. This is a deliberate privacy decision — question translations are ephemeral and not stored on the server.

**Translation History Item:**

```typescript
interface TranslationHistoryItem {
  id: string;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  timestamp: Date;
}
```

**Store State:**

```typescript
interface QuestionTranslationState {
  history: TranslationHistoryItem[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  addTranslation: (item: TranslationHistoryItem) => void;
  clearHistory: () => void;
  setOpen: (open: boolean) => void;
}
```

---

## Frontend Behavior

### Panel Design

The Question Assistant appears as a slide-out panel from the right side of the screen, similar to a chat interface.

**Panel Layout:**

```
┌────────────────────────────────┐
│  Question Translation    [X]  │
├────────────────────────────────┤
│                                │
│  ┌──────────────────────────┐  │
│  │ Type your question...   │  │
│  │                          │  │
│  └──────────────────────────┘  │
│  Chinese detected    [Translate]│
│                                │
├────────────────────────────────┤
│  Translation:                  │
│  ┌──────────────────────────┐  │
│  │ What is the time         │  │
│  │ complexity of this       │  │
│  │ algorithm?     [🔊][📋]  │  │
│  └──────────────────────────┘  │
│                                │
├────────────────────────────────┤
│  History                       │
│  ┌──────────────────────────┐  │
│  │ 这个算法...              │  │
│  │ What is the time... [🔊][📋]│  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ Previous question...     │  │
│  └──────────────────────────┘  │
│                                │
│  [Clear History]               │
└────────────────────────────────┘
```

### Trigger Button

A floating action button appears in the bottom-right corner of the session view:

- Icon: Speech bubble with translation symbol
- Tooltip: "Translate Question (Ctrl+Shift+Q)"
- Badge: Number of translations in history (if > 0)

### Input Area

**Text Input:**

- Multi-line textarea
- Placeholder: "Type your question in your language..."
- Character counter showing current/max (e.g., "45/1000")
- Auto-grows up to 4 lines

**Language Indicator:**

- Appears below input after typing starts
- Shows detected language with confidence
- Updates as user types (debounced)

**Translate Button:**

- Primary action button
- Disabled when input is empty
- Shows loading spinner during translation
- Keyboard shortcut: Enter (when input focused)

### Translation Result

**Result Display:**

- Appears after successful translation
- Shows English translation in a distinct card
- **Speak button** (primary): Tooltip "Speak aloud" — calls `POST /api/v1/translate/tts/speak` with the translation, receives MP3, and plays it in-browser so the **system** reads the translation (ElevenLabs). The student does not have to speak it themselves. Icon indicates playing state when TTS is active; supports stop.
- **Copy button**: Tooltip "Copy to clipboard" — copies translation for pasting into chat
- Optional: **Auto-speak** — after translation, TTS can optionally play automatically (user preference, off by default)
- Visual feedback on successful copy (icon changes to checkmark)

**Error Display:**

- Red-bordered card for errors
- Error message with retry button
- Input preserved for retry

### Text-to-Speech (TTS) — ElevenLabs

The system **speaks the English translation aloud** so the student does not have to read or pronounce it themselves. This supports students who are shy, unsure of pronunciation, or prefer to have the question played when called upon.

**Provider: ElevenLabs.** TTS is powered by **ElevenLabs** for high-quality, natural-sounding English speech. The backend proxies requests to the ElevenLabs API (API key kept server-side only).

**Implementation:**

- **Flow**: Frontend calls `POST /api/v1/translate/tts/speak` with the translation text → backend calls ElevenLabs Text-to-Speech API → returns audio (e.g. `mp3`) → frontend plays via `<audio>` or `Audio` API.
- **Voice**: Use a configurable ElevenLabs `voice_id` (e.g. default English voice). Stored in backend config; optionally allow voice selection in settings later.
- **Model**: Use **Eleven Turbo v2.5** or **Flash v2.5** for low latency; suitable for short question-length utterances.
- **Output format**: `mp3_44100_128` (or equivalent) for broad browser support.
- **Playback controls**: Speak plays from start; clicking again stops. When TTS is playing, icon switches to "stop" state.
- **Only one at a time**: Starting TTS for another translation (or history item) stops any currently playing audio.
- **Loading state**: While fetching from `/api/v1/translate/tts/speak`, show a loading indicator on the Speak button (e.g. spinner). Disable duplicate requests for the same text until the first completes or fails.
- **Fallback**: If TTS fails (e.g. ElevenLabs unavailable, rate limit), show error tooltip/toast and keep Speak button retryable.

**User preference (optional):**

- **Auto-speak after translate**: When enabled, the translation is spoken automatically as soon as it appears. Default: off.

### History Section

**History List:**

- Scrollable list of past translations
- Most recent at top
- Each item shows:
  - Original text (truncated with "..." if long)
  - Translated text
  - Relative timestamp ("2 min ago")
  - **Speak button** (play TTS for that translation)
  - **Copy button**
- Maximum 20 items stored

**Clear History:**

- Text button at bottom of history
- Confirmation dialog before clearing

### Keyboard Navigation

| Shortcut               | Action                                        |
| ---------------------- | --------------------------------------------- |
| `Ctrl/Cmd + Shift + Q` | Open/close panel                              |
| `Enter`                | Translate (when input focused)                |
| `Ctrl/Cmd + Shift + S` | Speak translation aloud (when result focused) |
| `Escape`               | Close panel / stop TTS                        |
| `Tab`                  | Navigate between elements                     |

### Responsive Behavior

**Desktop:**

- Panel slides in from right
- Width: 400px
- Overlays main content

**Tablet:**

- Full-width modal
- Slides up from bottom

**Mobile:**

- Full-screen modal
- Slides up from bottom

---

## Backend Implementation

### Service Layer

**QuestionTranslationService:**

```python
class QuestionTranslationService:
    def translate(self, text: str, source_language: str | None = None) -> TranslationResult
    def detect_language(self, text: str) -> LanguageDetection
```

**TranslationResult:**

```python
class TranslationResult:
    original_text: str
    translated_text: str
    detected_language: str
    detected_language_name: str
    confidence: float
```

### OpenRouter Integration

**Translation Prompt:**

```
You are a translation assistant helping students participate in English-language classrooms.

Task: Translate the following text to natural, grammatically correct English suitable for asking a professor in an academic setting.

Instructions:
1. First, detect the source language
2. Translate to English, preserving the original meaning and intent
3. Ensure the translation is a complete, well-formed question
4. Use academic but conversational language appropriate for a classroom
5. If the input is already in English, correct any grammar issues and return a polished version

Input text: "{user_text}"

Respond in this exact JSON format:
{
  "detected_language": "language code (zh, hi, es, fr, bn, en)",
  "detected_language_name": "full language name",
  "confidence": 0.0-1.0,
  "translated_text": "the English translation"
}
```

**Model Selection:**

- Use `openai/gpt-4o-mini` for fast, accurate translation
- Temperature: 0.3 (low creativity, high accuracy)
- Max tokens: 500

### External Clients

**OpenRouterClient (translation):**

```python
class OpenRouterClient:
    async def translate_question(self, text: str, source_lang: str | None) -> TranslationResult
```

**ElevenLabsClient (TTS):**

```python
class ElevenLabsClient:
    async def text_to_speech(self, text: str, voice_id: str | None = None) -> bytes
```

- Calls `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with `xi-api-key` header.
- Request body: `{"text": text, "model_id": "eleven_turbo_v2_5"}` (or `eleven_flash_v2_5`). Use `output_format: "mp3_44100_128"`.
- Returns raw MP3 bytes. Propagates rate limits (429) and service errors (5xx).

### TTS Service Layer

**TTSService (or extend QuestionTranslationService):**

```python
class TTSService:
    def __init__(self, client: ElevenLabsClient, voice_id: str | None): ...
    async def speak(self, text: str) -> bytes
```

- Validates `text` (non-empty, max 1000 chars). Uses `ELEVENLABS_VOICE_ID` or default English voice.

### Error Handling

| Scenario                      | Handling                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| **Translation**               |                                                            |
| Empty input                   | Return 400 before calling LLM                              |
| Input too long                | Return 400, truncate suggestion                            |
| Unsupported language detected | Return 400 with supported list                             |
| LLM timeout                   | Retry once, then return 503                                |
| Invalid LLM response          | Return 500 with generic message                            |
| Translate rate limit exceeded | Return 429 with retry-after header                         |
| **TTS (ElevenLabs)**          |                                                            |
| Empty / too long text         | Return 400 before calling ElevenLabs                       |
| ElevenLabs 429                | Return 429 TTS_RATE_LIMIT, optionally retry-after          |
| ElevenLabs 5xx or timeout     | Return 503 TTS_UNAVAILABLE or 500 TTS_ERROR                |
| Missing `ELEVENLABS_API_KEY`  | Fail fast at startup; 503 if misconfigured at request time |

### Rate Limiting

- **Translation:** Per-session limit 30 translations per hour. Returns 429 with remaining time when exceeded.
- **TTS:** Per-session limit (e.g. 60 speaks per hour) to avoid ElevenLabs overuse. Return 429 TTS_RATE_LIMIT when exceeded. Consider ElevenLabs tier limits when defining app-side caps.

---

## Accessibility

### Screen Reader Support

- Panel has appropriate ARIA labels
- Live region announces translation results
- **Speak button** has clear label (e.g. "Speak translation aloud") and announces playing/stopped state
- Error messages announced immediately

### Keyboard Accessibility

- All actions accessible via keyboard
- Focus trapped within panel when open
- Visible focus indicators on all interactive elements

### Visual Accessibility

- High contrast text
- Clear visual distinction between input and output
- Error states use both color and icons
