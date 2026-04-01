import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crosshair, ScanSearch, Swords, Terminal, BarChart2, Code2,
  ChevronRight, X, ArrowRight, Shield, Sun, Moon,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import airsLogo from '../../prisma-AIRS_RGB_logo_Lockup_Negative.png'

// ─── Pillar data (full content matching original) ──────────────────────────────
const PILLARS = [
  {
    id: 'apiIntercept',
    icon: Crosshair,
    title: 'API Intercept',
    tag: 'Runtime Protection',
    summary: 'Intercept & block malicious prompts before they reach your model.',
    description: 'Simulate real-world prompt injection, jailbreak, and data exfiltration attacks against live LLM endpoints. Toggle AIRS protection on/off to see exactly how Prisma AIRS intercepts malicious payloads at the API layer — before they reach the model.',
    highlights: ['Prompt injection detection', 'Jailbreak prevention', 'Input / output scanning', 'SCM deep-link telemetry'],
    accent: '#ef4444',
    glow: 'rgba(239,68,68,0.30)',
    dim: 'rgba(239,68,68,0.07)',
  },
  {
    id: 'modelScanning',
    icon: ScanSearch,
    title: 'Model Scanning',
    tag: 'Supply-Chain Security',
    summary: 'Detect malware & backdoors in AI model artifacts before deployment.',
    description: 'Scan AI model artifacts for embedded malware, backdoors, and serialisation vulnerabilities (pickle exploits, unsafe tensors) before they are deployed. Supports local file uploads and HuggingFace model URIs.',
    highlights: ['Pickle / safetensor analysis', 'HuggingFace model scanning', 'CVE vulnerability mapping', 'Detailed rule-violation reports'],
    accent: '#3b82f6',
    glow: 'rgba(59,130,246,0.30)',
    dim: 'rgba(59,130,246,0.07)',
  },
  {
    id: 'redTeaming',
    icon: Swords,
    title: 'Red Teaming',
    tag: 'Adversarial Testing',
    summary: 'Run automated adversarial campaigns and measure model robustness.',
    description: 'Run automated adversarial campaigns across multiple attack categories — DAN variants, role-play escapes, multi-turn manipulation, and more. Track robustness scores in real time and compare protected vs unprotected model behaviour.',
    highlights: ['Multi-category attack campaigns', 'Real-time robustness gauge', 'Attack log feed', 'Campaign state management'],
    accent: '#f97316',
    glow: 'rgba(249,115,22,0.30)',
    dim: 'rgba(249,115,22,0.07)',
  },
  {
    id: 'claudeHooks',
    icon: Terminal,
    title: 'AI Code Assistant Protection',
    tag: 'IDE Security',
    summary: 'Secure AI coding assistants with zero-change hook-based scanning.',
    description: 'Secure the Claude Code CLI with AIRS hook scripts that scan every prompt, URL fetch, and MCP tool call in real time — before any content reaches the model. Zero code changes required.',
    highlights: ['Prompt injection blocking', 'DLP / data exfiltration detection', 'MCP & WebFetch scanning', 'Threat model with test cases'],
    accent: '#8B5CF6',
    glow: 'rgba(139,92,246,0.30)',
    dim: 'rgba(139,92,246,0.07)',
  },
  {
    id: 'observability',
    icon: BarChart2,
    title: 'LLM Telemetry',
    tag: 'Observability',
    summary: 'Full trace visibility — latency, tokens, threats, every prompt logged.',
    description: 'Full LLM observability layer that captures every prompt and response as a structured trace. Monitor latency, token usage, threat detection rates, and AIRS overhead in real time — with a searchable prompt history log.',
    highlights: ['Live pipeline flow traces', 'Latency & token analytics', 'Threat detection breakdown', 'Prompt history log'],
    accent: '#10B981',
    glow: 'rgba(16,185,129,0.30)',
    dim: 'rgba(16,185,129,0.07)',
  },
  {
    id: 'developerCorner',
    icon: Code2,
    title: 'Developer Corner',
    tag: 'Integration Guide',
    summary: 'Python SDK, REST API, and live integration code — ready to ship.',
    description: 'Complete Prisma AIRS integration reference for development teams — Python SDK, REST API, live code samples extracted from this portal, and full API explorer with all fields and error codes.',
    highlights: ['Python SDK (pan-aisecurity) — sync & async', 'REST API with real curl examples', 'Live code from this demo portal', 'Full API reference & detection services'],
    accent: '#06B6D4',
    glow: 'rgba(6,182,212,0.30)',
    dim: 'rgba(6,182,212,0.07)',
  },
]

