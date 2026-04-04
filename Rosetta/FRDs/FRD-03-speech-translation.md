# FRD-03: Real-Time Speech Translation

## Overview

Real-Time Speech Translation captures professor speech via the browser's Web Speech API, translates text via OpenRouter LLM, and outputs natural-sounding audio through ElevenLabs Text-to-Speech API. This is the core feature that enables students to hear lectures in their preferred language in real-time.

**Key Design Decisions:**

1. **Browser-Based Speech Recognition** — Audio is captured and transcribed directly in the browser using Web Speech API.

2. **Text-Based Translation** — Transcribed text is sent to OpenRouter (Claude 3 Haiku) for translation to the target language.

3. **WebSocket Streaming** — Transcript segments stream to the backend via WebSocket for translation and TTS.

4. **Natural Voice Synthesis** — ElevenLabs TTS (eleven_turbo_v2_5 model) provides human-like voice output.

5. **Echo Detection** — The system filters TTS playback audio to prevent it from being re-transcribed.

6. **Source Language: English Only** — The professor speaks in English; translation is from English to the student's selected target language.

---

## User Stories

### Starting Translation

A student opens their session for "CS 401 - Lecture 5". Before the lecture begins, they select their preferred language from a dropdown: "Chinese (Mandarin)". They verify their audio output is set to their headphones.

The professor begins speaking. The student clicks the "Start Translation" button. A brief connection indicator shows "Connecting...", then changes to "Live" with a pulsing green indicator.

Within 2 seconds of the professor speaking, the student hears a natural Chinese voice in their headphones delivering the translated content. The translation follows the professor with minimal delay, allowing the student to follow along in real-time.

### Adjusting Volume

The translated audio is too loud compared to the ambient classroom sound. The student uses the volume slider in the audio controls panel to reduce the translation volume to 60%. The change takes effect immediately — no need to stop and restart.

### Muting Translation

The professor makes a joke that doesn't translate well, and the student wants to hear the original English. They click the mute button. The translation audio stops, but the session continues recording. The student can unmute at any time to resume hearing translations.

### Handling Connection Issues

The student's WiFi briefly drops. The translation audio stops, and a warning indicator appears: "Connection lost. Reconnecting..."

After 3 seconds, the connection is restored. The indicator returns to "Live". The translation resumes from the current point in the lecture — there's no attempt to "catch up" on missed content (which would cause confusing overlap).

### Ending the Session

The lecture concludes. The student clicks "End Session". The translation stops, the WebSocket connection closes, and a dialog appears asking if they want to generate notes. The audio controls panel returns to its initial state, ready for the next session.

### Switching Languages Mid-Session

The student realizes they selected the wrong language. They click the language dropdown and select "Hindi" instead of "Chinese". A brief pause occurs as the connection reconfigures, then translation resumes in Hindi. No restart is required.

---

## System Behavior

