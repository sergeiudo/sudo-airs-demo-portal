import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, HeartPulse, ShieldCheck, ShieldOff, Languages, Sliders, X,
  Activity, FileText, Wrench, Sparkles, AlertTriangle, RotateCcw, ChevronDown, Trash2,
  Paperclip, RefreshCw, ExternalLink,
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useMohChat } from '../../hooks/useMohChat'
import { MohLangProvider, useMohLang, isHebrewText } from './i18n'
import { mohTheme, MOH_RISK_COLORS, mohPopover } from './theme'
import { MOH_ATTACKS_BY_FAMILY, MOH_SEVERITY_COLORS, MOH_DETECTORS } from '../../data/moh/attacks'
import { ScanStageCard, AirsPayloadViewer, VerdictPill, DetectionBadges, CopyButton } from './components/ScanPanels'
import { subscribe, publish, MOH_EVENTS } from './bus'

/**
 * BriutApp — בריאות.AI, the citizen-facing Ministry of Health assistant.
 *
 * Rendered in two places from one component: full-screen in a second browser
 * window (for the projector) and embedded inside the pillar's Live Chat tab.
 * The security console and the demo drawer are the operator's surfaces; the
 * chat itself is meant to read as a real government service, because the
 * attacks only land emotionally if the thing being attacked looks real.
 */

// ─── Header ───────────────────────────────────────────────────────────────────

function LangToggle({ theme }) {
  const { lang, setLang } = useMohLang()
  return (
    <div
      style={{
        display: 'flex', borderRadius: 999, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.10)',
      }}
    >
      {[['he', 'עב'], ['en', 'EN']].map(([code, label]) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          style={{
            padding: '3px 11px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
            background: lang === code ? 'rgba(255,255,255,0.95)' : 'transparent',
            color: lang === code ? '#0d9488' : 'rgba(255,255,255,0.85)',
            fontFamily: 'Heebo, Inter, sans-serif',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function ModelMenu({ models, value, onChange, theme, isLight }) {
  const { t } = useMohLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const current = models.find((m) => m.id === value)
  // `leaky` is not a health status — it flags the model kept in the list
  // precisely because it fails, for the unprotected half of the demo.
  const dot = { verified: '#10b981', leaky: '#a855f7', intermittent: '#f59e0b', untested: '#64748b', unavailable: '#ef4444' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.10)',
          color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'Heebo, Inter, sans-serif',
        }}
        title={t('demo.model')}
      >
        <span
          style={{
            width: 6, height: 6, borderRadius: 999,
            background: dot[current?.status] || '#64748b', flexShrink: 0,
          }}
        />
        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.displayName || t('common.loading')}
        </span>
        <ChevronDown size={12} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', insetInlineEnd: 0, zIndex: 60,
              width: 320, borderRadius: 12, overflow: 'hidden', ...mohPopover(isLight),
            }}
          >
            {models.map((m) => {
              const disabled = m.status === 'unavailable'
              return (
                <button
                  key={m.id}
                  disabled={disabled}
                  onClick={() => { onChange(m.id); setOpen(false) }}
                  onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = isLight ? 'rgba(13,148,136,0.07)' : 'rgba(255,255,255,0.07)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px',
                    background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'start', opacity: disabled ? 0.45 : 1, color: 'inherit',
                    borderBottom: `1px solid ${isLight ? 'rgba(13,148,136,0.08)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: dot[m.status], marginTop: 5, flexShrink: 0 }} />
                  {/* Model names and notes come from the server in English.
                      Without dir="auto" they inherit RTL and the punctuation
                      jumps to the wrong end of the line. */}
                  <span style={{ flex: 1, minWidth: 0 }} dir="auto">
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>{m.displayName}</span>
                    <span style={{ display: 'block', fontSize: 10, opacity: 0.65, lineHeight: 1.35, marginTop: 2 }}>
                      {m.note}
                    </span>
                  </span>
                  {m.id === value && <ShieldCheck size={13} style={{ marginTop: 3, flexShrink: 0 }} />}
                </button>
              )
            })}

            {/* Dot legend — the colours mean nothing to anyone who did not
                pick them, and 'leaky' in particular is deliberate, not broken. */}
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', gap: 9, padding: '8px 12px',
                fontSize: 9, opacity: 0.75,
              }}
            >
              {[
                ['#10b981', t('demo.legendVerified')],
                ['#a855f7', t('demo.legendLeaky')],
                ['#f59e0b', t('demo.legendIntermittent')],
                ['#ef4444', t('demo.legendUnavailable')],
              ].map(([c, label]) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Header({ theme, isLight, protectionOn, onToggleProtection, models, model, setModel, onOpenConsole, onOpenDrawer, health, embedded, canCompareLanes }) {
  const { t } = useMohLang()
  // Only go red when there is genuinely an unprotected lane being used. Under
  // a workspace-enforced guardrail the switch is a status badge and traffic is
  // scanned regardless, so colouring the app red there would be a lie.
  const unprotected = canCompareLanes && !protectionOn
  return (
    <header
      style={{
        background: unprotected ? theme.headerBgUnprotected : theme.headerBg,
        color: theme.headerText, flexShrink: 0,
        padding: embedded ? '10px 16px' : '14px 22px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: unprotected ? theme.headerShadowUnprotected : theme.headerShadow,
        transition: 'background 260ms ease, box-shadow 260ms ease',
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: embedded ? 30 : 38, height: embedded ? 30 : 38, borderRadius: 11,
            background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <HeartPulse size={embedded ? 17 : 21} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: embedded ? 15 : 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {t('app.name')}
            </span>
            <span
              style={{
                fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,0.20)', letterSpacing: '0.08em', whiteSpace: 'nowrap',
              }}
            >
              {t('app.demoBadge')}
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: theme.headerSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t('app.tagline')} · {t('app.ministry')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Protection state.
          When the workspace applies the AIRS guardrail to every request there
          is no unprotected lane to switch to, so this renders as a status
          badge rather than a toggle — a switch that visibly does nothing is
          worse on stage than no switch at all. */}
      {canCompareLanes ? (
        <button
          onClick={onToggleProtection}
          title={protectionOn ? t('protection.toggleOff') : t('protection.toggleOn')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999,
            // The red-on-red case needs an inset fill rather than the previous
            // translucent red, which vanished once the header itself went red.
            border: `1px solid ${protectionOn ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.55)'}`,
            background: protectionOn ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.26)',
            color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Heebo, Inter, sans-serif', whiteSpace: 'nowrap',
            transition: 'background 260ms ease, border-color 260ms ease',
          }}
        >
          {protectionOn ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
          <span>{protectionOn ? t('protection.on') : t('protection.off')}</span>
          {protectionOn && (
            <motion.span
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: 999, background: '#5eead4' }}
            />
          )}
        </button>
      ) : (
        <div
          title={t('protection.workspaceHint')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.16)',
            color: '#fff', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'help',
          }}
        >
          <ShieldCheck size={14} />
          <span>{t('protection.on')}</span>
          <span style={{ fontSize: 9, opacity: 0.72, fontWeight: 500 }}>
            · {t('protection.workspaceEnforced')}
          </span>
          <motion.span
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 6, height: 6, borderRadius: 999, background: '#5eead4' }}
          />
        </div>
      )}

      <ModelMenu models={models} value={model} onChange={setModel} theme={theme} isLight={isLight} />
      <LangToggle theme={theme} />

      <HeaderAction icon={Activity} label={t('console.short')} title={t('console.open')} onClick={onOpenConsole} />
      <HeaderAction icon={Sliders} label={t('demo.short')} title={t('demo.open')} onClick={onOpenDrawer} />
    </header>
  )
}

