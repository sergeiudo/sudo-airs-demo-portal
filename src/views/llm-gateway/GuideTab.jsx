import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { GUIDE_SNIPPETS, GUIDE_STEPS } from '../../data/llmGatewayGuideSnippets'
import { useAppContext } from '../../context/AppContext'

const ACCENT = '#ec4899'
const LANGS = [
  { id: 'curl',   label: 'curl' },
  { id: 'node',   label: 'Node.js' },
  { id: 'python', label: 'Python' },
]

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

export function GuideTab() {
  const { state } = useAppContext()
  const isLight = !state.isDark
  const [lang, setLang] = useState('node')
  const snippets = GUIDE_SNIPPETS[lang]
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color: ACCENT }}>Integration Guide</div>
        <h2 className="text-xl font-bold mt-1" style={{ color: textPrimary }}>Add Portkey + AIRS to your app</h2>
        <p className="text-[13px] mt-2" style={{ color: textSecondary }}>
          Pick your language. Same five steps everywhere: set env vars, init client, send a chat request, read the AIRS verdict from <code>hook_results</code>, then enable streaming.
        </p>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-white/10">
        {LANGS.map(l => {
          const active = lang === l.id
          return (
            <button key={l.id} onClick={() => setLang(l.id)}
                    className="px-4 py-2 text-[12px] font-semibold"
                    style={{
                      color: active ? ACCENT : textSecondary,
                      borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                    }}>
              {l.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-6">
        {GUIDE_STEPS.map((step, i) => {
          const s = snippets[step]
          if (!s) return null
          return (
            <section key={step}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: `${ACCENT}22`, color: ACCENT }}>{i + 1}</span>
                <h3 className="text-[14px] font-bold" style={{ color: textPrimary }}>{step}</h3>
              </div>
              <CodeBlock code={s.code} lang={s.lang} />
            </section>
          )
        })}
      </div>
    </div>
  )
}
