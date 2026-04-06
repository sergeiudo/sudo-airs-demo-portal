import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Crosshair, ScanSearch, Swords, Terminal, BarChart2, Code2, Network, ShieldCheck, ShieldOff, Zap, Eye, MessageSquare } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

const VIEWS = [
  { id: 'apiIntercept',    icon: Crosshair,  label: 'API Intercept',                desc: 'Send real attack payloads and watch AIRS intercept them live.',        color: '#EF4444' },
  { id: 'modelScanning',   icon: ScanSearch, label: 'Model Scanning',               desc: 'Scan AI model files for embedded malware and vulnerabilities.',        color: '#3B82F6' },
  { id: 'redTeaming',      icon: Swords,     label: 'Red Teaming',                  desc: 'Run automated adversarial campaigns and measure robustness scores.',   color: '#F97316' },
  { id: 'claudeHooks',     icon: Terminal,   label: 'AI Code Assistant Protection', desc: 'See how AIRS protects Claude Code via pre/post-tool hook scripts.',    color: '#8B5CF6' },
  { id: 'observability',   icon: BarChart2,  label: 'LLM Telemetry',                desc: 'Browse prompt history, latency metrics, and detection breakdowns.',    color: '#10B981' },
  { id: 'developerCorner', icon: Code2,      label: 'Developer Corner',             desc: 'Python SDK, REST API reference, and live integration code samples.',   color: '#06B6D4' },
  { id: 'mcpSecurity',     icon: Network,    label: 'MCP Security',                 desc: 'Live MCP tool demo with real AIRS two-stage scanning — 10 OWASP attack scenarios.',  color: '#06B6D4' },
]

const TIPS = [
  { icon: ShieldOff,     text: 'Toggle protection OFF to see what happens without AIRS — attacks reach the model unblocked.' },
  { icon: Zap,           text: 'In API Intercept, click any attack payload from the library to auto-inject it into the chat.' },
  { icon: Eye,           text: 'Click "Prompt Telemetry" on any response to see the full AIRS pipeline trace and scan details.' },
  { icon: Network,       text: 'In MCP Security, try attack scenarios with protection OFF first, then ON — to show the before/after story.' },
]

export function HelpDrawer({ open, onClose }) {
  const { dispatch } = useAppContext()
  const isLight = document.documentElement.classList.contains('light')

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const navigate = (viewId) => {
    dispatch({ type: 'SET_VIEW', payload: viewId })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: 600, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 600, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 520,
              zIndex: 50,
              background: isLight ? '#ffffff' : 'rgba(13,17,28,0.98)',
              borderLeft: isLight ? '1px solid rgba(0,48,135,0.12)' : '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 24px 20px',
              borderBottom: isLight ? '1px solid rgba(0,48,135,0.08)' : '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: isLight ? '#0f172a' : '#f1f5f9' }}>
                  Demo Guide
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Prisma AIRS · AI Runtime Security
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                  color: '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

              {/* What is AIRS */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                  What is Prisma AIRS?
                </div>
                <div style={{
                  fontSize: 13, lineHeight: 1.65,
                  color: isLight ? '#334155' : '#94a3b8',
                  background: isLight ? 'rgba(0,48,135,0.04)' : 'rgba(255,255,255,0.03)',
                  border: isLight ? '1px solid rgba(0,48,135,0.08)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <strong style={{ color: isLight ? '#0f172a' : '#e2e8f0' }}>Prisma AIRS</strong> (AI Runtime Security) is Palo Alto Networks' platform for securing AI applications in production. It scans every prompt and response in real time — detecting prompt injection, jailbreaks, data exfiltration, and model supply-chain threats before they cause harm.
                </div>
              </div>

              {/* The toggle */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                  The Protection Toggle
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)',
                  }}>
                    <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>Protection ON — Secured</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>Every prompt and response is scanned by AIRS before reaching the model or the user.</div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)',
                  }}>
                    <ShieldOff size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>Protection OFF — Vulnerable</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>Requests go directly to the LLM. Attacks succeed. No scanning, no blocking.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Views */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                  Demo Views — click to navigate
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {VIEWS.map(v => (
                    <button
                      key={v.id}
                      onClick={() => navigate(v.id)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                        background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                        border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)',
                        textAlign: 'left', width: '100%',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = `${v.color}12`
                        e.currentTarget.style.borderColor = `${v.color}35`
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'
                        e.currentTarget.style.borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: `${v.color}18`, border: `1px solid ${v.color}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <v.icon size={14} style={{ color: v.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isLight ? '#0f172a' : '#e2e8f0' }}>{v.label}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{v.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                  Demo Tips
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {TIPS.map((tip, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 14px', borderRadius: 10,
                      background: isLight ? 'rgba(0,48,135,0.03)' : 'rgba(255,255,255,0.02)',
                      border: isLight ? '1px solid rgba(0,48,135,0.08)' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <tip.icon size={14} style={{ color: '#64748b', flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 12, color: isLight ? '#334155' : '#94a3b8', lineHeight: 1.5 }}>{tip.text}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
