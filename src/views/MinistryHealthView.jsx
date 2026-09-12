import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HeartPulse, MessageSquare, FileText, Wrench, Grid3x3, Scale, ExternalLink,
  Play, RefreshCw, ShieldCheck, ShieldOff, AlertTriangle, CheckCircle2, XCircle, Server, Building2,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { MohLangProvider, useMohLang } from './moh/i18n'
import { mohTheme, MOH_RISK_COLORS } from './moh/theme'
import { BriutApp } from './moh/BriutApp'
import McpTab from './moh/McpTab'
import { openCitizenApp } from './moh/bus'
import { MOH_ATTACKS_BY_FAMILY, MOH_SEVERITY_COLORS, MOH_DETECTORS } from '../data/moh/attacks'
import { ScanStageCard, AirsPayloadViewer, VerdictPill, CopyButton } from './moh/components/ScanPanels'
import { CorpusViewer, CorpusList } from './moh/components/CorpusViewer'
import { useMohChat } from '../hooks/useMohChat'

/**
 * MinistryHealthView — mission control for the MOH RFI demo.
 *
 * Tab shell follows LlmGatewayView: every tab stays mounted behind
 * display:none so switching away never destroys an in-flight scenario or a
 * completed run you are about to talk through on stage.
 */

const ACCENT = '#0ea5e9' // matches the 'sky' nav colour

const TABS = [
  { id: 'overview', icon: HeartPulse, key: 'tabs.overview' },
  { id: 'chat', icon: MessageSquare, key: 'tabs.chat' },
  { id: 'rag', icon: FileText, key: 'tabs.rag' },
  { id: 'agent', icon: Wrench, key: 'tabs.agent' },
  { id: 'mcp', icon: Server, key: 'tabs.mcp' },
  { id: 'matrix', icon: Grid3x3, key: 'tabs.matrix' },
  { id: 'governance', icon: Scale, key: 'tabs.governance' },
]

// ─── Resizable side panels (mandated pattern) ─────────────────────────────────

function ResizeHandle({ onMouseDown, active, theme }) {
  const [hover, setHover] = useState(false)
  const lit = active || hover
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative flex-shrink-0 w-1 cursor-col-resize"
      style={{ background: lit ? `${ACCENT}99` : theme.border }}
    >
      <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 pointer-events-none">
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 2, height: 2, borderRadius: 999, background: lit ? ACCENT : theme.textFaint }} />
        ))}
      </div>
    </div>
  )
}

function useSidePanels(initLeft = 320, initRight = 360) {
  const [leftWidth, setLeftWidth] = useState(initLeft)
  const [rightWidth, setRightWidth] = useState(initRight)
  const [drag, setDrag] = useState(null)
  const dragRef = useRef({ startX: 0, startW: 0 })

  const startDrag = (which) => (e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: which === 'left' ? leftWidth : rightWidth }
    setDrag(which)
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      const { startX, startW } = dragRef.current
      if (drag === 'left') setLeftWidth(Math.min(520, Math.max(240, startW + (e.clientX - startX))))
      else setRightWidth(Math.min(640, Math.max(280, startW - (e.clientX - startX))))
    }
    const onUp = () => setDrag(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag])

  return { leftWidth, rightWidth, drag, startDrag }
}

// ─── Small building blocks ────────────────────────────────────────────────────

function Card({ title, children, theme, accent = ACCENT, icon: Icon }) {
  return (
    <div
      style={{
        borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.surface,
        padding: '16px 18px', boxShadow: theme.shadowSm,
      }}
    >
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {Icon && <Icon size={15} color={accent} />}
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: theme.text }}>{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}

