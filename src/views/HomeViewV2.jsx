import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import {
  Crosshair, ScanSearch, Swords, Terminal, BarChart2, Code2,
  ChevronRight, X, ArrowUpRight, Shield,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import airsLogo from '../../prisma-AIRS_RGB_logo_Lockup_Negative.png'

// ─── Pillar data ───────────────────────────────────────────────────────────────
const PILLARS = [
  {
    id: 'apiIntercept',
    icon: Crosshair,
    title: 'API Intercept',
    tag: 'Runtime Protection',
    summary: 'Intercept & block malicious prompts before they reach your model.',
    description: 'Simulate real-world prompt injection, jailbreak, and data exfiltration attacks against live LLM endpoints. Toggle AIRS protection on/off to see exactly how Prisma AIRS intercepts malicious payloads at the API layer.',
    highlights: ['Prompt injection detection', 'Jailbreak prevention', 'Input / output scanning', 'SCM deep-link telemetry'],
    accent: '#ef4444',
    glow: 'rgba(239,68,68,0.35)',
    dim: 'rgba(239,68,68,0.06)',
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
    glow: 'rgba(59,130,246,0.35)',
    dim: 'rgba(59,130,246,0.06)',
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
    glow: 'rgba(249,115,22,0.35)',
    dim: 'rgba(249,115,22,0.06)',
  },
  {
    id: 'claudeHooks',
    icon: Terminal,
    title: 'AI Code Assistant Protection',
    tag: 'IDE Security',
    summary: 'Secure AI coding assistants with zero-change hook-based scanning.',
    description: 'Secure the Claude Code CLI with AIRS hook scripts that scan every prompt, URL fetch, and MCP tool call in real time — before any content reaches the model. Zero code changes required.',
    highlights: ['Prompt injection blocking', 'DLP / data exfiltration detection', 'MCP & WebFetch scanning', 'Threat model with test cases'],
    accent: '#a855f7',
    glow: 'rgba(168,85,247,0.35)',
    dim: 'rgba(168,85,247,0.06)',
  },
  {
    id: 'observability',
    icon: BarChart2,
    title: 'LLM Telemetry',
    tag: 'Observability',
    summary: 'Full trace visibility — latency, tokens, threats, every prompt logged.',
    description: 'Full LLM observability layer that captures every prompt and response as a structured trace. Monitor latency, token usage, threat detection rates, and AIRS overhead in real time — with a searchable prompt history log.',
    highlights: ['Live pipeline flow traces', 'Latency & token analytics', 'Threat detection breakdown', 'Prompt history log'],
    accent: '#14b8a6',
    glow: 'rgba(20,184,166,0.35)',
    dim: 'rgba(20,184,166,0.06)',
  },
  {
    id: 'developerCorner',
    icon: Code2,
    title: 'Developer Corner',
    tag: 'Integration Guide',
    summary: 'Python SDK, REST API, and live integration code — ready to ship.',
    description: 'Complete Prisma AIRS integration reference for development teams — Python SDK, REST API, live code samples extracted from this portal, and full API explorer with all fields and error codes.',
    highlights: ['Python SDK (pan-aisecurity) — sync & async', 'REST API with real curl examples', 'Live code from this demo portal', 'Full API reference & detection services'],
    accent: '#818cf8',
    glow: 'rgba(129,140,248,0.35)',
    dim: 'rgba(129,140,248,0.06)',
  },
]

// ─── Background grid ───────────────────────────────────────────────────────────
function BackgroundGrid({ activeAccent }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base dark */}
      <div className="absolute inset-0" style={{ background: '#080a10' }} />

      {/* Dot grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }} />

      {/* Radial spotlight that shifts color based on selected pillar */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: activeAccent ? 1 : 0 }}
        transition={{ duration: 0.6 }}
        style={{
          background: activeAccent
            ? `radial-gradient(ellipse 70% 60% at 50% 50%, ${activeAccent}18 0%, transparent 70%)`
            : 'none',
        }}
      />

      {/* Ambient top-left leak */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full" style={{
        background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        filter: 'blur(40px)',
      }} />
      {/* Ambient bottom-right leak */}
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full" style={{
        background: 'radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)',
        filter: 'blur(40px)',
      }} />

      {/* Scanline overlay */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ─── Mini card (grid state) ────────────────────────────────────────────────────
function MiniCard({ pillar, index, isSelected, anySelected, onClick }) {
  const Icon = pillar.icon

  return (
    <motion.div
      layoutId={`card-${pillar.id}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 24 }}
      animate={{
        opacity: anySelected && !isSelected ? 0.28 : 1,
        y: 0,
        scale: anySelected && !isSelected ? 0.97 : 1,
        filter: anySelected && !isSelected ? 'blur(1.5px)' : 'blur(0px)',
      }}
      transition={{
        layout: { type: 'spring', stiffness: 380, damping: 30 },
        opacity: { duration: 0.3 },
        filter: { duration: 0.3 },
        y: { delay: index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
      }}
      whileHover={!anySelected ? { y: -4, scale: 1.02 } : {}}
      className="relative rounded-2xl cursor-pointer overflow-hidden group"
      style={{
        background: 'rgba(255,255,255,0.032)',
        border: `1px solid rgba(255,255,255,0.08)`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Top accent line */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: pillar.accent }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: index * 0.06 + 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{
        background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${pillar.dim} 0%, transparent 70%)`,
      }} />

      <div className="relative p-6 flex flex-col h-full min-h-[200px]">
        {/* Tag */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: pillar.accent, opacity: 0.8 }}>
            {pillar.tag}
          </span>
          <motion.div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${pillar.accent}18`, border: `1px solid ${pillar.accent}30` }}
            whileHover={{ scale: 1.1 }}
          >
            <Icon size={14} style={{ color: pillar.accent }} />
          </motion.div>
        </div>

        {/* Title */}
        <h3 className="text-[17px] font-black tracking-tight text-white leading-tight mb-2" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>
          {pillar.title}
        </h3>

        {/* Summary */}
        <p className="text-[12px] text-slate-500 leading-relaxed flex-1">
          {pillar.summary}
        </p>

        {/* CTA hint */}
        <div className="flex items-center gap-1.5 mt-4">
          <span className="text-[10px] font-bold tracking-wider" style={{ color: pillar.accent, opacity: 0.7 }}>
            EXPLORE
          </span>
          <ChevronRight size={10} style={{ color: pillar.accent, opacity: 0.7 }} />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Hero card (expanded state) ───────────────────────────────────────────────
function HeroCard({ pillar, onClose, onLaunch }) {
  const Icon = pillar.icon

  return (
    <motion.div
      layoutId={`card-${pillar.id}`}
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: 'rgba(8,10,16,0.92)',
        border: `1px solid ${pillar.accent}50`,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        boxShadow: `0 0 80px ${pillar.glow}, 0 0 200px ${pillar.dim}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        maxWidth: 680,
        width: '100%',
      }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
    >
      {/* Top accent line — thicker in hero */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{
        background: `linear-gradient(90deg, transparent, ${pillar.accent}, transparent)`,
      }} />

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 100% 50% at 50% 0%, ${pillar.dim} 0%, transparent 60%)`,
      }} />

      {/* Close button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        onClick={onClose}
        className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        whileHover={{ scale: 1.1, background: 'rgba(255,255,255,0.12)' }}
      >
        <X size={13} className="text-slate-400" />
      </motion.button>

      <div className="relative p-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="flex items-start gap-5 mb-8"
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{
            background: `${pillar.accent}18`,
            border: `1px solid ${pillar.accent}40`,
            boxShadow: `0 0 24px ${pillar.glow}`,
          }}>
            <Icon size={24} style={{ color: pillar.accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-black tracking-[0.25em] uppercase block mb-1.5" style={{ color: pillar.accent, opacity: 0.8 }}>
              {pillar.tag}
            </span>
            <h2 className="text-3xl font-black tracking-tight text-white leading-none" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>
              {pillar.title}
            </h2>
          </div>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="text-[14px] text-slate-400 leading-relaxed mb-8"
        >
          {pillar.description}
        </motion.p>

        {/* Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="grid grid-cols-2 gap-2.5 mb-10"
        >
          {pillar.highlights.map((h, i) => (
            <motion.div
              key={h}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 + i * 0.05 }}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
              style={{ background: `${pillar.accent}0d`, border: `1px solid ${pillar.accent}22` }}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pillar.accent }} />
              <span className="text-[12px] text-slate-300 font-medium">{h}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Launch button */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          onClick={onLaunch}
          className="flex items-center gap-3 px-8 py-3.5 rounded-xl font-bold text-sm transition-all"
          style={{
            background: pillar.accent,
            color: '#080a10',
            boxShadow: `0 0 32px ${pillar.glow}`,
          }}
          whileHover={{ scale: 1.03, boxShadow: `0 0 48px ${pillar.glow}` }}
          whileTap={{ scale: 0.97 }}
        >
          Launch {pillar.title}
          <ArrowUpRight size={16} />
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export function HomeViewV2() {
  const { state, dispatch } = useAppContext()
  const [selected, setSelected] = useState(null)

  const selectedPillar = PILLARS.find(p => p.id === selected)

  const navigate = useCallback((viewId) => {
    dispatch({ type: 'SET_VIEW', payload: viewId })
  }, [dispatch])

  const handleSelect = (id) => setSelected(id)
  const handleClose = () => setSelected(null)
  const handleLaunch = () => {
    if (selected) navigate(selected)
  }

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden select-none">
      <BackgroundGrid activeAccent={selectedPillar?.accent} />

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex items-center justify-between px-10 pt-8 pb-6 flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <img src={airsLogo} alt="Prisma AIRS" className="h-8 object-contain" />
        </div>

        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
          />
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500">
            AI Runtime Security
          </span>
        </div>

        <button
          onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
          className="text-[10px] font-bold tracking-wider text-slate-600 hover:text-slate-400 transition-colors uppercase"
        >
          {state.isDark ? 'Light' : 'Dark'}
        </button>
      </motion.header>

      {/* ── Headline ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center px-8 pb-6 flex-shrink-0"
      >
        <h1
          className="text-[42px] font-black tracking-tight leading-none text-white mb-2"
          style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif', letterSpacing: '-0.03em' }}
        >
          Secure Every AI Interaction
        </h1>
        <p className="text-[14px] text-slate-500 font-medium">
          Select a capability to explore · Click to expand · Launch to demo
        </p>
      </motion.div>

      {/* ── Grid ── */}
      <div className="relative z-10 flex-1 px-10 pb-8 overflow-hidden">
        <div className="grid grid-cols-3 gap-4 h-full" style={{ gridTemplateRows: '1fr 1fr' }}>
          {PILLARS.map((pillar, i) => (
            <MiniCard
              key={pillar.id}
              pillar={pillar}
              index={i}
              isSelected={selected === pillar.id}
              anySelected={!!selected}
              onClick={() => handleSelect(pillar.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Hero overlay ── */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 z-20"
              style={{ background: 'rgba(8,10,16,0.6)', backdropFilter: 'blur(2px)' }}
              onClick={handleClose}
            />

            {/* Hero card centered */}
            <div className="absolute inset-0 z-30 flex items-center justify-center p-8 pointer-events-none">
              <div className="pointer-events-auto w-full flex justify-center">
                {selectedPillar && (
                  <HeroCard
                    pillar={selectedPillar}
                    onClose={handleClose}
                    onLaunch={handleLaunch}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Footer ── */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="relative z-10 flex items-center justify-center pb-4 flex-shrink-0"
      >
        <div className="flex items-center gap-1.5">
          <Shield size={10} className="text-slate-700" />
          <span className="text-[9px] text-slate-700 tracking-widest uppercase font-medium">
            Palo Alto Networks · Prisma AIRS Demo
          </span>
        </div>
      </motion.footer>
    </div>
  )
}
