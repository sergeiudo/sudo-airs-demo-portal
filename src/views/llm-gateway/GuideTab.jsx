import React, { useEffect, useRef, useState } from 'react'
import { Copy, Check, FileCode2, BookOpen } from 'lucide-react'
import { GUIDE_SECTIONS } from '../../data/llmGatewayGuideSnippets'
import { useAppContext } from '../../context/AppContext'

const ACCENT = '#ec4899'

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }
  return (
    <div className="relative rounded-lg overflow-hidden" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200">
          {copied ? <><Check size={11} /> copied</> : <><Copy size={11} /> copy</>}
        </button>
      </div>
      <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto" style={{ color: '#c9d1d9' }}>{code}</pre>
    </div>
  )
}

function ResizeHandle({ onMouseDown, active, isLight }) {
  const [hover, setHover] = useState(false)
  const lit = active || hover
  return (
    <div onMouseDown={onMouseDown} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         className="relative flex-shrink-0 w-1 cursor-col-resize">
      <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
      <div className="h-full w-full transition-colors duration-150"
           style={{ background: lit ? `${ACCENT}${active ? '99' : '66'}` : (isLight ? 'rgba(0,48,135,0.12)' : 'rgba(255,255,255,0.10)') }} />
    </div>
  )
}

function Section({ section, isLight }) {
  const [idx, setIdx] = useState(0)
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const snippet = section.snippets[idx] || section.snippets[0]
  const repoBg = isLight ? 'rgba(236,72,153,0.04)' : 'rgba(236,72,153,0.06)'

  return (
    <section id={`guide-${section.id}`} data-gid={section.id} className="flex flex-col gap-3" style={{ scrollMarginTop: 12 }}>
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
              style={{ background: `${ACCENT}22`, color: ACCENT }}>{section.num}</span>
        <h3 className="text-[16px] font-bold" style={{ color: textPrimary }}>{section.title}</h3>
      </div>
      <p className="text-[12.5px] leading-relaxed" style={{ color: textSecondary }}>{section.what}</p>

      {/* language tabs (only the langs this section has) */}
      {section.snippets.length > 1 && (
        <div className="flex items-center gap-1">
          {section.snippets.map((sn, i) => {
            const active = i === idx
            return (
              <button key={sn.label} onClick={() => setIdx(i)}
                      className="px-3 py-1 rounded-md text-[11px] font-semibold transition-colors"
                      style={{ background: active ? `${ACCENT}1a` : 'transparent', color: active ? ACCENT : textSecondary, border: `1px solid ${active ? `${ACCENT}55` : 'transparent'}` }}>
                {sn.label}
              </button>
            )
          })}
        </div>
      )}
      <CodeBlock code={snippet.code} lang={snippet.label} />

      {/* in-repo reference */}
      {section.repo && (
        <div className="rounded-lg overflow-hidden" style={{ background: repoBg, border: `1px solid ${ACCENT}33` }}>
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold" style={{ color: ACCENT }}>
            <FileCode2 size={13} /> In this repo
            <span className="font-mono" style={{ color: isLight ? '#7c3a63' : '#f0abcf' }}>{section.repo.file}</span>
            <span style={{ color: textSecondary }}>· {section.repo.symbol}</span>
          </div>
          <div className="px-3 pb-3">
            <CodeBlock code={section.repo.code} lang={`${section.repo.file} · ${section.repo.lang}`} />
          </div>
        </div>
      )}
    </section>
  )
}

export function GuideTab() {
  const { state } = useAppContext()
  const isLight = !state.isDark
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const surfaceBg = isLight ? '#ffffff' : 'rgba(15,20,35,0.6)'
  const surfaceBorder = isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.08)'

  const [activeId, setActiveId] = useState(GUIDE_SECTIONS[0].id)
  const mainRef = useRef(null)

  // resizable TOC rail
  const [leftWidth, setLeftWidth] = useState(260)
  const [drag, setDrag] = useState(false)
  const dragRef = useRef({ startX: 0, startW: 0 })
  const startDrag = (e) => { e.preventDefault(); dragRef.current = { startX: e.clientX, startW: leftWidth }; setDrag(true) }
  useEffect(() => {
    if (!drag) return
    const onMove = (e) => setLeftWidth(Math.min(420, Math.max(200, dragRef.current.startW + (e.clientX - dragRef.current.startX))))
    const onUp = () => setDrag(false)
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [drag])

  // scroll-spy
  useEffect(() => {
    const root = mainRef.current
    if (!root) return
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActiveId(e.target.dataset.gid)
    }, { root, rootMargin: '0px 0px -78% 0px', threshold: 0 })
    GUIDE_SECTIONS.forEach(s => { const el = document.getElementById(`guide-${s.id}`); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [])

  const goto = (id) => {
    setActiveId(id)
    document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-1 min-h-0" style={{ cursor: drag ? 'col-resize' : 'default', userSelect: drag ? 'none' : 'auto' }}>
      {/* LEFT — table of contents (resizable) */}
      <aside className="flex-shrink-0 flex flex-col gap-1 p-4 border-r overflow-y-auto"
             style={{ width: leftWidth, background: surfaceBg, borderColor: surfaceBorder }}>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: textSecondary }}>
          <BookOpen size={12} /> On this page
        </div>
        {GUIDE_SECTIONS.map(s => {
          const active = activeId === s.id
          return (
            <button key={s.id} onClick={() => goto(s.id)}
                    className="flex items-start gap-2 text-left px-2.5 py-2 rounded-lg text-[12px] transition-colors"
                    style={{
                      background: active ? `${ACCENT}14` : 'transparent',
                      color: active ? ACCENT : textPrimary,
                      borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
                    }}>
              <span className="font-mono text-[11px] opacity-70 mt-0.5">{s.num}</span>
              <span className="font-semibold leading-snug">{s.title}</span>
            </button>
          )
        })}
      </aside>

      <ResizeHandle onMouseDown={startDrag} active={drag} isLight={isLight} />

      {/* MAIN — sections */}
      <main ref={mainRef} className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-10">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color: ACCENT }}>Integration Guide</div>
            <h2 className="text-2xl font-bold" style={{ color: textPrimary }}>Add Portkey + Prisma AIRS to your app</h2>
            <p className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
              Each use case below shows a copy-paste snippet (curl / Node / Python) plus the
              real code in this repo, so you can wire it up or point a developer straight at the source.
            </p>
          </div>
          {GUIDE_SECTIONS.map(s => <Section key={s.id} section={s} isLight={isLight} />)}
        </div>
      </main>
    </div>
  )
}