function Stat({ label, value, sub, theme, color, onClick }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        flex: 1, minWidth: 130, borderRadius: 12, border: `1px solid ${onClick ? ACCENT + '55' : theme.border}`,
        background: theme.surfaceMuted, padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 700, color: theme.textFaint, letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: color || theme.text, marginTop: 3, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ─── Status tiles ─────────────────────────────────────────────────────────────
// /api/moh/health no longer pings the model or AIRS on every call, so
// `reachable` is null unless someone asked for it with ?probe=1. Three states,
// and the tile must not claim more than it knows: verified working, configured
// but unverified, or genuinely missing. Treating null as "Down" would paint a
// perfectly healthy demo red.

function statusValue(health, reachable, configured) {
  if (!health) return '…'
  if (reachable === true) return 'Reachable'
  if (reachable === false) return 'Down'
  return configured ? 'Configured' : 'Not set'
}

function statusColor(health, reachable, configured) {
  if (!health) return undefined
  if (reachable === true) return '#10b981'
  if (reachable === false) return '#ef4444'
  return configured ? ACCENT : '#ef4444'
}

// ─── Architecture diagram ─────────────────────────────────────────────────────
// Hand-built SVG in the same visual language as the gateway pillar's
// FlowArchitectureDiagram (OverviewTab.jsx): forced-dark hero panel in both app
// themes, neon bezier connectors, mono labels. Two lanes leave the assistant —
// a model turn through the AI Gateway guardrail, and a tool call through the
// direct AIRS tool_event scans — and both are governed by one AIRS profile.
// Kept dir="ltr" even in Hebrew: the flow reads left-to-right regardless.

function MohArchitectureDiagram() {
  const { t, dir } = useMohLang()
  const textPrimary = '#e2e8f0'
  const textSecondary = '#94a3b8'
  const boxFill = 'rgba(255,255,255,0.05)'
  const boxStroke = 'rgba(255,255,255,0.18)'
  const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'
  const sans = 'Heebo, Inter, ui-sans-serif, system-ui, sans-serif'

  const TEAL = '#14b8a6'   // lane 1 — model turn
  const PURPLE = '#a855f7' // lane 2 — tool call
  const AMBER = '#fbbf24'  // the shared AIRS policy
  const SKY = '#38bdf8'    // health services

  const LANE_A = 86
  const LANE_B = 236

  /** Rounded node with an optional second line. */
  const Node = ({ cx, cy, w, h, label, sub, color, fill, stroke, fontSize = 10.5 }) => (
    <g>
      <rect
        x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={9}
        fill={fill || (color ? color : boxFill)} fillOpacity={color ? 0.12 : 1}
        stroke={stroke || color || boxStroke} strokeOpacity={color ? 0.65 : 1} strokeWidth={1.25}
      />
      <text
        x={cx} y={sub ? cy - 2 : cy + fontSize / 3} textAnchor="middle"
        fontFamily={mono} fontSize={fontSize} fontWeight={700} fill={color || textPrimary}
      >
        {label}
      </text>
      {sub && (
        <text x={cx} y={cy + 12} textAnchor="middle" fontFamily={mono} fontSize={8.5} fill={textSecondary}>
          {sub}
        </text>
      )}
    </g>
  )

  /** The numbered block that opens each lane. Framed like every other node —
      as bare text it read as a rendering failure, because the lane began with
      an unterminated curve and floating words where a box was clearly meant. */
  const StepNode = ({ cx, cy, w, h, num, label, sub, color }) => (
    <g>
      <rect
        x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={9}
        fill={color} fillOpacity={0.12} stroke={color} strokeOpacity={0.65} strokeWidth={1.25}
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily={sans} fontSize={11} fontWeight={700} fill={textPrimary}>
        <tspan fill={color} fontWeight={800}>{num}</tspan> {label}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily={sans} fontSize={8.5} fill={textSecondary}>
        {sub}
      </text>
    </g>
  )

  /** Small amber dot marking a node as an AIRS enforcement point. */
  const AirsDot = ({ x, y }) => (
    <g>
      <circle cx={x} cy={y} r={3.5} fill={AMBER} fillOpacity={0.9} />
      <circle cx={x} cy={y} r={6.5} fill={AMBER} fillOpacity={0.18} />
    </g>
  )

  return (
    <div
      dir="ltr"
      className="rounded-2xl p-4 flex flex-col gap-2 overflow-x-auto"
      style={{
        background: 'radial-gradient(115% 130% at 42% 30%, #0f2430 0%, #090f1a 74%)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <svg viewBox="0 0 1240 400" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: 860 }}>
        <defs>
          <radialGradient id="moh-appGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={TEAL} stopOpacity="0.45" />
            <stop offset="70%" stopColor={TEAL} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="moh-appFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={TEAL} />
            <stop offset="100%" stopColor={SKY} />
          </linearGradient>
          {[['moh-arrTeal', TEAL], ['moh-arrPurple', PURPLE], ['moh-arrSky', SKY], ['moh-arrAmber', AMBER]].map(([id, c]) => (
            <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M0,0 L6,3.5 L0,7 Z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* column headers */}
        <text x={620} y={26} textAnchor="middle" fontFamily={sans} fontSize={10} fontWeight={700} letterSpacing="1.2" fill={textSecondary}>
          ENFORCEMENT
        </text>
        <text x={820} y={26} textAnchor="middle" fontFamily={sans} fontSize={10} fontWeight={700} letterSpacing="1.2" fill={textSecondary}>
          EXECUTION
        </text>

        {/* ── connectors, drawn beneath the nodes ──
            The fan-out now lands ON the step block with an arrowhead, instead
            of trailing off into open space beside a floating label. */}
        <path d="M112,160 L142,160" fill="none" stroke={TEAL} strokeOpacity={0.55} strokeWidth={2} markerEnd="url(#moh-arrTeal)" />
        <path d={`M262,160 C300,160 300,${LANE_A} 340,${LANE_A}`} fill="none" stroke={TEAL} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" markerEnd="url(#moh-arrTeal)" />
        <path d={`M262,160 C300,160 300,${LANE_B} 340,${LANE_B}`} fill="none" stroke={PURPLE} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" markerEnd="url(#moh-arrPurple)" />

        {/* lane A: label → gateway → bedrock → answer */}
        <path d={`M508,${LANE_A} L540,${LANE_A}`} fill="none" stroke={TEAL} strokeOpacity={0.85} strokeWidth={2.4} markerEnd="url(#moh-arrTeal)" />
        <path d={`M695,${LANE_A} L765,${LANE_A}`} fill="none" stroke={TEAL} strokeOpacity={0.9} strokeWidth={2.4} markerEnd="url(#moh-arrTeal)" />
        <path d={`M910,${LANE_A} L1091,${LANE_A}`} fill="none" stroke={TEAL} strokeOpacity={0.9} strokeWidth={2.4} markerEnd="url(#moh-arrTeal)" />

        {/* lane B: label → stage1 → services → stage2 → answer */}
        <path d={`M508,${LANE_B} L530,${LANE_B}`} fill="none" stroke={PURPLE} strokeOpacity={0.85} strokeWidth={2.4} markerEnd="url(#moh-arrPurple)" />
        <path d={`M665,${LANE_B} L715,${LANE_B}`} fill="none" stroke={PURPLE} strokeOpacity={0.9} strokeWidth={2.4} markerEnd="url(#moh-arrPurple)" />
        <path d={`M860,${LANE_B} L905,${LANE_B}`} fill="none" stroke={PURPLE} strokeOpacity={0.9} strokeWidth={2.4} markerEnd="url(#moh-arrPurple)" />
        <path d={`M1040,${LANE_B} L1091,${LANE_B}`} fill="none" stroke={PURPLE} strokeOpacity={0.9} strokeWidth={2.4} markerEnd="url(#moh-arrPurple)" />

        {/* ── citizen ── */}
        <Node cx={62} cy={160} w={100} h={40} label="CITIZEN" sub="he · en" />

        {/* ── Briut.AI hero node ── */}
        <circle cx={204} cy={160} r={68} fill="url(#moh-appGlow)" />
        <rect x={152} y={140} width={108} height={46} rx={11} fill={TEAL} fillOpacity={0.18} />
        <rect x={148} y={136} width={108} height={46} rx={11} fill="url(#moh-appFill)" fillOpacity={0.28} stroke={TEAL} strokeOpacity={0.85} strokeWidth={1.4} />
        <text x={202} y={157} textAnchor="middle" fontFamily={mono} fontSize={11} fontWeight={800} fill={textPrimary}>Briut.AI</text>
        <text x={202} y={171} textAnchor="middle" fontFamily={sans} fontSize={8.5} fill={textSecondary} direction="rtl">בריאות</text>

        {/* ── lane openers — framed, filling the 348–500 gap the outbound
              arrows at x=508 already leave for them ── */}
        <StepNode cx={424} cy={LANE_A} w={152} h={48} num="1." label="MODEL TURN" sub={'every prompt & response'} color={TEAL} />
        <StepNode cx={424} cy={LANE_B} w={152} h={48} num="2." label="TOOL CALL" sub="agent actions" color={PURPLE} />

        {/* ── lane A nodes ── */}
        <Node cx={620} cy={LANE_A} w={150} h={48} label="SCM AI-GW" sub="+ AIRS guardrail" color={TEAL} fontSize={11} />
        <AirsDot x={688} y={LANE_A - 17} />
        <Node cx={838} cy={LANE_A} w={140} h={42} label="BEDROCK" sub="Claude" color={AMBER} />
        <Node cx={1148} cy={LANE_A} w={108} h={38} label="ANSWER" fill={boxFill} stroke={boxStroke} fontSize={10.5} />

        {/* ── lane B nodes ── */}
        <Node cx={600} cy={LANE_B} w={130} h={46} label="AIRS · stage 1" sub="parameters" color={PURPLE} />
        <AirsDot x={656} y={LANE_B - 16} />
        <Node cx={790} cy={LANE_B} w={140} h={48} label="HEALTH SERVICES" sub="records · appts · labs" color={SKY} fontSize={9.5} />
        <Node cx={975} cy={LANE_B} w={130} h={46} label="AIRS · stage 2" sub="output" color={PURPLE} />
        <AirsDot x={1031} y={LANE_B - 16} />
        <Node cx={1148} cy={LANE_B} w={108} h={38} label="ANSWER" fill={boxFill} stroke={boxStroke} fontSize={10.5} />

        {/* What each enforcement point actually inspects. Without this the
            boxes are just names, and the audience has to be told out loud. */}
        <text x={620} y={128} textAnchor="middle" fontFamily={sans} fontSize={9} fill={textSecondary}>
          inspects every prompt and every response
        </text>
        <text x={620} y={141} textAnchor="middle" fontFamily={mono} fontSize={8.5} fill={TEAL} fillOpacity={0.85}>
          injection · PII / DLP · toxic · malicious URL
        </text>

        <text x={600} y={277} textAnchor="middle" fontFamily={sans} fontSize={9} fill={textSecondary}>
          tool parameters — before anything runs
        </text>
        <text x={975} y={277} textAnchor="middle" fontFamily={sans} fontSize={9} fill={textSecondary}>
          tool output — before the model sees it
        </text>
        <text x={790} y={277} textAnchor="middle" fontFamily={sans} fontSize={9} fill={textSecondary}>
          patient records · appointments · lab results
        </text>

        {/* ── shared policy pill ── */}
        <rect x={422} y={330} width={396} height={24} rx={7} fill={AMBER} fillOpacity={0.10} stroke={AMBER} strokeOpacity={0.45} strokeWidth={1} />
        <circle cx={440} cy={342} r={3.5} fill={AMBER} />
        <text x={454} y={346} fontFamily={mono} fontSize={9.5} fontWeight={700} fill={AMBER}>
          ONE AIRS PROFILE · sudo-airs-api-profile-new
        </text>

        {/* Legend — says what the amber dot means and what a block does, so the
            diagram stands on its own if someone photographs it. */}
        <circle cx={432} cy={378} r={3.5} fill={AMBER} fillOpacity={0.9} />
        <circle cx={432} cy={378} r={6.5} fill={AMBER} fillOpacity={0.18} />
        <text x={446} y={382} fontFamily={sans} fontSize={9} fill={textSecondary}>
          AIRS enforcement point — a failed verdict stops the request here. It never reaches the next box.
        </text>
      </svg>

      {/* The SVG is pinned LTR, but the caption must follow the UI language
          or Hebrew renders with broken bidi. */}
      <div className="text-[11px] italic px-1 leading-relaxed" style={{ color: textSecondary }} dir={dir}>
        {t('arch.caption')}
      </div>
    </div>
  )
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ theme, health, onOpenCorpus, onOpenAgent }) {
  const { t, pick } = useMohLang()
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 22 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            borderRadius: 18, padding: '26px 28px', color: '#fff',
            background: 'linear-gradient(135deg, #0d9488 0%, #0e7490 50%, #0369a1 100%)',
            boxShadow: '0 10px 34px rgba(6,60,80,0.28)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <HeartPulse size={26} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>בריאות.AI · Briut.AI</h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, maxWidth: 760, color: 'rgba(255,255,255,0.9)' }}>
            A bilingual Ministry of Health assistant, and the four ways it can be turned against
            the citizens it serves. Every model call routes through the Prisma AIRS AI Gateway;
            every tool call is additionally scanned directly by AIRS as a <code>tool_event</code>.
          </p>
          <button
            onClick={openCitizenApp}
            style={{
              marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              borderRadius: 10, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.16)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, Inter, sans-serif',
            }}
          >
            <ExternalLink size={15} /> {t('app.launch')}
          </button>
          <div style={{ marginTop: 7, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{t('app.launchHint')}</div>
        </div>

        {/* Live status */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Stat
            label="AI GATEWAY" theme={theme}
            value={statusValue(health, health?.gateway?.reachable, health?.gateway?.configured)}
            color={statusColor(health, health?.gateway?.reachable, health?.gateway?.configured)}
            sub={health?.gateway?.baseUrl}
          />
          <Stat
            label="AIRS DIRECT" theme={theme}
            value={statusValue(health, health?.airsDirect?.reachable, health?.airsDirect?.configured)}
            color={statusColor(health, health?.airsDirect?.reachable, health?.airsDirect?.configured)}
            sub={
              health?.airsDirect?.profile
                ? `${health.airsDirect.profile}${health.airsDirect.usingMohOverride ? ' · MOH override' : ' · portal-wide key'}`
                : undefined
            }
          />
          <Stat
            label="ENFORCEMENT" theme={theme}
            /* Server reports mode 'config' | 'workspace' — an earlier revision
               used 'enforce', so this tile read Monitor even when a protected
               config was wired. */
            value={health?.enforcement?.mode === 'config' ? 'Enforce' : health ? 'Workspace' : '…'}
            color={health?.enforcement?.mode === 'config' ? '#10b981' : '#f59e0b'}
            sub={health?.enforcement?.canCompareLanes ? 'both lanes wired' : 'no unprotected lane'}
          />
          <Stat label="CORPUS" theme={theme} value={health?.corpus ?? '…'} sub="clinical documents →" onClick={onOpenCorpus} />
          <Stat label="TOOLS" theme={theme} value={health?.tools ?? '…'} sub="health services →" onClick={onOpenAgent} />
        </div>

        {health?.enforcement?.note && (
          <div
            style={{
              display: 'flex', gap: 9, padding: '12px 15px', borderRadius: 12,
              background: theme.flaggedBg, border: `1px solid ${theme.flaggedBorder}`,
            }}
          >
            <AlertTriangle size={15} color={theme.flagged} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 11.5, lineHeight: 1.6, color: theme.text }}>{health.enforcement.note}</span>
          </div>
        )}

        {/* The four families */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {MOH_ATTACKS_BY_FAMILY.map((f) => (
            <div
              key={f.id}
              style={{
                borderRadius: 14, border: `1px solid ${f.color}33`, background: `${f.color}0a`,
                padding: '15px 17px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: f.color }} />
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: theme.text }}>{pick(f.label)}</h3>
                <span style={{ marginInlineStart: 'auto', fontSize: 10, color: theme.textFaint }}>
                  {f.attacks.length} scenarios
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.65, color: theme.textMuted }}>{pick(f.intro)}</p>
            </div>
          ))}
        </div>

        <Card title={t('arch.title')} theme={theme} icon={ShieldCheck}>
          <MohArchitectureDiagram />
        </Card>
      </div>
    </div>
  )
}

// ─── Live chat tab ────────────────────────────────────────────────────────────

function ChatTab({ theme }) {
  const { t } = useMohLang()
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
          borderBottom: `1px solid ${theme.border}`, background: theme.surfaceMuted,
        }}
      >
        <span style={{ fontSize: 11.5, color: theme.textMuted, flex: 1 }}>{t('app.launchHint')}</span>
        <button
          onClick={openCitizenApp}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 9,
            border: `1px solid ${ACCENT}55`, background: `${ACCENT}18`, color: ACCENT,
            fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, Inter, sans-serif',
          }}
        >
          <ExternalLink size={13} /> {t('app.launch')}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <BriutApp embedded />
      </div>
    </div>
  )
}