### Audio Capture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ Microphone  │───▶│ Web Audio   │───▶│ Audio       │      │
│  │ (MediaStream)│   │ API Context │    │ Processor   │      │
│  └─────────────┘    └─────────────┘    └──────┬──────┘      │
│                                                │              │
│                                      Audio chunks (PCM)      │
│                                                │              │
│  ┌─────────────────────────────────────────────▼──────────┐  │
│  │                    WebSocket Client                     │  │
│  │            Send: audio chunks (binary)                  │  │
│  │            Receive: translated audio (binary)           │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Backend                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  WebSocket Server                        │ │
│  │  - Receive audio chunks from browser                     │ │
│  │  - Forward to ElevenLabs S2S API                        │ │
│  │  - Receive translated audio from ElevenLabs             │ │
│  │  - Forward to browser                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     ElevenLabs API                           │
│  - Speech-to-Speech streaming endpoint                       │
│  - Source: English audio                                     │
│  - Target: Selected language                                 │
│  - Output: Natural voice synthesis                           │
└─────────────────────────────────────────────────────────────┘
```

### ElevenLabs Integration

**API Endpoint:** Text-to-Speech

**Request Configuration:**

- Model: `eleven_turbo_v2_5`
- Voice: User-selected from available voices API
- Output format: MP3 or PCM

**Streaming Behavior:**

- Text sent to ElevenLabs TTS
- Returns audio as it's generated
- Latency: typically < 1 second

### Latency Breakdown

| Stage                               | Target Latency |
| ----------------------------------- | -------------- |
| Speech recognition (Web Speech API) | ~300ms         |
| WebSocket to backend                | ~50ms          |
| Text translation (OpenRouter)       | ~500ms         |
| TTS generation (ElevenLabs)         | ~500ms         |
| Response to browser                 | ~100ms         |
| **Total end-to-end**                | **< 2000ms**   |

---

## API Endpoints

### Translation WebSocket

```
WebSocket /api/v1/translate/stream
```

**Connection Parameters (Query String):**

```
session_id: UUID (required)
target_language: string (required, e.g., "zh", "hi")
```

**Client → Server Messages:**

Binary frames: Raw PCM audio data

JSON control messages:

```
{ "type": "mute" }
{ "type": "unmute" }
{ "type": "change_language", "language": "zh" }
{ "type": "ping" }
```

**Server → Client Messages:**

Binary frames: Translated audio data

JSON status messages:

```
{ "type": "connected", "session_id": "...", "language": "zh" }
{ "type": "status", "status": "live" | "muted" | "reconnecting" }
{ "type": "language_changed", "language": "hi" }
{ "type": "error", "code": "...", "message": "..." }
{ "type": "pong" }
```

### Get Supported Languages

```
GET /api/v1/translate/languages
```

Response Schema:

```
{
  languages: [
    {
      code: string,
      name: string,
      native_name: string,
      available: boolean
    }
  ]
}
```

---

## System State

### Session Translation State

Translation state is ephemeral — it exists only during active WebSocket connections and is not persisted to the database.

**In-Memory State Per Connection:**

```python
class TranslationSession:
    session_id: UUID
    target_language: str
    is_muted: bool
    connected_at: datetime
    elevenlabs_stream: ElevenLabsStream | None
    audio_buffer: AudioBuffer
```

### Connection Lifecycle

```
┌─────────────┐
│ Disconnected│
└──────┬──────┘
       │ WebSocket connect
       ▼
┌─────────────┐
│ Connecting  │
└──────┬──────┘
       │ ElevenLabs stream established
       ▼
┌─────────────┐
│    Live     │◄───────────────┐
└──────┬──────┘                │
       │ Mute                  │ Unmute
       ▼                       │
┌─────────────┐                │
│   Muted     │────────────────┘
└──────┬──────┘
       │ Connection lost
       ▼
┌─────────────┐
│ Reconnecting│───▶ (back to Live or Disconnected)
└─────────────┘
```

---

## Frontend Behavior

### Audio Controls Panel

The audio controls appear at the bottom of the session view:

```
┌─────────────────────────────────────────────────────────────┐
│  🔊 Translation: [Chinese ▼]                                │
│                                                             │
│  [▶ Start] ─────────────────────────●───── [🔇] [100%]     │
│            ◀──── Volume slider ────▶                        │
│                                                             │
│  Status: Ready                                              │
└─────────────────────────────────────────────────────────────┘
```

**Controls:**

- Language dropdown: Select target language
- Start/Stop button: Begin or end translation
- Volume slider: 0-100%
- Mute button: Toggle audio output
- Status indicator: Ready / Connecting / Live / Muted / Error

### Language Selector

**Dropdown Behavior:**

- Shows language name and native name
- Disabled when translation is starting (brief moment)
- Change triggers reconnection if active

**Dropdown Options:**

```
Chinese (Mandarin) - 中文
Hindi - हिन्दी
Spanish - Español
French - Français
Bengali - বাংলা
```

### Status Indicators

| Status       | Visual       | Description                          |
| ------------ | ------------ | ------------------------------------ |
| Ready        | Gray dot     | Not translating, ready to start      |
| Connecting   | Yellow pulse | Establishing connection              |
| Live         | Green pulse  | Active translation                   |
| Muted        | Orange dot   | Connected but audio muted            |
| Reconnecting | Yellow blink | Lost connection, attempting recovery |
| Error        | Red dot      | Connection failed, needs restart     |

### Audio Playback

**Playback Management:**

- Audio plays through Web Audio API
- Respects volume slider setting
- Buffers ~100ms to prevent choppy playback
- Handles gaps gracefully (silence, no clicks/pops)

**Device Selection:**

- Uses system default audio output
- Future enhancement: Custom output device selection

### Error Handling

**Connection Errors:**

- Display: "Connection failed. Check your internet and try again."
- Action: "Retry" button

**ElevenLabs Errors:**

- Display: "Translation service unavailable. Please try again later."
- Action: Auto-retry after 5 seconds, max 3 attempts

**Microphone Permission Denied:**

- Display: "Microphone access required. Please allow access and refresh."
- Action: Link to browser permission settings

### State Management

**Client State (Zustand):**

```typescript
interface TranslationState {
  status: "ready" | "connecting" | "live" | "muted" | "reconnecting" | "error";
  targetLanguage: string;
  volume: number;
  isMuted: boolean;
  error: string | null;

