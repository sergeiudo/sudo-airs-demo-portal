# Translate Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "He" Hebrew-only translation button with a "Translate" dropdown supporting 10 languages, sending the translated text as a new chat message.

**Architecture:** `ChatCenter.jsx` gets a generic `handleTranslate(text, language)` function that calls `/api/chat` with a translation prompt. `ChatMessage.jsx` gets local dropdown state with smart up/down positioning and click-outside dismissal. Only these 2 files change.

**Tech Stack:** React (useState, useRef, useEffect), Tailwind CSS, existing `/api/chat` endpoint

---

### Task 1: Update `ChatCenter.jsx` — replace `handleSendHebrew` with `handleTranslate`

**Files:**
- Modify: `src/components/api-intercept/ChatCenter.jsx`

- [ ] **Step 1: Replace `handleSendHebrew` with `handleTranslate`**

Find the `handleSendHebrew` function (around line 335) and replace the entire function with:

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

- [ ] **Step 2: Update the prop passed to `ChatMessage`**

Find the line passing `onResendHebrew` to `ChatMessage` (around line 417) and replace:

```js
onResendHebrew={msg.role === 'user' ? () => handleSendHebrew(msg.content) : undefined}
```

with:

```js
onTranslate={msg.role === 'user' ? (text, lang) => handleTranslate(text, lang) : undefined}
```

- [ ] **Step 3: Verify the app still compiles**