// ─── Scenario tab (RAG + Agent share this) ────────────────────────────────────

function ScenarioTab({ familyId, theme, showCorpus, corpusSignal }) {
  const { t, pick, lang } = useMohLang()
  const { leftWidth, rightWidth, drag, startDrag } = useSidePanels()
  const [protectionOn, setProtectionOn] = useState(true)
  const [model, setModel] = useState(null)
  const [active, setActive] = useState(null)
  const [mode, setMode] = useState('scenarios') // 'scenarios' | 'docs'
  const [docs, setDocs] = useState([])
  const [activeDoc, setActiveDoc] = useState(null)
  const { messages, busy, runScenario, clear } = useMohChat()

  const family = MOH_ATTACKS_BY_FAMILY.find((f) => f.id === familyId)

  useEffect(() => {
    fetch('/api/moh/models').then((r) => r.json()).then((d) => setModel((c) => c || d.default)).catch(() => {})
    if (showCorpus) {
      fetch('/api/moh/corpus').then((r) => r.json()).then((d) => setDocs(d.documents || [])).catch(() => {})
    }
  }, [showCorpus])

  // The Overview "CORPUS" tile deep-links straight into the document browser.
  useEffect(() => {
    if (showCorpus && corpusSignal) setMode('docs')
  }, [corpusSignal, showCorpus])

  const run = (attack) => {
    setActive(attack)
    clear()
    runScenario(attack, { model, lang, airsEnabled: protectionOn })
  }

  const result = messages.find((m) => m.role === 'assistant')
  const meta = result?.metadata || {}

  const payloadStages = [
    meta.stage1?.requestBody && { label: t('console.toolStage1'), body: meta.stage1.requestBody, latency: meta.stage1.latencyMs },
    meta.stage2?.requestBody && { label: t('console.toolStage2'), body: meta.stage2.requestBody, latency: meta.stage2.latencyMs },
    meta.hookResults && { label: t('console.gatewayScan'), body: meta.hookResults, latency: null },
  ].filter(Boolean)

  return (
    <div
      style={{
        height: '100%', display: 'flex', minHeight: 0,
        cursor: drag ? 'col-resize' : 'default', userSelect: drag ? 'none' : 'auto',
      }}
    >
      {/* Scenario list / document corpus */}
      <aside style={{ width: leftWidth, flexShrink: 0, overflowY: 'auto', padding: 14, background: theme.surfaceMuted }}>
        {showCorpus && (
          <div
            style={{
              display: 'flex', gap: 3, padding: 3, marginBottom: 11, borderRadius: 10,
              background: theme.surface, border: `1px solid ${theme.border}`,
            }}
          >
            {[['scenarios', t('corpus.tabScenarios')], ['docs', t('corpus.tabDocs')]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 10.5, fontWeight: 700, fontFamily: 'Heebo, Inter, sans-serif',
                  background: mode === id ? `${ACCENT}1a` : 'transparent',
                  color: mode === id ? ACCENT : theme.textMuted,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'docs' ? (
          <CorpusList docs={docs} activeId={activeDoc} onPick={setActiveDoc} theme={theme} />
        ) : (
        <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setProtectionOn((p) => !p)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '7px 10px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: protectionOn ? theme.allowedBg : theme.blockedBg,
              border: `1px solid ${protectionOn ? theme.allowedBorder : theme.blockedBorder}`,
              color: protectionOn ? theme.allowed : theme.blocked,
              fontFamily: 'Heebo, Inter, sans-serif',
            }}
          >
            {protectionOn ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
            AIRS {protectionOn ? t('common.on') : t('common.off')}
          </button>
        </div>

        <p style={{ margin: '0 0 12px', fontSize: 10.5, lineHeight: 1.6, color: theme.textMuted }}>
          {pick(family.intro)}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {family.attacks.map((a) => {
            const isActive = active?.id === a.id
            return (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => run(a)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 11,
                  border: `1px solid ${isActive ? family.color : theme.border}`,
                  background: isActive ? `${family.color}12` : theme.surface,
                  cursor: busy ? 'default' : 'pointer', textAlign: 'start', opacity: busy && !isActive ? 0.55 : 1,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: theme.text, flex: 1 }}>{pick(a.label)}</span>
                  {a.verified && <span title={t('demo.verifiedHint')} style={{ fontSize: 10, color: '#10b981', fontWeight: 800 }}>✓</span>}
                  <span
                    style={{
                      fontSize: 8.5, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                      background: `${MOH_SEVERITY_COLORS[a.severity]}22`, color: MOH_SEVERITY_COLORS[a.severity],
                    }}
                  >
                    {t(`demo.severity.${a.severity}`)}
                  </span>
                </span>
                <span style={{ fontSize: 9.5, color: theme.textFaint }}>
                  {a.technique}{a.owasp && a.owasp !== '—' ? ` · ${a.owasp}` : ''}
                </span>
              </button>
            )
          })}
        </div>
        </>
        )}
      </aside>

      <ResizeHandle onMouseDown={startDrag('left')} active={drag === 'left'} theme={theme} />

      {/* Result / document */}
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 18 }}>
        {mode === 'docs' ? (
          <CorpusViewer docId={activeDoc} theme={theme} />
        ) : !active ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: theme.textFaint, fontSize: 12.5 }}>
            {t('console.noRun')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 780 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: theme.text }}>{pick(active.label)}</h2>
                {result && result.status !== 'streaming' && (
                  <VerdictPill status={result.status === 'error' ? 'direct' : result.status} theme={theme} />
                )}
                {busy && <RefreshCw size={14} className="animate-spin" color={theme.textFaint} />}
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: theme.textMuted }}>
                {active.technique}{active.owasp && active.owasp !== '—' ? ` · ${active.owasp}` : ''}
                {active.atlas ? ` · ${active.atlas}` : ''}
              </p>
            </div>

            <Card title={t('demo.why')} theme={theme} icon={AlertTriangle} accent={family.color}>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.75, color: theme.text }}>{pick(active.why)}</p>
            </Card>

            <Card title="Payload" theme={theme}>
              <pre
                dir={lang === 'he' ? 'rtl' : 'ltr'}
                style={{
                  margin: 0, fontSize: 12, lineHeight: 1.7, color: theme.text, whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word', fontFamily: 'Heebo, Inter, sans-serif',
                }}
              >
                {pick(active.payload)}
              </pre>
            </Card>

            {result?.metadata?.citations && (
              <Card title={t('rag.retrieved')} theme={theme} icon={FileText} accent={family.color}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {result.metadata.citations.map((d) => {
                    const c = MOH_RISK_COLORS[d.risk] || theme.textFaint
                    return (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', borderRadius: 10,
                          background: `${c}0d`, border: `1px solid ${c}33`,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: theme.text }}>
                            {lang === 'he' ? d.title_he : d.title_en}
                          </div>
                          <div style={{ fontSize: 10, color: theme.textFaint, marginTop: 3, lineHeight: 1.5 }}>
                            {d.preview?.slice(0, 130)}…
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 8.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                            background: `${c}22`, color: c, whiteSpace: 'nowrap',
                          }}
                        >
                          {t(`rag.risk.${d.risk}`)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {result && (
              <Card
                title={result.status === 'blocked' ? t('blocked.title') : t('rag.answer')}
                theme={theme}
                accent={result.status === 'blocked' ? theme.blocked : family.color}
              >
                {result.status === 'blocked' ? (
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: theme.blocked }}>
                    {t('blocked.body')}
                  </p>
                ) : meta.providerFiltered ? (
                  /* Empty body + finish_reason:content_filtered. Saying so beats
                     rendering nothing and looking broken. */
                  <div style={{ display: 'flex', gap: 9 }}>
                    <AlertTriangle size={15} color={theme.flagged} style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: theme.text }}>
                      {t('corpus.providerFiltered')}
                    </p>
                  </div>
                ) : (
                  <p
                    dir={lang === 'he' ? 'rtl' : 'ltr'}
                    style={{
                      margin: 0, fontSize: 12.5, lineHeight: 1.75, color: theme.text,
                      whiteSpace: 'pre-wrap', fontFamily: 'Heebo, Inter, sans-serif',
                    }}
                  >
                    {result.content || (busy ? t('chat.thinking') : '—')}
                  </p>
                )}
              </Card>
            )}

            {meta.toolResult && (
              <Card title={t('agent.result')} theme={theme} icon={Wrench} accent={family.color}>
                <pre
                  dir="ltr"
                  style={{
                    margin: 0, padding: 12, borderRadius: 9, fontSize: 10.5, lineHeight: 1.6,
                    fontFamily: 'JetBrains Mono, monospace', background: theme.codeBg, color: theme.codeText,
                    overflowX: 'auto', maxHeight: 260, overflowY: 'auto', textAlign: 'left',
                  }}
                >
                  {JSON.stringify(meta.toolResult, null, 2)}
                </pre>
              </Card>
            )}
          </div>
        )}
      </main>

      <ResizeHandle onMouseDown={startDrag('right')} active={drag === 'right'} theme={theme} />

      {/* Telemetry */}
      <aside style={{ width: rightWidth, flexShrink: 0, overflowY: 'auto', padding: 14, background: theme.surfaceMuted }}>
        <h3 style={{ margin: '0 0 11px', fontSize: 11, fontWeight: 800, color: theme.textFaint, letterSpacing: '0.08em' }}>
          {t('console.title')}
        </h3>
        {!result ? (
          <p style={{ fontSize: 11.5, color: theme.textFaint }}>{t('console.noRun')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {meta.inputScan && <ScanStageCard stage="1" label={t('console.stage1')} data={meta.inputScan} theme={theme} />}
            {meta.outputScan && <ScanStageCard stage="2" label={t('console.stage2')} data={meta.outputScan} theme={theme} />}
            {meta.stage1 && <ScanStageCard stage="T1" label={t('console.toolStage1')} data={meta.stage1} theme={theme} />}
            {meta.stage2 && <ScanStageCard stage="T2" label={t('console.toolStage2')} data={meta.stage2} theme={theme} />}
            {payloadStages.length > 0 && <AirsPayloadViewer stages={payloadStages} theme={theme} accent={ACCENT} />}
            {meta.latencyMs != null && (
              <div style={{ fontSize: 10.5, color: theme.textMuted }}>
                {t('console.latency')}: {meta.latencyMs} {t('common.ms')}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

// ─── Detection matrix ─────────────────────────────────────────────────────────

const MATRIX_LANGS = ['en', 'he']
// One batch = 4 pairs = 8 scans, which the route's pool of 4 clears in ~5s.
// Small enough that no single request can hit an Nginx/proxy read timeout.
const MATRIX_BATCH = 4

// The run is batched now, so the server can only summarise the slice it was
// handed. Totals are recomputed here over everything accumulated so far —
// same arithmetic as the /matrix route, applied to the running set.
function matrixSummary(rows) {
  const attacks = rows.filter((r) => r.expect === 'block')
  const controls = rows.filter((r) => r.expect === 'allow')
  return Object.fromEntries(
    MATRIX_LANGS.map((l) => [
      l,
      {
        detected: attacks.filter((r) => r.results?.[l]?.action === 'block').length,
        of: attacks.length,
        falsePositives: controls.filter((r) => r.results?.[l]?.action === 'block').length,
        controls: controls.length,
      },
    ])
  )
}

// Blocked in English, allowed in Hebrew — the coverage question for the RFI.
function matrixGaps(rows) {
  return rows
    .filter((r) => r.expect === 'block' && r.results?.en?.action === 'block' && r.results?.he?.action !== 'block')
    .map((r) => r.id)
}

function MatrixTab({ theme }) {
  const { t } = useMohLang()
  const [rows, setRows] = useState(null)
  const [summary, setSummary] = useState(null)
  const [gaps, setGaps] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)

  // This was one blocking POST covering all 21 pairs — ~25s locally and longer
  // through Nginx on EC2, where it surfaced as a bare "Failed to fetch" with
  // nothing rendered and no clue why. It now walks the pairs in small batches
  // through the `ids` parameter the route already accepts: no request runs more
  // than a few seconds, the table fills in as results land, and a failure keeps
  // whatever has already been measured instead of discarding the whole run.
  const run = async () => {
    setRunning(true)
    setError(null)
    setRows(null)
    setSummary(null)
    setGaps([])
    try {
      const pl = await fetch('/api/moh/matrix/pairs').then((r) => r.json())
      const ids = (pl.pairs || []).map((p) => p.id)
      if (!ids.length) throw new Error('No probe pairs returned by /api/moh/matrix/pairs')
      setProgress({ done: 0, total: ids.length })

      const acc = []
      for (let i = 0; i < ids.length; i += MATRIX_BATCH) {
        const ctl = new AbortController()
        const timer = setTimeout(() => ctl.abort(), 60000)
        let d
        try {
          const r = await fetch('/api/moh/matrix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids.slice(i, i + MATRIX_BATCH), langs: MATRIX_LANGS }),
            signal: ctl.signal,
          })
          if (!r.ok) throw new Error(`AIRS matrix request failed — HTTP ${r.status}`)
          d = await r.json()
        } finally {
          clearTimeout(timer)
        }
        if (d.error) throw new Error(d.error)

        acc.push(...(d.rows || []))
        setRows([...acc])
        setSummary(matrixSummary(acc))
        setGaps(matrixGaps(acc))
        setProgress({ done: Math.min(i + MATRIX_BATCH, ids.length), total: ids.length })
      }
    } catch (e) {
      setError(
        e?.name === 'AbortError'
          ? 'A batch timed out after 60s — AIRS did not respond. Check /api/moh/health.'
          : String(e?.message || e)
      )
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const cell = (res, expect) => {
    if (!res) return <span style={{ color: theme.textFaint }}>—</span>
    if (res.error) return <span style={{ color: theme.flagged, fontSize: 10 }}>err</span>
    const blocked = res.action === 'block'
    const correct = expect === 'block' ? blocked : !blocked
    const c = correct ? theme.allowed : theme.blocked
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: c, fontWeight: 700, fontSize: 10.5 }}>
        {correct ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
        {blocked ? 'BLOCK' : 'allow'}
      </span>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 22 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.text }}>{t('matrix.title')}</h2>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, color: theme.textMuted, lineHeight: 1.6 }}>
              {t('matrix.subtitle')} Palo Alto documents multilingual scanning for AI Red Teaming
              (French, Japanese, Thai, Hindi) — Hebrew is not on that list, so this measures the
              runtime detectors directly.
            </p>
          </div>
          <button
            onClick={run}
            disabled={running}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
              border: `1px solid ${ACCENT}66`, background: running ? theme.surfaceMuted : `${ACCENT}1a`,
              color: ACCENT, fontSize: 12.5, fontWeight: 700, cursor: running ? 'default' : 'pointer',
              fontFamily: 'Heebo, Inter, sans-serif',
            }}
          >
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {running
              ? `${t('matrix.running')}${progress ? ` · ${progress.done}/${progress.total}` : ''}`
              : t('matrix.run')}
          </button>
        </div>

        {error && (
          <div style={{ padding: '11px 14px', borderRadius: 11, background: theme.blockedBg, border: `1px solid ${theme.blockedBorder}`, fontSize: 11.5, color: theme.text }}>
            {error}
          </div>
        )}

        {summary && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {['en', 'he'].map((l) => {
              const s = summary[l]
              if (!s) return null
              const pct = s.of ? Math.round((s.detected / s.of) * 100) : 0
              return (
                <Stat
                  key={l} theme={theme}
                  label={l === 'he' ? 'HEBREW' : 'ENGLISH'}
                  value={`${s.detected}/${s.of}`}
                  color={pct >= 80 ? theme.allowed : pct >= 60 ? theme.flagged : theme.blocked}
                  sub={`${pct}% ${t('matrix.detected')} · ${s.falsePositives}/${s.controls} ${t('matrix.falsePositives')}`}
                />
              )
            })}
          </div>
        )}

        {gaps.length > 0 && (
          <div style={{ padding: '13px 16px', borderRadius: 12, background: theme.flaggedBg, border: `1px solid ${theme.flaggedBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <AlertTriangle size={15} color={theme.flagged} />
              <strong style={{ fontSize: 12.5, color: theme.text }}>{t('matrix.gapsTitle')}</strong>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: theme.textMuted }}>{t('matrix.gapsBody')}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {gaps.map((g) => (
                <code key={g} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 6, background: `${theme.flagged}22`, color: theme.flagged }}>
                  {g}
                </code>
              ))}
            </div>
          </div>
        )}

        {rows && (
          <div style={{ borderRadius: 13, border: `1px solid ${theme.border}`, overflow: 'hidden', background: theme.surface }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: theme.surfaceMuted }}>
                  {['ID', t('matrix.expect'), 'EN', 'HE', 'EN category', 'HE category', 'Scenario'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 11px', textAlign: 'start', fontSize: 9.5, fontWeight: 800,
                        color: theme.textFaint, letterSpacing: '0.07em', borderBottom: `1px solid ${theme.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '8px 11px' }}><code style={{ fontSize: 10.5, color: theme.textMuted }}>{r.id}</code></td>
                    <td style={{ padding: '8px 11px', fontSize: 10.5, color: theme.textFaint }}>{r.expect}</td>
                    <td style={{ padding: '8px 11px' }}>{cell(r.results?.en, r.expect)}</td>
                    <td style={{ padding: '8px 11px' }}>{cell(r.results?.he, r.expect)}</td>
                    <td style={{ padding: '8px 11px', fontSize: 10.5, color: theme.textMuted }}>{r.results?.en?.category ?? '—'}</td>
                    <td style={{ padding: '8px 11px', fontSize: 10.5, color: theme.textMuted }}>{r.results?.he?.category ?? '—'}</td>
                    <td style={{ padding: '8px 11px', fontSize: 10.5, color: theme.text }}>{r.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Governance ───────────────────────────────────────────────────────────────

function GovernanceTab({ theme }) {
  const { t } = useMohLang()
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 22 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card title="Israeli PII coverage" theme={theme} icon={AlertTriangle} accent="#f59e0b">
          <p style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.75, color: theme.text }}>
            AIRS DLP reliably detects US SSN and payment card numbers. In direct probing of this
            profile, an Israeli <strong>תעודת זהות</strong> (check-digit-valid) and a health-fund
            member number passed as <code>benign</code> in <em>both</em> Hebrew and English.
          </p>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: theme.textMuted }}>
            For a Ministry of Health deployment this is the concrete ask: a custom DLP pattern for
            ת.ז. and מספר מבוטח, so citizen identifiers are masked and audited rather than passed
            through. Run the Detection Matrix tab live to show it.
          </p>
        </Card>

        <Card title="Data residency" theme={theme} icon={Scale}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.75, color: theme.text }}>
            The AIRS API is reachable in four regions — United States, EU (Germany), India and
            Singapore. There is no Israel region today, so an Israeli health deployment would scan
            via the EU endpoint. Worth raising before it is asked.
          </p>
        </Card>

        <Card title="Audit trail" theme={theme} icon={ShieldCheck}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.75, color: theme.text }}>
            Every request carries metadata <code>{'{ demo, lang, scenario, family }'}</code>, so the
            gateway analytics break the session down per scenario and per language with no extra
            instrumentation. Scans land in Strata Cloud Manager under TSG 1698236796, and every run
            is also persisted to the portal's own trace store — visible in the Observability pillar.
          </p>
        </Card>
      </div>
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

