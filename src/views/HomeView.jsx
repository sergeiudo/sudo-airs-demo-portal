import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Crosshair, ScanSearch, Swords, Shield, ArrowRight, ChevronRight, Terminal, Sun, Moon, BarChart2 } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import airsLogo from '../../prisma-AIRS_RGB_logo_Lockup_Negative.png'

const PILLARS = [
  {
    id: 'apiIntercept',
    icon: Crosshair,
    title: 'API Intercept',
    tag: 'Runtime Protection',
    color: 'red',
    description:
      'Simulate real-world prompt injection, jailbreak, and data exfiltration attacks against live LLM endpoints. Toggle AIRS protection on/off to see exactly how Prisma AIRS intercepts malicious payloads at the API layer — before they reach the model.',
    highlights: ['Prompt injection detection', 'Jailbreak prevention', 'Input / output scanning', 'SCM deep-link telemetry'],
  },
  {
    id: 'modelScanning',
    icon: ScanSearch,
    title: 'Model Scanning',
    tag: 'Supply-Chain Security',
    color: 'blue',
    description:
      'Scan AI model artifacts for embedded malware, backdoors, and serialisation vulnerabilities (pickle exploits, unsafe tensors) before they are deployed. Supports local file uploads and HuggingFace model URIs.',
    highlights: ['Pickle / safetensor analysis', 'HuggingFace model scanning', 'CVE vulnerability mapping', 'Detailed rule-violation reports'],
  },
  {
    id: 'redTeaming',
    icon: Swords,
    title: 'Red Teaming',
    tag: 'Adversarial Testing',
    color: 'orange',
    description:
      'Run automated adversarial campaigns across multiple attack categories — DAN variants, role-play escapes, multi-turn manipulation, and more. Track robustness scores in real time and compare protected vs unprotected model behaviour.',
    highlights: ['Multi-category attack campaigns', 'Real-time robustness gauge', 'Attack log feed', 'Campaign state management'],
  },
  {
    id: 'claudeHooks',
    icon: Terminal,
    title: 'AI Code Assistant Protection',
    tag: 'IDE Security',
    color: 'purple',
    description:
      'Secure the Claude Code CLI with AIRS hook scripts that scan every prompt, URL fetch, and MCP tool call in real time — before any content reaches the model. Zero code changes required.',
    highlights: ['Prompt injection blocking', 'DLP / data exfiltration detection', 'MCP & WebFetch scanning', 'Threat model with test cases'],
  },
  {
    id: 'observability',
    icon: BarChart2,
    title: 'LLM Telemetry',
    tag: 'Observability',
    color: 'teal',
    description:
      'Full LLM observability layer that captures every prompt and response as a structured trace. Monitor latency, token usage, threat detection rates, and AIRS overhead in real time — with a searchable prompt history log.',
    highlights: ['Live pipeline flow traces', 'Latency & token analytics', 'Threat detection breakdown', 'Prompt history log'],
  },
]