/**
 * Header button with a visible caption.
 *
 * These two open the operator surfaces, and a bare icon means only the person
 * who built the demo knows what they do — the title attribute is no help to
 * someone watching over a shoulder.
 */
function HeaderAction({ icon: Icon, label, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '4px 10px', borderRadius: 9, flexShrink: 0, cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.10)',
        color: '#fff', fontFamily: 'Heebo, Inter, sans-serif',
      }}
    >
      <Icon size={15} />
      <span style={{ fontSize: 8.5, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

// ─── Messages ─────────────────────────────────────────────────────────────────

const UserBubble = React.memo(function UserBubble({ msg, theme }) {
  const { pick } = useMohLang()
  const dir = isHebrewText(msg.content) ? 'rtl' : 'ltr'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
    >
      {msg.attackMeta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 9, color: theme.textFaint }}>{msg.attackMeta.technique}</span>
          <span
            style={{
              fontSize: 8.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
              background: `${MOH_SEVERITY_COLORS[msg.attackMeta.severity]}22`,
              color: MOH_SEVERITY_COLORS[msg.attackMeta.severity],
              border: `1px solid ${MOH_SEVERITY_COLORS[msg.attackMeta.severity]}55`,
            }}
          >
            {msg.attackMeta.owasp && msg.attackMeta.owasp !== '—' ? msg.attackMeta.owasp : pick(msg.attackMeta.label)}
          </span>
        </div>
      )}
      {/* Attached document. The extracted text is deliberately NOT shown here
          — the citizen attached a file, they did not type six thousand
          characters of lab report. The model still receives the full text as
          its own turn; this is just the artifact card, like any real chat app. */}
      {msg.attachment && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12,
            background: theme.userBubble, boxShadow: theme.shadowSm, maxWidth: '78%',
          }}
        >
          <FileText size={15} color="#fff" style={{ flexShrink: 0, opacity: 0.9 }} />
          <div style={{ minWidth: 0 }}>
            <div dir="ltr" style={{ fontSize: 12, fontWeight: 700, color: theme.userText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
              {msg.attachment.name}
            </div>
            <div dir="ltr" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
              {[
                msg.attachment.kind?.toUpperCase(),
                msg.attachment.pages ? `${msg.attachment.pages} pages` : null,
                msg.attachment.chars ? `${msg.attachment.chars.toLocaleString()} chars` : null,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          <ShieldCheck size={13} color="#5eead4" style={{ flexShrink: 0, marginInlineStart: 4 }} />
        </div>
      )}

      {msg.content && (
      <div
        dir={dir}
        style={{
          maxWidth: '78%', padding: '10px 14px', borderRadius: 16,
          background: theme.userBubble, color: theme.userText,
          fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          boxShadow: theme.shadowSm, fontFamily: 'Heebo, Inter, sans-serif',
        }}
      >
        {msg.content}
      </div>
      )}
    </motion.div>
  )
})