// ─── Mini grid card ────────────────────────────────────────────────────────────
function MiniCard({ pillar, index, anySelected, onClick, isDark }) {
  const Icon = pillar.icon
  const [hovered, setHovered] = useState(false)

  const cardBg = hovered
    ? (isDark ? `rgba(255,255,255,0.09)` : pillar.accent + '0D')
    : (isDark ? `rgba(255,255,255,0.04)` : `rgba(255,255,255,0.82)`)
  const titleColor = isDark ? '#ffffff' : '#0f172a'
  const descColor = isDark ? 'rgba(148,163,184,0.85)' : 'rgba(51,65,85,0.85)'
  const bulletColor = isDark ? 'rgba(148,163,184,0.75)' : 'rgba(71,85,105,0.85)'

  return (
    <motion.div
      layoutId={`card-${pillar.id}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
      animate={{
        opacity: anySelected ? 0.22 : 1,
        y: 0,
        scale: anySelected ? 0.97 : hovered ? 1.018 : 1,
        filter: anySelected ? 'blur(2px)' : 'blur(0px)',
      }}
      transition={{
        layout: { type: 'spring', stiffness: 360, damping: 30 },
        opacity: { duration: 0.3 },
        filter: { duration: 0.3 },
        scale: { type: 'spring', stiffness: 300, damping: 22 },
        y: { delay: index * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      }}
      className="relative rounded-2xl cursor-pointer overflow-hidden flex flex-col"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: cardBg,
        border: `1px solid ${hovered ? pillar.accent + '55' : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)')}`,
        boxShadow: hovered ? `0 8px 40px ${pillar.glow}, 0 0 0 1px ${pillar.accent}20` : (isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)'),
        transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
        minHeight: 380,
      }}
    >
      {/* Top accent bar */}
      <motion.div
        className="absolute top-0 left-0 right-0"
        style={{ height: hovered ? 3 : 2, background: pillar.accent, transition: 'height 0.2s' }}
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: index * 0.07 + 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Inner glow on hover */}
      {hovered && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 80% 45% at 50% 0%, ${pillar.dim} 0%, transparent 65%)`,
        }} />
      )}

      <div className="relative flex flex-col h-full p-5">
        {/* Icon + tag row */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
            background: `${pillar.accent}18`,
            border: `1px solid ${pillar.accent}35`,
          }}>
            <Icon size={17} style={{ color: pillar.accent }} />
          </div>
          <span className="text-[9px] font-black tracking-[0.2em] uppercase px-2.5 py-1 rounded-full" style={{
            color: pillar.accent,
            background: `${pillar.accent}15`,
            border: `1px solid ${pillar.accent}30`,
          }}>
            {pillar.tag}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-[17px] font-black tracking-tight leading-tight mb-2" style={{ color: pillar.accent }}>
          {pillar.title}
        </h2>

        {/* Full description */}
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: descColor }}>
          {pillar.description}
        </p>

        {/* Highlight bullets */}
        <ul className="space-y-1.5 flex-1">
          {pillar.highlights.map((h) => (
            <li key={h} className="flex items-center gap-2 text-[11px]" style={{ color: bulletColor }}>
              <ChevronRight size={10} style={{ color: pillar.accent, flexShrink: 0 }} />
              {h}
            </li>
          ))}
        </ul>

        {/* Launch button */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); onClick() }}
          className="mt-auto pt-4 flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all"
          style={{
            background: `${pillar.accent}18`,
            border: `1px solid ${pillar.accent}40`,
            color: pillar.accent,
          }}
          whileHover={{ background: `${pillar.accent}30`, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          Launch {pillar.title}
          <ArrowRight size={12} />
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── Hero expanded card ────────────────────────────────────────────────────────
function HeroCard({ pillar, onClose, onLaunch, isDark }) {
  const Icon = pillar.icon
  const cardBg = isDark ? 'rgba(10,11,18,0.97)' : 'rgba(255,255,255,0.97)'
  const textColor = isDark ? '#ffffff' : '#0f172a'
  const descColor = isDark ? 'rgba(148,163,184,0.9)' : 'rgba(51,65,85,0.9)'
  const highlightText = isDark ? '#e2e8f0' : '#1e293b'
  const highlightBg = (accent) => isDark ? `${accent}0e` : `${accent}12`
  const highlightBorder = (accent) => isDark ? `${accent}25` : `${accent}40`
  const closeBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
  const closeBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
  const launchTextColor = isDark ? '#08090f' : '#ffffff'

  return (
    <motion.div
      layoutId={`card-${pillar.id}`}
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: cardBg,
        border: `1px solid ${pillar.accent}45`,
        backdropFilter: 'blur(48px)',
        WebkitBackdropFilter: 'blur(48px)',
        boxShadow: `0 0 90px ${pillar.glow}, 0 0 240px ${pillar.dim}, inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
        maxWidth: 700,
        width: '100%',
      }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
    >
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{
        background: `linear-gradient(90deg, transparent 0%, ${pillar.accent} 30%, ${pillar.accent} 70%, transparent 100%)`,
      }} />

      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 90% 45% at 50% 0%, ${pillar.dim} 0%, transparent 65%)`,
      }} />

      {/* Close */}
      <motion.button
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        onClick={onClose}
        className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all"
        style={{ background: closeBg, border: `1px solid ${closeBorder}` }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.93 }}
      >
        <X size={13} style={{ color: isDark ? '#94a3b8' : '#475569' }} />
      </motion.button>

      <div className="relative p-10">
        {/* Header row */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="flex items-start gap-5 mb-7"
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{
            background: `${pillar.accent}1a`,
            border: `1px solid ${pillar.accent}45`,
            boxShadow: `0 0 28px ${pillar.glow}`,
          }}>
            <Icon size={26} style={{ color: pillar.accent }} />
          </div>
          <div>
            <span className="text-[9px] font-black tracking-[0.25em] uppercase block mb-2" style={{ color: pillar.accent, opacity: 0.8 }}>
              {pillar.tag}
            </span>
            <h2 className="text-[32px] font-black tracking-tight leading-none" style={{ color: textColor }}>
              {pillar.title}
            </h2>
          </div>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.11 }}
          className="text-[13px] leading-relaxed mb-8"
          style={{ color: descColor }}
        >
          {pillar.description}
        </motion.p>

        {/* Highlights grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-2.5 mb-9"
        >
          {pillar.highlights.map((h, i) => (
            <motion.div
              key={h}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 + i * 0.05 }}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
              style={{
                background: highlightBg(pillar.accent),
                border: `1px solid ${highlightBorder(pillar.accent)}`,
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pillar.accent }} />
              <span className="text-[12px] font-medium" style={{ color: highlightText }}>{h}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Launch button */}
        <div className="flex justify-center">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
          onClick={onLaunch}
          className="flex items-center gap-3 px-8 py-3.5 rounded-xl font-black text-sm tracking-wide transition-all"
          style={{
            background: pillar.accent,
            color: launchTextColor,
            boxShadow: `0 0 36px ${pillar.glow}`,
          }}
          whileHover={{ scale: 1.04, boxShadow: `0 0 52px ${pillar.glow}` }}
          whileTap={{ scale: 0.97 }}
        >
          <ArrowRight size={15} />
          Launch {pillar.title}
        </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main V2 home view ─────────────────────────────────────────────────────────
export function HomeViewV2() {
  const { state, dispatch } = useAppContext()
  const [selected, setSelected] = useState(null)

  const selectedPillar = PILLARS.find(p => p.id === selected)

  const navigate = (viewId) => dispatch({ type: 'SET_VIEW', payload: viewId })
  const handleSelect = (id) => setSelected(id)
  const handleClose = () => setSelected(null)
  const handleLaunch = () => { if (selected) navigate(selected) }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelected(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Allow normal page scroll for this view (globals.css sets overflow:hidden on root)
  useEffect(() => {
    const root = document.getElementById('root')
    const prev = root?.style.overflow || ''
    if (root) root.style.overflow = 'auto'
    return () => { if (root) root.style.overflow = prev }
  }, [])

  return (
    <div className="flex flex-col min-h-screen w-screen bg-base-950 grid-bg relative select-none" style={{ overflowY: 'auto', overflowX: 'hidden' }}>

      {/* ── Ambient color spotlight when a card is selected ── */}
      <AnimatePresence>
        {selectedPillar && (
          <motion.div
            key={selectedPillar.id}
            className="absolute inset-0 pointer-events-none z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              background: `radial-gradient(ellipse 65% 55% at 50% 50%, ${selectedPillar.dim} 0%, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Header (identical to original) ── */}
      <header className="relative z-10 flex items-center px-8 py-4 border-b border-white/10 bg-base-900/60 backdrop-blur-md flex-shrink-0">
        {/* Left: app identity */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
            <Shield size={18} className="text-emerald-400" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-[0.15em] text-emerald-400">SUDO AIRS Demo</span>
            <span className="text-[9px] tracking-[0.15em] text-slate-500 uppercase">Prisma AIRS · Command</span>
          </div>
        </div>

        {/* Center: logo + author credits */}
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <div className={state.isDark ? '' : 'bg-slate-600 px-4 py-1.5 rounded-xl'}>
            <img src={airsLogo} alt="Prisma AIRS" className="h-7 opacity-90" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15">
            <span className="text-[11px] font-bold text-slate-300">Sergei (SUDO) Udovenko</span>
            <span className="text-slate-600 text-[10px]">·</span>
            <span className="text-[10px] text-slate-500">Systems Engineer · Palo Alto Networks</span>
          </div>
        </div>

        {/* Right: byline + theme toggle */}
        <div className="flex items-center justify-end gap-3 flex-1">
          <span className="text-[10px] tracking-widest text-slate-600 uppercase">Palo Alto Networks</span>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
            className="p-2 rounded-lg border border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
            title={state.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {state.isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* ── Hero headline ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center text-center px-8 pt-8 pb-6 flex-shrink-0"
      >
        <h1 className="text-4xl font-black tracking-tight text-white mb-3">
          SUDO AIRS Demo
        </h1>

        <p className="max-w-xl text-sm text-slate-400 leading-relaxed">
          An interactive demo portal showing how{' '}
          <span className="text-white font-medium">Prisma AI Runtime Security (AIRS)</span> protects
          AI applications from real-world attacks. Toggle protection on/off to see the difference
          between a secured and vulnerable deployment — using live LLMs across{' '}
          <span className="text-white font-medium">Google Vertex AI</span>,{' '}
          <span className="text-white font-medium">AWS Bedrock</span>, and{' '}
          <span className="text-white font-medium">Azure OpenAI</span>.
        </p>

        <p className="mt-2 text-[11px] text-slate-600">
          Click any card to expand · Launch to enter the demo
        </p>
      </motion.div>

      {/* ── 3×2 Grid ── */}
      <div className="relative z-10 px-8 pb-8 max-w-[1280px] mx-auto w-full">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
        >
          {PILLARS.map((pillar, i) => (
            <MiniCard
              key={pillar.id}
              pillar={pillar}
              index={i}
              anySelected={!!selected}
              onClick={() => handleSelect(pillar.id)}
              isDark={state.isDark}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="relative z-10 flex items-center justify-center pb-3 flex-shrink-0"
      >
        <div className="flex items-center gap-1.5">
          <Shield size={10} className="text-slate-700" />
          <span className="text-[9px] text-slate-700 tracking-widest uppercase font-medium">
            Palo Alto Networks · Prisma AIRS Demo
          </span>
        </div>
      </motion.footer>

      {/* ── Expanded hero overlay ── */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Dim backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-20"
              style={{ background: 'rgba(5,6,12,0.72)', backdropFilter: 'blur(3px)' }}
              onClick={handleClose}
            />

            {/* Hero card — centered */}
            <div className="fixed inset-0 z-30 flex items-center justify-center p-8 pointer-events-none">
              <div className="pointer-events-auto w-full flex justify-center">
                {selectedPillar && (
                  <HeroCard
                    pillar={selectedPillar}
                    onClose={handleClose}
                    onLaunch={handleLaunch}
                    isDark={state.isDark}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
