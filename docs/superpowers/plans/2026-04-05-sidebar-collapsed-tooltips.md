# Sidebar Collapsed Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native browser `title` tooltip on collapsed sidebar nav items with a polished custom Framer Motion tooltip showing the item's label and sublabel.

**Architecture:** All changes are isolated to `NavItem.jsx`. When `collapsed === true` and the item is hovered, a `position: fixed` tooltip is rendered using a `useRef` + `getBoundingClientRect()` approach to escape the sidebar's `overflow: hidden` constraint. Light/dark mode is handled via inline styles following the existing CLAUDE.md dropdown pattern.

**Tech Stack:** React, Framer Motion (already installed), inline styles (required for theme correctness per CLAUDE.md)

---

## Files

- **Modify:** `src/components/sidebar/NavItem.jsx` — sole change; add ref, compute fixed position, render Framer Motion tooltip portal

---

### Task 1: Add button ref and compute fixed tooltip position

**Files:**
- Modify: `src/components/sidebar/NavItem.jsx`

- [ ] **Step 1: Add `useRef` import and create a ref on the button**

Open `src/components/sidebar/NavItem.jsx`. Change the import line from:

```jsx
import React, { useState } from 'react'
```

to:

```jsx
import React, { useState, useRef } from 'react'
```

Then add `const buttonRef = useRef(null)` inside the component body (after the existing `useState` calls), and attach it to the `motion.button`:

```jsx
const buttonRef = useRef(null)
```

And on the `motion.button` element add `ref={buttonRef}`.

- [ ] **Step 2: Verify the app still renders with no console errors**

Run `npm run dev` (if not already running) and open the sidebar. Confirm no errors in the browser console. The sidebar should look and behave exactly as before.

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/NavItem.jsx
git commit -m "refactor: add buttonRef to NavItem for tooltip positioning"
```

---

### Task 2: Render the custom tooltip with Framer Motion

**Files:**
- Modify: `src/components/sidebar/NavItem.jsx`

- [ ] **Step 1: Add AnimatePresence import**

Framer Motion is already imported. Change:

```jsx
import { motion } from 'framer-motion'
```

to:

```jsx
import { motion, AnimatePresence } from 'framer-motion'
```

- [ ] **Step 2: Add tooltip position state and mouse-enter handler**

Add a `tooltipPos` state to track the fixed position:

```jsx
const [tooltipPos, setTooltipPos] = useState({ top: 0 })
```

Update the `onMouseEnter` handler on `motion.button` to also compute position:

```jsx
onMouseEnter={() => {
  setHovered(true)
  if (buttonRef.current) {
    const rect = buttonRef.current.getBoundingClientRect()
    setTooltipPos({ top: rect.top + rect.height / 2 })
  }
}}
```

- [ ] **Step 3: Remove the native title attribute**

Remove `title={collapsed ? label : undefined}` from `motion.button` — the custom tooltip replaces it.

- [ ] **Step 4: Render the tooltip using a fixed-position div**

Add this block **inside** the `motion.button` return, as the last child element (after the icon and the `!collapsed` text block):

```jsx
<AnimatePresence>
  {collapsed && hovered && (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        left: 76,
        top: tooltipPos.top,
        transform: 'translateY(-50%)',
        zIndex: 9999,
        pointerEvents: 'none',
        background: document.documentElement.classList.contains('light')
          ? '#ffffff'
          : 'rgba(15,20,35,0.98)',
        border: document.documentElement.classList.contains('light')
          ? '1px solid rgba(0,48,135,0.14)'
          : '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        padding: '8px 12px',
        backdropFilter: 'blur(12px)',
        boxShadow: document.documentElement.classList.contains('light')
          ? '0 8px 24px rgba(0,48,135,0.10)'
          : '0 4px 16px rgba(0,0,0,0.4)',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: document.documentElement.classList.contains('light') ? '#1e293b' : '#e2e8f0',
        lineHeight: 1.3,
      }}>
        {label}
      </div>
      {sublabel && (
        <div style={{
          fontSize: 10,
          color: '#64748b',
          marginTop: 2,
          lineHeight: 1.3,
        }}>
          {sublabel}
        </div>
      )}
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 5: Verify tooltip appears correctly**

Run the dev server. Collapse the sidebar (or just don't hover it). Hover each nav icon one at a time. Confirm:
- Tooltip appears immediately to the right of the icon (~12px gap from icon right edge)
- Shows label (bold) and sublabel (dimmer, smaller) 
- Fades in smoothly (~150ms)
- Fades out when you move the mouse away
- Tooltip is NOT clipped by the sidebar edge
- Does NOT appear when the sidebar is expanded

- [ ] **Step 6: Test light mode**

Click the dark/light toggle in the TopBar. Hover a collapsed sidebar icon. Confirm tooltip uses white background and dark text (not the dark glass style).

- [ ] **Step 7: Commit**

```bash
git add src/components/sidebar/NavItem.jsx
git commit -m "feat: add custom Framer Motion tooltip to collapsed sidebar nav items"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tooltip shows label + sublabel when collapsed and hovered
- ✅ Framer Motion fade-in (opacity 0→1, x -6→0, 150ms ease-out)
- ✅ Dark glass card style matching CLAUDE.md dropdown pattern
- ✅ Light mode inline style variant
- ✅ Fixed positioning escapes sidebar `overflow: hidden`
- ✅ Native `title` attribute removed
- ✅ Only `NavItem.jsx` modified

**Placeholder scan:** None found.

**Type consistency:** `tooltipPos.top` set in mouseEnter, consumed in tooltip `style.top` — consistent.
