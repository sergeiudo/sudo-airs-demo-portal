# Translate Dropdown — Design Spec

**Date:** 2026-04-02  
**Status:** Approved

## Overview

Replace the hardcoded "He" (Hebrew) translation button on user chat messages with a "Translate" button that opens a dropdown listing 10 supported languages. Clicking a language translates the message via the LLM and sends the translated text as a new chat message.

## Supported Languages

| Dropdown Label | LLM Prompt Name |
|---|---|
| English | English |
| Spanish | Spanish |
| Russian | Russian |
| German | German |
| French | French |
| Japanese | Japanese |
| Portuguese | Portuguese |
| Italian | Italian |
| Simplified Chinese | Simplified Chinese |
| Hebrew | Hebrew |

All 10 languages are always shown — no filtering based on detected message language.

## Behavior

- Translated text is **sent as a new message**, keeping the original visible above it.
- The dropdown appears inline in the action row below the user bubble.
- Smart positioning: opens **upward** (`bottom-full mb-1`) if the button is in the lower half of the viewport, **downward** (`top-full mt-1`) otherwise, determined via `getBoundingClientRect()`.
- Clicking outside the dropdown closes it (mousedown listener on `document`).
- While translation is in progress, the `Languages` icon spins (same as current behavior).

## Architecture

### `ChatCenter.jsx`

Replace `handleSendHebrew(text)` with `handleTranslate(text, language)`:

```js
const handleTranslate = async (text, language) => {
  setTranslating(text)
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Translate the following text to ${language}. Return ONLY the translated text, nothing else:\n\n${text}`,
        airsEnabled: false,
        backend,
        modelId: model,
      }),
    })
    const data = await res.json()
    const translated = data.chatResponse?.content?.trim() || text
    onSendMessage(translated, backend, model)
  } catch {
    onSendMessage(text, backend, model)
  } finally {
    setTranslating(null)
  }
}
```

Pass to `ChatMessage`:
```js
onTranslate={msg.role === 'user' ? (text, lang) => handleTranslate(text, lang) : undefined}
```

### `ChatMessage.jsx`

**Props change:**
```js
// Before
{ message, onResend, onResendHebrew, isLoading, isTranslating, onOpenTelemetry }

// After
{ message, onResend, onTranslate, isLoading, isTranslating, onOpenTelemetry }
```

**`UserMessage` changes:**
- Add local state: `const [showDropdown, setShowDropdown] = useState(false)`
- Add ref: `const btnRef = useRef(null)` on the Translate button
- Replace `He` button with `Translate` button + conditional dropdown render
- Smart positioning: check `btnRef.current.getBoundingClientRect().bottom > window.innerHeight / 2`
- Click-outside: `useEffect` adding `mousedown` listener on `document`, cleanup on unmount
- Remove `isHebrewText` helper and all Hebrew-detection logic (no longer needed)

**Dropdown styling** (matches app dark glass aesthetic):
```
bg-slate-900/95 border border-white/10 rounded-xl shadow-xl backdrop-blur-md
```
Each language row: `px-3 py-1.5 text-[11px] hover:bg-white/8 cursor-pointer transition-colors`

## Files Changed

| File | Change |
|---|---|
| `src/components/api-intercept/ChatMessage.jsx` | Replace He button with Translate + dropdown; remove `isHebrewText`; update props |
| `src/components/api-intercept/ChatCenter.jsx` | Replace `handleSendHebrew` → `handleTranslate(text, language)`; update prop name |

No other files need changes. `ApiInterceptView` and `useAttackSimulator` do not reference `onResendHebrew` directly.

## Out of Scope

- Detecting the current message language and auto-filtering the dropdown
- Persisting the last-used language
- Translation of assistant messages