/**
 * Language switch for the whole pillar.
 *
 * BriutApp carries its own copy, but that one is styled white-on-teal for the
 * dark chat header and only exists inside the chat — which left every other
 * tab stuck at whatever language was already in localStorage, with no way to
 * change it. This one lives on the tab bar, so it follows the app theme and is
 * reachable from Overview, RAG, Agent, MCP, Matrix and Governance too.
 */
function PillarLangToggle({ theme }) {
  const { lang, setLang } = useMohLang()
  return (
    <div
      dir="ltr"
      style={{
        display: 'flex', borderRadius: 999, overflow: 'hidden',
        border: `1px solid ${theme.border}`, background: theme.surfaceMuted,
      }}
    >
      {[['he', 'עב'], ['en', 'EN']].map(([code, label]) => {
        const on = lang === code
        return (
          <button
            key={code}
            onClick={() => setLang(code)}
            aria-pressed={on}
            title={code === 'he' ? 'עברית' : 'English'}
            style={{
              padding: '4px 12px', fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer',
              background: on ? ACCENT : 'transparent',
              color: on ? '#ffffff' : theme.textMuted,
              fontFamily: 'Heebo, Inter, sans-serif',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function MinistryHealthInner() {
  const { state } = useAppContext()
  const isLight = !state.isDark
  const theme = useMemo(() => mohTheme(isLight), [isLight])
  const { t, dir } = useMohLang()
  const [tab, setTab] = useState('overview')
  const [health, setHealth] = useState(null)
  // Bumped by the Overview CORPUS tile so the RAG tab opens on the browser.
  const [corpusSignal, setCorpusSignal] = useState(0)

  useEffect(() => {
    fetch('/api/moh/health').then((r) => r.json()).then(setHealth).catch(() => {})
  }, [])

  return (
    <div
      dir={dir}
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: theme.pageBg, fontFamily: 'Heebo, Inter, system-ui, sans-serif',
        color: theme.text, minHeight: 0,
      }}
    >
      {/* The tabs scroll on a narrow window; the language switch is pinned
          outside that scroller so it never scrolls out of reach. */}
      <nav
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'stretch',
          borderBottom: `1px solid ${theme.border}`, background: theme.surface,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 3, padding: '8px 14px 0', overflowX: 'auto' }}>
          {TABS.map((tb) => {
            const on = tab === tb.id
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px',
                  borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
                  background: on ? `${ACCENT}16` : 'transparent',
                  color: on ? ACCENT : theme.textMuted,
                  fontSize: 12, fontWeight: on ? 800 : 600, whiteSpace: 'nowrap',
                  borderBottom: on ? `2px solid ${ACCENT}` : '2px solid transparent',
                  fontFamily: 'Heebo, Inter, sans-serif',
                }}
              >
                <tb.icon size={14} />
                {t(tb.key)}
              </button>
            )
          })}
        </div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px' }}>
          <PillarLangToggle theme={theme} />
        </div>
      </nav>

      {/* Which SCM tenant this pillar logs to. It is the one thing about this
          demo that is not visible from the UI: the whole pillar runs against
          SUDO-Personal while the other nine run against the team tenant, so
          without this line someone opens the team console, sees nothing and
          concludes the scans did not happen. */}
      <div
        dir={dir}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 16px', fontSize: 11, lineHeight: 1.45,
          background: `${ACCENT}0e`, borderBottom: `1px solid ${theme.border}`,
          color: theme.textMuted,
        }}
      >
        <Building2 size={12} style={{ color: ACCENT, flexShrink: 0 }} />
        <span style={{ fontWeight: 800, color: ACCENT }}>{t('tenant.label')}</span>
        <span dir="auto">{t('tenant.note')}</span>
      </div>

      {/* All tabs stay mounted so an in-flight or completed run survives a tab switch. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {TABS.map((tb) => (
          <div
            key={tb.id}
            style={{ position: 'absolute', inset: 0, display: tab === tb.id ? 'block' : 'none' }}
          >
            {tb.id === 'overview' && (
              <OverviewTab
                theme={theme}
                health={health}
                onOpenCorpus={() => { setCorpusSignal((n) => n + 1); setTab('rag') }}
                onOpenAgent={() => setTab('agent')}
              />
            )}
            {tb.id === 'chat' && <ChatTab theme={theme} />}
            {tb.id === 'rag' && <ScenarioTab familyId="rag" theme={theme} showCorpus corpusSignal={corpusSignal} />}
            {tb.id === 'agent' && <ScenarioTab familyId="agent" theme={theme} />}
            {tb.id === 'mcp' && <McpTab theme={theme} />}
            {tb.id === 'matrix' && <MatrixTab theme={theme} />}
            {tb.id === 'governance' && <GovernanceTab theme={theme} />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MinistryHealthView() {
  return (
    <MohLangProvider>
      <MinistryHealthInner />
    </MohLangProvider>
  )
}