const COLOR_MAP = {
  red:    { text: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10',    tag: 'bg-red-500/15 text-red-400',    btn: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30',    hoverBg: 'rgba(239,68,68,0.08)',    hoverBorder: 'rgba(239,68,68,0.40)' },
  blue:   { text: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   tag: 'bg-blue-500/15 text-blue-400',   btn: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30',   hoverBg: 'rgba(59,130,246,0.08)',   hoverBorder: 'rgba(59,130,246,0.40)' },
  orange: { text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', tag: 'bg-orange-500/15 text-orange-400', btn: 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/30', hoverBg: 'rgba(249,115,22,0.08)', hoverBorder: 'rgba(249,115,22,0.40)' },
  purple: { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', tag: 'bg-purple-500/15 text-purple-400', btn: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/30', hoverBg: 'rgba(168,85,247,0.08)', hoverBorder: 'rgba(168,85,247,0.40)' },
  teal:   { text: 'text-teal-400',   border: 'border-teal-500/30',   bg: 'bg-teal-500/10',   tag: 'bg-teal-500/15 text-teal-400',   btn: 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-teal-500/30',   hoverBg: 'rgba(20,184,166,0.08)',   hoverBorder: 'rgba(20,184,166,0.40)' },
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const itemVariants = {
  hidden:  { opacity: 0, y: 24, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } },
}

function PillarCard({ pillar, c, navigate }) {
  const [hovered, setHovered] = useState(false)
  const Icon = pillar.icon

  return (
    <motion.div
      variants={itemVariants}
      onClick={() => navigate(pillar.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ scale: hovered ? 1.04 : 1, y: hovered ? -4 : 0 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group flex flex-col rounded-xl border backdrop-blur-md p-6 cursor-pointer shadow-sm transition-shadow duration-200"
      style={{
        borderColor: hovered ? c.hoverBorder : undefined,
        backgroundColor: hovered ? c.hoverBg : undefined,
        boxShadow: hovered ? `0 8px 32px ${c.hoverBg}` : undefined,
      }}
    >
      {/* Icon + tag */}
      <div className="flex items-start justify-between mb-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg border ${c.border} ${c.bg}`}>
          <Icon size={18} className={c.text} strokeWidth={1.8} />
        </div>
        <span className={`text-[9px] font-semibold tracking-widest uppercase px-2 py-1 rounded-full border ${c.border} ${c.bg} ${c.text}`}>
          {pillar.tag}
        </span>
      </div>

      {/* Title */}
      <h2 className={`text-lg font-bold ${c.text} mb-2`}>{pillar.title}</h2>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed flex-1">{pillar.description}</p>

      {/* Highlights */}
      <ul className="mt-4 space-y-1.5">
        {pillar.highlights.map((h) => (
          <li key={h} className="flex items-center gap-2 text-[11px] text-slate-500">
            <ChevronRight size={10} className={c.text} />
            {h}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button className={`mt-5 flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${c.btn}`}>
        Launch {pillar.title}
        <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
      </button>
    </motion.div>
  )
}

export function HomeView() {
  const { state, dispatch } = useAppContext()

  const navigate = (viewId) => dispatch({ type: 'SET_VIEW', payload: viewId })

  return (
    <div className="flex flex-col h-screen w-screen overflow-auto bg-base-950 grid-bg">
      {/* Top bar */}
      <header className="flex items-center px-8 py-4 border-b border-white/10 bg-base-900/60 backdrop-blur-md flex-shrink-0">
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

        {/* Center: Prisma AIRS logo + author */}
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

        {/* Right: theme toggle + byline */}
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

      {/* Hero */}
      <motion.div
        className="flex flex-col items-center text-center px-8 pt-14 pb-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-semibold tracking-widest text-emerald-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Prisma AI Runtime Security
          </span>
        </motion.div>

        <motion.h1 variants={itemVariants} className="text-4xl font-bold text-white tracking-tight max-w-2xl">
          SUDO AIRS Demo
        </motion.h1>

        <motion.p variants={itemVariants} className="mt-4 max-w-xl text-sm text-slate-400 leading-relaxed">
          An interactive security demonstration showing how <span className="text-white font-medium">Prisma AIRS</span> protects
          AI applications across five pillars — runtime API interception, model supply-chain scanning, automated red teaming,
          Claude Code CLI protection, and full LLM telemetry. Toggle protection on and off to see the difference in real time.
        </motion.p>
      </motion.div>

      {/* Pillar cards */}
      <motion.div
        className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 px-8 pb-12 max-w-[1600px] mx-auto w-full"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {PILLARS.map((pillar) => {
          const c = COLOR_MAP[pillar.color]
          return <PillarCard key={pillar.id} pillar={pillar} c={c} navigate={navigate} />
        })}
      </motion.div>

      {/* Footer */}
    </div>
  )
}
