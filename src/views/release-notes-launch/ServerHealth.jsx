import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { bandDots, bandGlass } from '../home-2027/band'
import { deepBand } from '../runtime-launch/diagramKit'

// The host's health moved to the app bar's Server status (components/shared/ServerStatus.jsx).

// ─── visitors (the owner's view — deliberately low-key) ──────────────────────

function parseUA(ua) {
  if (!ua) return { browser: null, os: null }
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : null
  const os = /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null
  return { browser, os }
}
function ago(ts) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`
}

export function VisitorsDrawer({ t, open, onClose }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!open) return undefined
    fetch('/api/activity').then((r) => r.json()).then(setRows).catch(() => setRows([]))
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" className="fixed inset-0" style={{ zIndex: 60, background: 'rgba(0,0,0,0.25)' }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside key="dr" role="dialog" aria-label="Visitors" className="fixed top-0 right-0 bottom-0 flex flex-col"
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                        style={{ zIndex: 61, width: 460, maxWidth: '100vw', background: t.ground, boxShadow: '-12px 0 40px rgba(0,0,0,0.2)' }}>
            <div className="relative flex-shrink-0 overflow-hidden" style={{ background: deepBand('#6366F1'), minHeight: 92 }}>
              <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
              <Users aria-hidden="true" strokeWidth={1.3} style={{ position: 'absolute', right: -20, bottom: -38, width: 140, height: 140, color: '#fff', opacity: 0.13 }} />
              <div className="relative flex items-center gap-3 px-4 py-4">
                <span className="grid place-items-center rounded-2xl" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}><Users size={19} style={{ color: '#fff' }} aria-hidden="true" /></span>
                <div className="flex-1 min-w-0">
                  <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Activity</div>
                  <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: '#fff' }}>{rows ? `${rows.length} visitor${rows.length === 1 ? '' : 's'}` : 'Visitors'}</div>
                  <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.9)' }}>Unique addresses that opened a pillar</div>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="grid place-items-center rounded-full" style={{ width: 30, height: 30, ...bandGlass }}><X size={14} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!rows ? <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, padding: 12 }}>Loading…</p>
                : !rows.length ? <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, padding: 12 }}>No visits logged yet.</p>
                : rows.map((r, i) => {
                  const { browser, os } = parseUA(r.user_agent)
                  const pills = [[r.city, r.country].filter(Boolean).join(', '), r.timezone, browser, os, r.language].filter(Boolean)
                  return (
                    <div key={i} className="rounded-2xl px-3.5 py-3" style={{ background: t.panel, border: `1px solid ${t.glassEdge}` }}>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate" style={{ fontFamily: FONT.mono, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{r.ip ?? '—'}</span>
                        <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '19px', color: '#6366F1', background: '#6366F11a' }}>{r.visits} view{r.visits === 1 ? '' : 's'}</span>
                        <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{ago(r.last_seen)}</span>
                      </div>
                      {pills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pills.map((x) => <span key={x} className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: '18px', color: t.inkDim, background: t.sunken }}>{x}</span>)}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