  // Actions
  setTargetLanguage: (lang: string) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  start: () => void;
  stop: () => void;
}
```

**WebSocket Hook:**

```typescript
function useTranslationStream(sessionId: string, targetLanguage: string) {
  // Returns connection state and controls
  return {
    status: ConnectionStatus,
    start: () => void,
    stop: () => void,
    mute: () => void,
    unmute: () => void,
    changeLanguage: (lang: string) => void
  };
}
```

### Audio Capture Hook

```typescript
function useAudioCapture() {
  // Returns audio stream and controls
  return {
    isCapturing: boolean,
    stream: MediaStream | null,
    start: () => Promise<void>,
    stop: () => void,
    getAudioChunks: () => AsyncGenerator<ArrayBuffer>
  };
}
```

---

## Backend Implementation

### WebSocket Handler

```python
@router.websocket("/translate/stream")
async def translation_stream(
    websocket: WebSocket,
    session_id: UUID,
    target_language: str,
    service: TranslationService = Depends(get_translation_service)
):
    await websocket.accept()

    try:
        # Validate session and language
        # Establish ElevenLabs connection
        # Stream audio bidirectionally
        async for message in websocket.iter_bytes():
            translated = await service.translate_chunk(message, target_language)
            await websocket.send_bytes(translated)
    except WebSocketDisconnect:
        # Clean up ElevenLabs connection
        pass
```

### Service Layer

**TranslationService:**

```python
class TranslationService:
    def __init__(self, elevenlabs_client: ElevenLabsClient):
        self.client = elevenlabs_client

    async def create_stream(self, target_language: str) -> TranslationStream
    async def translate_chunk(self, audio: bytes, stream: TranslationStream) -> bytes
    async def change_language(self, stream: TranslationStream, language: str) -> None
    async def close_stream(self, stream: TranslationStream) -> None
```

### ElevenLabs Client

```python
class ElevenLabsClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.elevenlabs.io/v1"

    async def create_s2s_stream(
        self,
        target_language: str,
        voice_id: str
    ) -> ElevenLabsStream

    async def send_audio(self, stream: ElevenLabsStream, chunk: bytes) -> None

    async def receive_audio(self, stream: ElevenLabsStream) -> AsyncGenerator[bytes, None]
```

### Voice Configuration

```python
LANGUAGE_VOICE_MAP = {
    "zh": "voice_id_for_chinese",
    "hi": "voice_id_for_hindi",
    "es": "voice_id_for_spanish",
    "fr": "voice_id_for_french",
    "bn": "voice_id_for_bengali",
}

def get_voice_id(language: str) -> str:
    return LANGUAGE_VOICE_MAP.get(language)
```

### Error Handling

| Scenario              | Server Response    | Client Behavior          |
| --------------------- | ------------------ | ------------------------ |
| Invalid session_id    | Close with 4000    | Show error, no retry     |
| Invalid language      | Close with 4001    | Show error, no retry     |
| ElevenLabs rate limit | Send error message | Auto-retry after delay   |
| ElevenLabs down       | Send error message | Show error, manual retry |
| Client disconnect     | Clean up resources | —                        |

### Connection Management

**Keepalive:**

- Client sends ping every 30 seconds
- Server responds with pong
- No response for 60 seconds → connection considered dead

**Reconnection:**

- Client handles reconnection automatically
- Server does not maintain state between connections
- Fresh ElevenLabs stream on each connection

---

## Performance Considerations

### Audio Buffer Management

**Client-Side:**

- Ring buffer for incoming audio (1 second capacity)
- Jitter buffer for smooth playback
- Drop old audio if falling behind (prefer low latency over completeness)

**Server-Side:**

- Minimal buffering — forward audio immediately
- No server-side storage of audio

### Bandwidth Requirements

| Direction              | Rate                                     |
| ---------------------- | ---------------------------------------- |
| Upload (mic audio)     | ~256 kbps (16kHz, 16-bit PCM)            |
| Download (translation) | ~128 kbps (MP3) or ~352 kbps (22kHz PCM) |

### Resource Limits

- One translation stream per session
- ElevenLabs concurrent stream limits (per plan)
- WebSocket connection timeout: 2 hours (matches max lecture length)