```bash
cd /Users/sudovenko/sudo-airs-local-demo-vertex-bedrock
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors (warnings are OK).

- [ ] **Step 4: Commit**

```bash
git add src/components/api-intercept/ChatCenter.jsx
git commit -m "feat: replace handleSendHebrew with generic handleTranslate(text, language)"
```

---

### Task 2: Update `ChatMessage.jsx` — replace "He" button with Translate dropdown

**Files:**
- Modify: `src/components/api-intercept/ChatMessage.jsx`

- [ ] **Step 1: Add `useRef` to the import**

At line 1, `useState` is already imported. Add `useRef` and `useEffect` if not already present:

```js
import React, { useState, useRef, useEffect } from 'react'
```

- [ ] **Step 2: Remove `isHebrewText` helper**

Delete lines 7–9 entirely:

```js
// DELETE THIS:
function isHebrewText(str) {
  return /[\u0590-\u05FF]/.test(str)
}
```

- [ ] **Step 3: Update `UserMessage` props and add dropdown state**

Change the function signature from:

```js
function UserMessage({ message, onResend, onResendHebrew, isLoading, isTranslating }) {
```

to:

```js
function UserMessage({ message, onResend, onTranslate, isLoading, isTranslating }) {
```

Remove the `hebrew` variable on the line after (was `const hebrew = isHebrewText(message.content)`).

Add dropdown state and ref directly below the function signature:

```js
const [showDropdown, setShowDropdown] = useState(false)
const [openUpward, setOpenUpward] = useState(false)
const btnRef = useRef(null)
```

- [ ] **Step 4: Add click-outside effect**

Add this `useEffect` after the state declarations (before the `severityColor` block):

```js
useEffect(() => {
  if (!showDropdown) return
  const handler = (e) => {
    if (btnRef.current && !btnRef.current.closest('.translate-dropdown-root')?.contains(e.target)) {
      setShowDropdown(false)
    }
  }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [showDropdown])
```

- [ ] **Step 5: Define the languages list**

Add this constant before the `return` statement inside `UserMessage`:

```js
const LANGUAGES = [
  'English', 'Spanish', 'Russian', 'German', 'French',
  'Japanese', 'Portuguese', 'Italian', 'Simplified Chinese', 'Hebrew',
]
```

- [ ] **Step 6: Replace the "He" button with the Translate button + dropdown**

Find and replace the entire `{onResendHebrew && (...)}` block (lines 145–155 approx):

```jsx
// REMOVE THIS:
{onResendHebrew && (
  <button
    onClick={onResendHebrew}
    disabled={isLoading}
    className="flex items-center gap-1 text-blue-400/70 hover:text-blue-300 transition-colors disabled:opacity-30"
    title="Translate to Hebrew"
  >
    <Languages size={9} className={isTranslating ? 'animate-spin' : ''} />
    He
  </button>
)}
```

Replace with:

```jsx
{onTranslate && (
  <div className="relative translate-dropdown-root" ref={btnRef}>
    <button
      onClick={() => {
        if (btnRef.current) {
          const rect = btnRef.current.getBoundingClientRect()
          setOpenUpward(rect.bottom > window.innerHeight / 2)
        }
        setShowDropdown(prev => !prev)
      }}
      disabled={isLoading}
      className="flex items-center gap-1 text-blue-400/70 hover:text-blue-300 transition-colors disabled:opacity-30"
      title="Translate message"
    >
      <Languages size={9} className={isTranslating ? 'animate-spin' : ''} />
      Translate
    </button>
    {showDropdown && (
      <div
        className={`absolute right-0 z-50 w-44 bg-slate-900/95 border border-white/10 rounded-xl shadow-xl backdrop-blur-md overflow-hidden ${
          openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => {
              setShowDropdown(false)
              onTranslate(message.content, lang)
            }}
            className="w-full text-left px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/8 hover:text-white transition-colors"
          >
            {lang}
          </button>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Remove Hebrew RTL styling from the user bubble text**

Find the `<p>` tag inside the bubble (around line 107) that has Hebrew-conditional styles:

```jsx
// REMOVE the hebrew conditional — change this:
style={{
  ...(hebrew
    ? { fontFamily: 'Arial, sans-serif', direction: 'rtl', textAlign: 'right', fontSize: '13px' }
    : { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '12px' }),
  color: 'var(--user-bubble-text)',
}}

// TO this (always monospace, no Hebrew detection):
style={{
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '12px',
  color: 'var(--user-bubble-text)',
}}
```

- [ ] **Step 8: Update the `ChatMessage` export props**

Find the export at the bottom (line 278):

```js
// Change:
export function ChatMessage({ message, onResend, onResendHebrew, isLoading, isTranslating, onOpenTelemetry }) {

// To:
export function ChatMessage({ message, onResend, onTranslate, isLoading, isTranslating, onOpenTelemetry }) {
```

And update the `UserMessage` call inside it:

```jsx
// Change:
onResendHebrew={onResendHebrew}

// To:
onTranslate={onTranslate}
```

- [ ] **Step 9: Build and verify**

```bash
cd /Users/sudovenko/sudo-airs-local-demo-vertex-bedrock
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/api-intercept/ChatMessage.jsx
git commit -m "feat: replace He button with Translate dropdown for 10 languages"
```

---

### Task 3: Smoke test

**Files:** none (manual test)

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/sudovenko/sudo-airs-local-demo-vertex-bedrock
npm run dev
```

- [ ] **Step 2: Open the app and send a message**

Open `http://localhost:5173`, go to API Intercept, send any message (e.g. "hello").

- [ ] **Step 3: Verify Translate button appears**

Below the user bubble, confirm you see "Translate" (with the Languages icon) instead of "He".

- [ ] **Step 4: Verify dropdown opens**

Click "Translate" — confirm a dropdown appears listing all 10 languages: English, Spanish, Russian, German, French, Japanese, Portuguese, Italian, Simplified Chinese, Hebrew.

- [ ] **Step 5: Verify smart positioning**

Send a message near the top of the chat — dropdown should open downward. If the chat is scrolled so the message is near the bottom of the viewport — dropdown should open upward.

- [ ] **Step 6: Verify click-outside closes dropdown**

Open the dropdown, then click anywhere outside it — confirm it closes.

- [ ] **Step 7: Verify translation works**

Click "Translate" → select "Spanish". Confirm a new message appears in Spanish. The original message should remain visible above it.

- [ ] **Step 8: Verify spinner during translation**

Click "Translate" → select a language — confirm the Languages icon spins while the translation is in progress.