function CitationCards({ docs, theme }) {
  const { t, lang } = useMohLang()
  if (!docs?.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      <span style={{ fontSize: 9.5, fontWeight: 800, color: theme.textFaint, letterSpacing: '0.06em' }}>
        {t('rag.sources')} ({docs.length})
      </span>
      {docs.map((d) => {
        const poisoned = d.risk !== 'benign'
        const c = MOH_RISK_COLORS[d.risk] || theme.textFaint
        return (
          <div
            key={d.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 11px', borderRadius: 10,
              background: poisoned ? `${c}0f` : theme.surfaceMuted,
              border: `1px solid ${poisoned ? `${c}44` : theme.border}`,
            }}
          >
            <FileText size={13} color={c} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: theme.text, lineHeight: 1.4 }}>
                {lang === 'he' ? d.title_he : d.title_en}
              </div>
              {lang === 'en' && d.gloss_en && (
                <div style={{ fontSize: 10, color: theme.textFaint, marginTop: 2 }}>{d.gloss_en}</div>
              )}
            </div>
            <span
              style={{
                fontSize: 8.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                background: `${c}22`, color: c, border: `1px solid ${c}55`,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t(`rag.risk.${d.risk}`)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function BlockedCard({ msg, theme }) {
  const { t } = useMohLang()
  const [open, setOpen] = useState(false)
  // Show the scan that actually blocked, not merely the first one present.
  // An agent turn now carries a gateway scan AND up to two tool scans, so
  // `inputScan || outputScan` would happily print the *allowing* gateway
  // verdict — category "benign" — next to a blocked card.
  const { blockStage: stage } = msg.metadata
  const scan =
    stage === 1 ? msg.metadata.stage1
    : stage === 2 ? msg.metadata.stage2
    : stage === 'prompt' ? msg.metadata.inputScan
    : msg.metadata.outputScan || msg.metadata.inputScan
  const isOutput = stage === 'downstream' || stage === 'output' || stage === 2
  // 'input'/'output' come from the streaming chat, 1/2/'prompt'/'narration'
  // from the agent route. Both reach this card, so both have to be mapped or
  // the label silently disappears on ordinary chat blocks.
  const pointKey =
    stage === 'prompt' || stage === 'input' ? 'prompt'
    : stage === 1 ? 'params'
    : stage === 2 ? 'output'
    : stage === 'narration' ? 'answer'
    : stage === 'output' || stage === 'downstream' ? 'answer'
    : null

  return (
    <div
      style={{
        borderRadius: 14, border: `1px solid ${theme.blockedBorder}`, background: theme.blockedBg,
        padding: '13px 15px', maxWidth: '92%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <ShieldCheck size={17} color={theme.blocked} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: theme.blocked }}>{t('blocked.title')}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: theme.text }}>
        {isOutput ? t('blocked.bodyOutput') : t('blocked.body')}
      </p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 9, fontSize: 10.5, color: theme.textMuted }}>
        {pointKey && (
          <span>
            <b>{t('blocked.stage')}:</b>{' '}
            <span style={{ color: theme.blocked, fontWeight: 700 }}>{t(`blocked.points.${pointKey}`)}</span>
          </span>
        )}
        {scan?.category && <span><b>{t('blocked.category')}:</b> {scan.category}</span>}
        {scan?.scan_id && (
          <span dir="ltr"><b>{t('blocked.scanId')}:</b> <code style={{ fontSize: 10 }}>{scan.scan_id}</code></span>
        )}
        {msg.metadata.latencyMs != null && <span>{msg.metadata.latencyMs} {t('common.ms')}</span>}
      </div>

      {scan && <DetectionBadges detected={scan.prompt_detected || scan.response_detected} />}

      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          marginTop: 9, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 10.5, color: theme.blocked, fontWeight: 700, fontFamily: 'Heebo, Inter, sans-serif',
        }}
      >
        {open ? t('blocked.hideDetails') : t('blocked.showDetails')}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {msg.metadata.inputScan && (
                <ScanStageCard stage="1" label={t('console.stage1')} data={msg.metadata.inputScan} theme={theme} />
              )}
              {msg.metadata.outputScan && (
                <ScanStageCard stage="2" label={t('console.stage2')} data={msg.metadata.outputScan} theme={theme} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ToolCallCard({ metadata, theme }) {
  const { t } = useMohLang()
  if (!metadata.tool) return null
  return (
    <div
      style={{
        borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surfaceMuted,
        padding: '10px 13px', marginTop: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <Wrench size={13} color={theme.accent} />
        <code style={{ fontSize: 11.5, fontWeight: 700, color: theme.accent, direction: 'ltr' }}>
          {metadata.tool}
        </code>
      </div>
      <pre
        dir="ltr"
        style={{
          margin: 0, fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', color: theme.textMuted,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', textAlign: 'left',
        }}
      >
        {JSON.stringify(metadata.params, null, 2)}
      </pre>
      {metadata.blockStage === 2 && (
        <div style={{ marginTop: 7, fontSize: 10.5, color: theme.blocked, fontWeight: 600 }}>
          {t('agent.suppressed')}
        </div>
      )}
    </div>
  )
}

function AssistantBubble({ msg, theme }) {
  const { t } = useMohLang()
  const m = msg.metadata || {}
  const streaming = msg.status === 'streaming'
  const dir = isHebrewText(msg.content) ? 'rtl' : 'ltr'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, maxWidth: '88%' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 22, height: 22, borderRadius: 7, background: `${theme.accent}1f`,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <HeartPulse size={12} color={theme.accent} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>{t('chat.assistant')}</span>
        {msg.status === 'blocked' && <VerdictPill status="blocked" theme={theme} size="sm" />}
        {msg.status === 'flagged' && <VerdictPill status="flagged" theme={theme} size="sm" />}
        {m.replayed && (
          <span style={{ fontSize: 9, color: theme.flagged, fontWeight: 700 }}>{t('console.replayed')}</span>
        )}
      </div>

      {msg.status === 'blocked' ? (
        <BlockedCard msg={msg} theme={theme} />
      ) : (
        <div
          dir={dir}
          style={{
            padding: '11px 15px', borderRadius: 16,
            background: msg.status === 'error' ? theme.flaggedBg : theme.asstBubble,
            border: `1px solid ${msg.status === 'error' ? theme.flaggedBorder : theme.asstBorder}`,
            color: theme.text, fontSize: 13.5, lineHeight: 1.72,
            wordBreak: 'break-word',
            boxShadow: theme.shadowSm, fontFamily: 'Heebo, Inter, sans-serif', minWidth: 60,
          }}
        >
          {msg.content
            ? <MarkdownLite text={msg.content} theme={theme} />
            : streaming ? <TypingDots color={theme.textFaint} /> : '—'}
        </div>
      )}

      {msg.status === 'flagged' && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 11px', borderRadius: 10,
            background: theme.flaggedBg, border: `1px solid ${theme.flaggedBorder}`, maxWidth: '100%',
          }}
        >
          <AlertTriangle size={13} color={theme.flagged} style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: theme.text, lineHeight: 1.5 }}>
            {t('banner.flaggedNote')}
          </span>
        </div>
      )}

      <ToolCallCard metadata={m} theme={theme} />
      <CitationCards docs={m.citations} theme={theme} />

      {(m.latencyMs != null || m.tokens > 0) && (
        <div style={{ display: 'flex', gap: 10, fontSize: 9.5, color: theme.textFaint, paddingInlineStart: 4 }}>
          {m.latencyMs != null && <span>{m.latencyMs} {t('common.ms')}</span>}
          {m.tokens > 0 && <span dir="ltr">{m.tokens} tok</span>}
          {m.laneMode === 'workspace-default' && <span>monitor mode</span>}
        </div>
      )}
    </motion.div>
  )
}

/**
 * Minimal markdown renderer — bold, headings, bullets and numbered lists.
 *
 * Claude replies in markdown and the raw `**` markers looked like a bug on the
 * projector. A full markdown library is overkill for four constructs, and
 * dangerouslySetInnerHTML on model output is exactly the sink this demo is
 * about, so this builds React nodes and never parses HTML.
 */
const MarkdownLite = React.memo(function MarkdownLite({ text, theme }) {
  const lines = String(text || '').split('\n')

  const inline = (s, keyBase) => {
    // Split on **bold** and `code`, keeping the delimiters' content.
    const parts = String(s).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
    return parts.map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return <strong key={`${keyBase}-${i}`} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      }
      if (/^`[^`]+`$/.test(part)) {
        return (
          <code
            key={`${keyBase}-${i}`}
            dir="ltr"
            style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9em',
              background: theme.surfaceMuted, padding: '1px 5px', borderRadius: 4,
            }}
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      return <React.Fragment key={`${keyBase}-${i}`}>{part}</React.Fragment>
    })
  }

  const out = []
  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (!line.trim()) { out.push(<div key={`sp-${i}`} style={{ height: 7 }} />); return }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      out.push(
        <div key={`h-${i}`} style={{ fontWeight: 800, fontSize: heading[1].length <= 2 ? '1.06em' : '1em', margin: '7px 0 3px' }}>
          {inline(heading[2], `h${i}`)}
        </div>
      )
      return
    }

    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/)
    if (bullet || numbered) {
      out.push(
        <div key={`li-${i}`} style={{ display: 'flex', gap: 8, margin: '2px 0' }}>
          <span style={{ color: theme.accent, flexShrink: 0, fontWeight: 700 }}>
            {numbered ? `${numbered[1]}.` : '•'}
          </span>
          <span style={{ flex: 1 }}>{inline(bullet ? bullet[1] : numbered[2], `li${i}`)}</span>
        </div>
      )
      return
    }

    out.push(<div key={`p-${i}`}>{inline(line, `p${i}`)}</div>)
  })

  return <>{out}</>
})

function TypingDots({ color }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 18 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
          style={{ width: 6, height: 6, borderRadius: 999, background: color }}
        />
      ))}
    </span>
  )
}

// ─── Composer ─────────────────────────────────────────────────────────────────

/**
 * Attachment chip — the citizen's uploaded document and its AIRS verdict.
 *
 * A blocked file stays visible rather than vanishing: the point of the beat is
 * that the operator can show what was in the document and which detector
 * caught it, so it has to remain on screen until dismissed.
 */
function AttachChip({ file, theme, onRemove }) {
  const { t } = useMohLang()
  const bad = file.status === 'blocked'
  const err = file.status === 'error'
  const pending = file.status === 'scanning'
  const unscanned = file.status === 'unscanned'
  const c = bad || err ? theme.blocked : pending || unscanned ? theme.flagged : theme.allowed
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 5, padding: '7px 10px', borderRadius: 10,
        background: bad || err ? theme.blockedBg : pending || unscanned ? theme.flaggedBg : theme.allowedBg,
        border: `1px solid ${bad || err ? theme.blockedBorder : pending || unscanned ? theme.flaggedBorder : theme.allowedBorder}`,
        maxWidth: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {pending ? <RefreshCw size={13} color={c} className="animate-spin" />
          : bad || err ? <ShieldOff size={13} color={c} /> : <ShieldCheck size={13} color={c} />}
        <span dir="ltr" style={{ fontSize: 11, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
          {file.name}
        </span>
        <span dir="auto" style={{ fontSize: 10, color: c, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {pending ? t('upload.scanning')
            : bad ? t('upload.blocked')
            : err ? t('upload.failed')
            : unscanned ? `▲ ${t('upload.unscanned')}`
            : t('upload.clean')}
        </span>
        {file.detected?.length > 0 && (
          <span dir="ltr" style={{ fontSize: 9.5, color: theme.textMuted }}>{file.detected.join(' · ')}</span>
        )}
        <button
          onClick={onRemove}
          title={t('upload.remove')}
          style={{ marginInlineStart: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.textFaint, display: 'grid', placeItems: 'center' }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Evidence row. Every other surface in this pillar prints the scan_id;
          without it here an upload verdict cannot be looked up in SCM mid-demo.
          The SCM link carries the MOH tenant, which is NOT the one hardcoded in
          useAttackSimulator.js. */}
      {file.scanId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingInlineStart: 21 }}>
          <code dir="ltr" style={{ fontSize: 9.5, color: theme.textFaint }}>scan_id: {file.scanId}</code>
          <CopyButton text={file.scanId} accent={theme.accent} />
          {file.scmUrl && (
            <a
              href={file.scmUrl}
              target="_blank"
              rel="noreferrer"
              dir="auto"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: theme.accent, textDecoration: 'none' }}
            >
              <ExternalLink size={10} /> {t('upload.viewInScm')}
            </a>
          )}
        </div>
      )}

      {(file.truncated || file.scanIncomplete) && (
        <div dir="auto" style={{ fontSize: 9.5, color: theme.flagged, paddingInlineStart: 21 }}>
          ▲ {file.scanIncomplete ? t('upload.incomplete') : t('upload.truncated').replace('{n}', file.chars)}
        </div>
      )}
    </div>
  )
}

function Composer({ theme, onSend, busy, onClear, attachment, onPickFile, onRemoveFile, uploadBusy }) {
  const { t, dir } = useMohLang()
  const [text, setText] = useState('')
  const taRef = useRef(null)
  const fileRef = useRef(null)
  const chips = t('chat.chips') || []
  // A blocked or still-scanning document must not ride along with the message.
  const canSendFile = attachment?.status === 'clean' || attachment?.status === 'unscanned'

  const submit = (value) => {
    const v = (value ?? text).trim()
    if (!v || busy) return
    onSend(v, canSendFile ? attachment : null)
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  return (
    <div style={{ flexShrink: 0, padding: '10px 18px 14px', background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 9 }}>
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => submit(c)}
            disabled={busy}
            style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 11.5, cursor: busy ? 'default' : 'pointer',
              background: theme.surfaceMuted, border: `1px solid ${theme.border}`, color: theme.textMuted,
              fontFamily: 'Heebo, Inter, sans-serif', opacity: busy ? 0.5 : 1,
            }}
          >
            {c}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          onClick={onClear}
          title={t('chat.clear')}
          style={{
            padding: '5px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textFaint,
            display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Heebo, Inter, sans-serif',
          }}
        >
          <Trash2 size={11} /> {t('chat.clear')}
        </button>
      </div>

      {attachment && (
        <div style={{ marginBottom: 8 }}>
          <AttachChip file={attachment} theme={theme} onRemove={onRemoveFile} />
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); submit() }}
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 9, padding: '8px 10px', borderRadius: 14,
          background: theme.surfaceMuted, border: `1px solid ${theme.borderStrong}`,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pdf,.docx,.csv,.txt,.md,.json,.tsv,.log,.rtf,.xml,.yaml,.yml"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPickFile(f)
            e.target.value = '' // let the same file be picked again after a block
          }}
        />
        {/* Tinted rather than a bare grey outline: the attach affordance is a
            headline capability of this demo (AIRS scans the file before the
            model sees it) and a muted paperclip read as decoration. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || uploadBusy}
          title={t('upload.attach')}
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            border: `1px solid ${busy || uploadBusy ? theme.border : `${theme.accent}55`}`,
            background: busy || uploadBusy ? 'transparent' : `${theme.accent}16`,
            color: busy || uploadBusy ? theme.textFaint : theme.accent,
            cursor: busy || uploadBusy ? 'default' : 'pointer', display: 'grid', placeItems: 'center',
            transition: 'background 120ms, border-color 120ms',
          }}
          onMouseEnter={(e) => {
            if (busy || uploadBusy) return
            e.currentTarget.style.background = `${theme.accent}2e`
            e.currentTarget.style.borderColor = `${theme.accent}88`
          }}
          onMouseLeave={(e) => {
            if (busy || uploadBusy) return
            e.currentTarget.style.background = `${theme.accent}16`
            e.currentTarget.style.borderColor = `${theme.accent}55`
          }}
        >
          <Paperclip size={16} strokeWidth={2.4} />
        </button>
        <textarea
          ref={taRef}
          value={text}
          dir={dir}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 132) + 'px'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
          }}
          rows={1}
          placeholder={t('chat.placeholder')}
          style={{
            flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none',
            color: theme.text, fontSize: 13.5, lineHeight: 1.55, maxHeight: 132,
            fontFamily: 'Heebo, Inter, sans-serif',
          }}
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          style={{
            width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0,
            background: busy || !text.trim() ? theme.border : theme.accent,
            color: '#fff', cursor: busy || !text.trim() ? 'default' : 'pointer',
            display: 'grid', placeItems: 'center',
          }}
          title={t('chat.send')}
        >
          <Send size={15} style={{ transform: dir === 'rtl' ? 'scaleX(-1)' : 'none' }} />
        </button>
      </form>

      <p style={{ margin: '8px 2px 0', fontSize: 10, color: theme.textFaint, lineHeight: 1.5 }}>
        {t('chat.disclaimer')}
      </p>
    </div>
  )
}

// ─── Slide-in panels ──────────────────────────────────────────────────────────

function SlideOver({ open, onClose, title, theme, children, width = 420 }) {
  const { dir } = useMohLang()
  const side = dir === 'rtl' ? { left: 0 } : { right: 0 }
  const from = dir === 'rtl' ? -width : width
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(2,10,18,0.35)', zIndex: 40 }}
          />
          <motion.aside
            initial={{ x: from }} animate={{ x: 0 }} exit={{ x: from }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            style={{
              position: 'absolute', top: 0, bottom: 0, ...side, width, zIndex: 50,
              background: theme.surface, borderInlineStart: `1px solid ${theme.border}`,
              boxShadow: theme.shadow, display: 'flex', flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', flexShrink: 0,
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: theme.text, flex: 1 }}>{title}</span>
              <button
                onClick={onClose}
                style={{
                  width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center',
                  border: `1px solid ${theme.border}`, background: 'transparent',
                  color: theme.textMuted, cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function SecurityConsole({ open, onClose, msg, theme }) {
  const { t } = useMohLang()
  const m = msg?.metadata || {}
  const scmUrl = `https://stratacloudmanager.paloaltonetworks.com/ai-security/runtime/ai-sessions?tsg_id=1698236796`

  const payloadStages = [
    m.stage1?.requestBody && { label: t('console.toolStage1'), body: m.stage1.requestBody, latency: m.stage1.latencyMs },
    m.stage2?.requestBody && { label: t('console.toolStage2'), body: m.stage2.requestBody, latency: m.stage2.latencyMs },
    m.hookResults && { label: t('console.gatewayScan'), body: m.hookResults, latency: null },
  ].filter(Boolean)

  return (
    <SlideOver open={open} onClose={onClose} title={t('console.title')} theme={theme} width={440}>
      {!msg ? (
        <p style={{ fontSize: 12, color: theme.textMuted }}>{t('console.noRun')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <VerdictPill status={msg.status === 'error' ? 'direct' : msg.status} theme={theme} />
            {m.latencyMs != null && (
              <span style={{ fontSize: 11, color: theme.textMuted }}>{m.latencyMs} {t('common.ms')}</span>
            )}
          </div>

          <Row label={t('console.model')} value={m.model} theme={theme} mono />
          <Row label={t('console.profile')} value={m.inputScan?.profile_name || m.stage1?.profile_name} theme={theme} />

          {m.inputScan && <ScanStageCard stage="1" label={t('console.stage1')} data={m.inputScan} theme={theme} />}
          {m.outputScan && <ScanStageCard stage="2" label={t('console.stage2')} data={m.outputScan} theme={theme} />}
          {m.stage1 && <ScanStageCard stage="T1" label={t('console.toolStage1')} data={m.stage1} theme={theme} />}
          {m.stage2 && <ScanStageCard stage="T2" label={t('console.toolStage2')} data={m.stage2} theme={theme} />}

          <AirsPayloadViewer stages={payloadStages} theme={theme} />

          <a
            href={scmUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
              background: `${theme.accent}18`, border: `1px solid ${theme.accent}55`,
              color: theme.accent, fontSize: 11.5, fontWeight: 700,
            }}
          >
            <Sparkles size={13} /> {t('console.viewInScm')}
          </a>
        </div>
      )}
    </SlideOver>
  )
}

function Row({ label, value, theme, mono }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
      <span style={{ color: theme.textFaint, minWidth: 88 }}>{label}</span>
      <span
        dir={mono ? 'ltr' : undefined}
        style={{ color: theme.text, fontFamily: mono ? 'JetBrains Mono, monospace' : undefined, wordBreak: 'break-all' }}
      >
        {value}
      </span>
    </div>
  )
}

function DemoDrawer({ open, onClose, theme, onRun, busy, protectionOn, onToggleProtection, onReset, canCompareLanes }) {
  const { t, pick, lang } = useMohLang()
  // All groups collapsed on open — with five families the drawer was a wall
  // of scenarios, and the operator usually knows which beat they are running.
  const [openFamily, setOpenFamily] = useState(null)
  // With a workspace-wide guardrail this switch no longer gates chat traffic —
  // it only gates the direct tool_event scans. Say so rather than implying more.
  const toggleLabel = canCompareLanes ? t('protection.label') : t('protection.toolScanLabel')

  return (
    <SlideOver open={open} onClose={onClose} title={t('demo.title')} theme={theme} width={460}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={onToggleProtection}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 10, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            background: protectionOn ? theme.allowedBg : theme.blockedBg,
            border: `1px solid ${protectionOn ? theme.allowedBorder : theme.blockedBorder}`,
            color: protectionOn ? theme.allowed : theme.blocked,
            fontFamily: 'Heebo, Inter, sans-serif',
          }}
        >
          {toggleLabel}: {protectionOn ? t('common.on') : t('common.off')}
        </button>
        <button
          onClick={onReset}
          title={t('demo.reset')}
          style={{
            padding: '8px 11px', borderRadius: 10, cursor: 'pointer', background: 'transparent',
            border: `1px solid ${theme.border}`, color: theme.textMuted,
          }}
        >
          <RotateCcw size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {MOH_ATTACKS_BY_FAMILY.map((fam) => {
          const isOpen = openFamily === fam.id
          return (
            <div key={fam.id} style={{ borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenFamily(isOpen ? null : fam.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px',
                  background: isOpen ? `${fam.color}12` : theme.surfaceMuted, border: 'none',
                  cursor: 'pointer', textAlign: 'start', color: theme.text,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: fam.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{pick(fam.label)}</span>
                <span style={{ fontSize: 10, color: theme.textFaint }}>{fam.attacks.length}</span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
                  <ChevronDown size={13} color={theme.textMuted} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p style={{ margin: 0, padding: '9px 12px', fontSize: 10.5, lineHeight: 1.6, color: theme.textMuted, borderTop: `1px solid ${theme.border}` }}>
                      {pick(fam.intro)}
                    </p>
                    {fam.attacks.map((a) => (
                      <button
                        key={a.id}
                        disabled={busy}
                        onClick={() => onRun(a)}
                        style={{
                          width: '100%', display: 'flex', flexDirection: 'column', gap: 3, padding: '9px 12px',
                          background: 'transparent', border: 'none', borderTop: `1px solid ${theme.border}`,
                          cursor: busy ? 'default' : 'pointer', textAlign: 'start', opacity: busy ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = `${fam.color}0d` }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: theme.text, flex: 1 }}>
                            {pick(a.label)}
                          </span>
                          {/* Measured to block on repeated runs — tells the
                              operator which scenarios are safe to promise. */}
                          {a.verified && (
                            <span title={t('demo.verifiedHint')} style={{ fontSize: 10, color: '#10b981', fontWeight: 800 }}>✓</span>
                          )}
                          <span
                            style={{
                              fontSize: 8.5, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                              background: `${MOH_SEVERITY_COLORS[a.severity]}22`,
                              color: MOH_SEVERITY_COLORS[a.severity], whiteSpace: 'nowrap',
                            }}
                          >
                            {t(`demo.severity.${a.severity}`)}
                          </span>
                        </span>
                        <span style={{ fontSize: 9.5, color: theme.textFaint }}>
                          {a.technique}{a.owasp && a.owasp !== '—' ? ` · ${a.owasp}` : ''}
                        </span>
                        {a.expect?.length > 0 && (
                          <span style={{ fontSize: 9, color: theme.textFaint }}>
                            {t('demo.expected')}: {a.expect.map((e) => MOH_DETECTORS[e]?.[lang] ?? e).join(', ')}
                          </span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </SlideOver>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function BriutAppInner({ embedded = false }) {
  const { state } = useAppContext()
  const isLight = !state.isDark
  const theme = useMemo(() => mohTheme(isLight), [isLight])
  const { t, lang, dir, setLang } = useMohLang()

  const [protectionOn, setProtectionOn] = useState(true)
  const [models, setModels] = useState([])
  const [model, setModel] = useState(null)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [health, setHealth] = useState(null)

  const { messages, busy, send, runScenario, clear } = useMohChat()
  const scrollRef = useRef(null)

  useEffect(() => {
    fetch('/api/moh/models').then((r) => r.json()).then((d) => {
      setModels(d.models || [])
      setModel((cur) => cur || d.default)
    }).catch(() => {})
    fetch('/api/moh/health').then((r) => r.json()).then(setHealth).catch(() => {})
  }, [])

  // Auto-scroll.
  //
  // Stickiness has to be recorded from real scroll events, not measured after
  // the render. Checking `scrollHeight - scrollTop - clientHeight` inside the
  // effect reads the geometry *after* React appended the new content, so any
  // tall message — a blocked card, a long answer — instantly looks "far from
  // the bottom" and the scroll is skipped. That is why the last response was
  // being left off-screen.
  //
  // Instead: a scroll listener keeps the flag current, so it reflects where the
  // user was before the content grew. Scrolling up to read turns it off;
  // returning to the bottom, or starting a new turn, turns it back on.
  const stickRef = useRef(true)

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !stickRef.current) return
    // Instant while streaming — 'smooth' would queue an animation per flush.
    el.scrollTo({ top: el.scrollHeight, behavior: busy ? 'auto' : 'smooth' })
  }, [messages, busy])

  const runAttack = useCallback(
    (attack) => {
      setDrawerOpen(false)
      stickRef.current = true
      runScenario(attack, { model, lang, airsEnabled: protectionOn })
    },
    [runScenario, model, lang, protectionOn]
  )

  // ── File upload ──
  // The document is scanned by AIRS before it can become chat context. Only a
  // clean file keeps its text; a blocked one is returned without `text` by the
  // server, so there is nothing to attach even if the UI were bypassed.
  const [attachment, setAttachment] = useState(null)
  const [uploadBusy, setUploadBusy] = useState(false)

  const uploadFile = useCallback(
    async (file) => {
      setUploadBusy(true)
      setAttachment({ name: file.name, status: 'scanning', detected: [] })
      try {
        const buf = await file.arrayBuffer()
        // Chunked base64 — String.fromCharCode(...bytes) blows the argument
        // limit and throws on anything more than a few hundred KB.
        const bytes = new Uint8Array(buf)
        let bin = ''
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
        }
        const resp = await fetch('/api/moh/upload/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name, dataBase64: btoa(bin),
            airsEnabled: protectionOn, lang,
          }),
        })
        const d = await resp.json()
        setAttachment({
          name: d.name || file.name,
          // With protection off nothing was scanned; saying "clean" would be
          // a lie in exactly the lane built to show what happens without AIRS.
          status: d.error ? 'error' : d.blocked ? 'blocked' : d.airsEnabled === false ? 'unscanned' : 'clean',
          detected: d.detected || [],
          text: d.text || null,
          error: d.error || null,
          kind: d.kind, pages: d.pages, chars: d.chars, totalChars: d.totalChars,
          truncated: !!d.truncated, scanIncomplete: !!d.scanIncomplete,
          blockReason: d.blockReason || null, blockedChunk: d.blockedChunk || null,
          scanId: d.scanId || null, scmUrl: d.scmUrl || null,
          scans: d.scans || [], latencyMs: d.latencyMs,
        })
      } catch (e) {
        setAttachment({ name: file.name, status: 'error', detected: [], error: String(e?.message || e) })
      } finally {
        setUploadBusy(false)
      }
    },
    [protectionOn, lang]
  )

  // Cross-window: the portal tab can drive this one.
  useEffect(() => {
    publish(MOH_EVENTS.HELLO, { embedded })
    return subscribe((type, payload) => {
      if (type === MOH_EVENTS.FIRE && payload.attack) runAttack(payload.attack)
      else if (type === MOH_EVENTS.SET_PROTECTION) setProtectionOn(!!payload.on)
      else if (type === MOH_EVENTS.SET_LANG && payload.lang) setLang(payload.lang)
      else if (type === MOH_EVENTS.SET_MODEL && payload.model) setModel(payload.model)
      else if (type === MOH_EVENTS.CLEAR) clear()
    })
  }, [runAttack, setLang, clear, embedded])

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.status !== 'streaming')
  useEffect(() => {
    if (lastAssistant) publish(MOH_EVENTS.RESULT, { id: lastAssistant.id, status: lastAssistant.status, metadata: lastAssistant.metadata })
  }, [lastAssistant?.id, lastAssistant?.status])

  const onReset = () => {
    fetch('/api/moh/reset', { method: 'POST' }).catch(() => {})
    clear()
  }

  return (
    <div
      dir={dir}
      style={{
        position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
        background: theme.pageBg, fontFamily: 'Heebo, Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <Header
        theme={theme} isLight={isLight} embedded={embedded}
        protectionOn={protectionOn}
        onToggleProtection={() => setProtectionOn((p) => !p)}
        models={models} model={model} setModel={setModel}
        onOpenConsole={() => setConsoleOpen(true)}
        onOpenDrawer={() => setDrawerOpen(true)}
        health={health}
        canCompareLanes={!!health?.enforcement?.canCompareLanes}
      />

      {health && health.enforcement?.mode === 'workspace' && (
        <div
          style={{
            flexShrink: 0, padding: '6px 18px', fontSize: 10.5, lineHeight: 1.5,
            background: theme.allowedBg, borderBottom: `1px solid ${theme.allowedBorder}`,
            color: theme.text, display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          <ShieldCheck size={12} color={theme.allowed} style={{ flexShrink: 0 }} />
          <span>{t('banner.workspaceMode')}</span>
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', minHeight: 0 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 20px', textAlign: 'center' }}
            >
              <div
                style={{
                  width: 62, height: 62, borderRadius: 20, background: `${theme.accent}15`,
                  display: 'grid', placeItems: 'center',
                }}
              >
                <HeartPulse size={30} color={theme.accent} />
              </div>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: theme.text }}>{t('app.name')}</h2>
              <p style={{ margin: 0, maxWidth: 460, fontSize: 13.5, lineHeight: 1.7, color: theme.textMuted }}>
                {t('chat.greeting')}
              </p>
            </motion.div>
          )}

          {messages.map((m) =>
            m.role === 'user'
              ? <UserBubble key={m.id} msg={m} theme={theme} />
              : <AssistantBubble key={m.id} msg={m} theme={theme} />
          )}
        </div>
      </div>

      <Composer
        theme={theme}
        busy={busy}
        onClear={clear}
        attachment={attachment}
        uploadBusy={uploadBusy}
        onPickFile={uploadFile}
        onRemoveFile={() => setAttachment(null)}
        onSend={(text, file) => {
          stickRef.current = true
          // The document travels as a separate field, not concatenated into the
          // prompt. The citizen's bubble shows their question plus a file card;
          // the model receives the full text as its own turn. The composed turn
          // still passes the AI-GW guardrail, so the document gets a second
          // look after the upload scan.
          send({
            prompt: text, model, lang, airsEnabled: protectionOn, family: 'runtime',
            document: file ? { name: file.name, text: file.text, kind: file.kind, pages: file.pages, chars: file.chars } : null,
          })
          setAttachment(null)
        }}
      />

      <SecurityConsole open={consoleOpen} onClose={() => setConsoleOpen(false)} msg={lastAssistant} theme={theme} />
      <DemoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        theme={theme}
        busy={busy}
        onRun={runAttack}
        protectionOn={protectionOn}
        onToggleProtection={() => setProtectionOn((p) => !p)}
        onReset={onReset}
        canCompareLanes={!!health?.enforcement?.canCompareLanes}
      />
    </div>
  )
}

/** Embedded inside the pillar (the pillar supplies MohLangProvider). */
export function BriutApp(props) {
  return <BriutAppInner {...props} />
}

/** Full-screen, chrome-free — rendered for /?app=briut. */
export function BriutStandalone() {
  return (
    <MohLangProvider>
      <div style={{ position: 'fixed', inset: 0 }}>
        <BriutAppInner embedded={false} />
      </div>
    </MohLangProvider>
  )
}
