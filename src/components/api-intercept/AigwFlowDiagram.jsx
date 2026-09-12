import React from 'react'
import { motion } from 'framer-motion'

/**
 * AigwFlowDiagram — the opening frame of an SCM AI-GW session.
 *
 * The other three backends are one hop: app → provider. This one has five
 * enforcement points across two loops, and an audience cannot follow the demo
 * without seeing the shape first. So the empty state is the architecture.
 *
 * Hand-built SVG rather than a raster: it stays crisp on a projector, scales to
 * the panel, and — the part a picture cannot do — it reflects the live toggles.
 * Turn AIRS off and the four scan boxes go grey and dashed with BYPASSED on
 * them; turn MCP off and the whole lower loop dims out. What the room sees is
 * always what the next prompt will actually do.
 *
 * Rendered on a forced-dark panel in both app themes, matching the hero
 * treatment of FlowArchitectureDiagram in the LLM Gateway overview.
 */

const PINK   = '#EC4899' // AIRS / the gateway itself
const PURPLE = '#8B5CF6' // the model
const SLATE  = '#94A3B8' // client + neutral
const GREEN  = '#10B981' // MCP, brokered
const AMBER  = '#F59E0B' // reached directly — outside the gateway
const OFF    = '#64748B' // a bypassed control

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const SANS = 'Inter, ui-sans-serif, system-ui, sans-serif'

// Routing is shown for EVERY server, because brokered-vs-direct is the whole
// point of the row. GitHub's read-only scope is an extra chip, not a
// replacement for its routing — an earlier version showed only READ-ONLY and
// silently implied GitHub bypassed the gateway.
const SERVERS = [
  { name: 'Hugging Face', meta: 'models · datasets',     color: '#FFD21E', route: 'VIA AI-GW', routeColor: PINK },
  { name: 'GitHub',       meta: 'repos · issues · code', color: '#C9D1D9', route: 'VIA AI-GW', routeColor: PINK, extra: 'READ-ONLY', extraColor: GREEN },
  { name: 'CoinGecko',    meta: 'live market data',      color: '#8DC647', route: 'DIRECT',    routeColor: AMBER },
]

export function AigwFlowDiagram({ isProtected, mcpEnabled, model }) {
  const airs = isProtected ? PINK : OFF
  const modelShort = String(model || '').split('/').pop() || 'bedrock model'

  /** Rounded node with a title and an optional sub-label. */
  const Node = ({ cx, cy, w, h, title, sub, color, dashed, titleSize = 11.5 }) => (
    <g>
      <rect
        x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={9}
        fill={color} fillOpacity={0.11}
        stroke={color} strokeOpacity={dashed ? 0.45 : 0.65}
        strokeWidth={1.3} strokeDasharray={dashed ? '5 3' : undefined}
      />
      <text x={cx} y={sub ? cy - 1 : cy + titleSize / 3} textAnchor="middle"
            fontFamily={MONO} fontSize={titleSize} fontWeight={700} fill={color}>
        {title}
      </text>
      {sub && (
        <text x={cx} y={cy + 12} textAnchor="middle" fontFamily={SANS} fontSize={8.5} fill={SLATE} opacity={0.85}>
          {sub}
        </text>
      )}
    </g>
  )

  /** A dot that rides the path, so the direction of travel is never ambiguous. */
  const Packet = ({ path, color, dur, delay = 0, r = 3.5 }) => (
    <circle r={r} fill={color}>
      <animateMotion path={path} dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;1;1;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
    </circle>
  )

  // Lower loop, as one continuous path so the packet never teleports.
  const LOOP = 'M530,136 C500,220 300,232 190,306 L190,330 L400,330 L720,330 L855,330 L930,330 L930,306 C962,222 742,228 594,138'
  const mcpOpacity = mcpEnabled ? 1 : 0.24

  return (
    <div
      className="rounded-2xl p-4 overflow-x-auto"
      style={{
        background: 'radial-gradient(120% 130% at 50% 28%, #16182e 0%, #090c17 74%)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <svg viewBox="0 0 1120 470" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: 760 }}>
        <defs>
          <radialGradient id="afd-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={PURPLE} stopOpacity="0.45" />
            <stop offset="70%" stopColor={PURPLE} stopOpacity="0" />
          </radialGradient>
          {[['afd-slate', SLATE], ['afd-pink', PINK], ['afd-purple', PURPLE], ['afd-green', GREEN], ['afd-off', OFF]].map(([id, c]) => (
            <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M0,0 L6,3.5 L0,7 Z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* ── The gateway envelope. Everything inside it is brokered by the SCM
               AI Gateway; anything outside is not. ── */}
        <rect x={232} y={54} width={664} height={112} rx={14}
              fill={PINK} fillOpacity={0.04} stroke={PINK} strokeOpacity={0.3}
              strokeWidth={1.2} strokeDasharray="6 4" />
        <text x={248} y={44} fontFamily={SANS} fontSize={9.5} fontWeight={800} letterSpacing="1.3" fill={PINK}>
          SCM AI GATEWAY · aigw.portkey.ai
        </text>
        <text x={880} y={44} textAnchor="end" fontFamily={MONO} fontSize={8.5} fill={SLATE} opacity={0.75}>
          {isProtected ? 'config: AIGW_CONFIG_PROTECTED' : 'config: AIGW_CONFIG_UNPROTECTED'}
        </text>

        {/* ── Chat path ── */}
        <g fill="none" strokeLinecap="round">
          <path d="M154,110 L241,110" stroke={SLATE} strokeOpacity={0.55} strokeWidth={2} markerEnd="url(#afd-slate)" />
          <path d="M393,110 L476,110" stroke={airs} strokeOpacity={0.75} strokeWidth={2.2} markerEnd={`url(#${isProtected ? 'afd-pink' : 'afd-off'})`} />
          <path d="M648,110 L725,110" stroke={PURPLE} strokeOpacity={0.75} strokeWidth={2.2} markerEnd="url(#afd-purple)" />
          <path d="M883,110 L964,110" stroke={airs} strokeOpacity={0.75} strokeWidth={2.2} markerEnd={`url(#${isProtected ? 'afd-pink' : 'afd-off'})`} />
        </g>
        <Packet path="M154,110 L1036,110" color={isProtected ? PINK : SLATE} dur={4.2} />

        <Node cx={88}  cy={110} w={132} h={44} title="CLIENT" sub="Intercept Console" color={SLATE} />
        <Node cx={317} cy={110} w={152} h={46}
              title={isProtected ? 'AIRS GUARDRAIL' : 'NO GUARDRAIL'}
              sub={isProtected ? 'prompt scan' : 'BYPASSED — AIRS is off'}
              color={airs} dashed={!isProtected} titleSize={10.5} />

        <circle cx={562} cy={110} r={62} fill="url(#afd-glow)" />
        <Node cx={562} cy={110} w={172} h={52} title="LLM" sub={modelShort} color={PURPLE} titleSize={13} />
        <text x={562} y={152} textAnchor="middle" fontFamily={MONO} fontSize={8} fill={SLATE} opacity={0.7}>@sudo-bedrock</text>

        <Node cx={804} cy={110} w={152} h={46}
              title={isProtected ? 'AIRS GUARDRAIL' : 'NO GUARDRAIL'}
              sub={isProtected ? 'response scan' : 'BYPASSED — AIRS is off'}
              color={airs} dashed={!isProtected} titleSize={10.5} />
        <Node cx={1036} cy={110} w={132} h={44} title="ANSWER" sub="to the user" color={SLATE} />

        {/* ── MCP tool loop ── */}
        <g opacity={mcpOpacity}>
          <g fill="none" strokeLinecap="round">
            <path d="M530,136 C500,220 300,232 190,306" stroke={GREEN} strokeOpacity={0.6} strokeWidth={2} markerEnd="url(#afd-green)" />
            <path d="M265,330 L394,330" stroke={GREEN} strokeOpacity={0.6} strokeWidth={2} markerEnd="url(#afd-green)" />
            <path d="M720,330 L849,330" stroke={GREEN} strokeOpacity={0.6} strokeWidth={2} markerEnd="url(#afd-green)" />
            <path d="M930,306 C962,222 742,228 594,138" stroke={GREEN} strokeOpacity={0.6} strokeWidth={2} markerEnd="url(#afd-green)" />
          </g>
          {mcpEnabled && <Packet path={LOOP} color={GREEN} dur={6} delay={1.2} />}

          <text x={352} y={196} textAnchor="middle" fontFamily={MONO} fontSize={9} fontWeight={700} fill={GREEN} opacity={0.9}>
            tool_use
          </text>
          <text x={790} y={196} textAnchor="middle" fontFamily={MONO} fontSize={9} fontWeight={700} fill={GREEN} opacity={0.9}>
            tool result
          </text>

          <Node cx={190} cy={330} w={150} h={48}
                title={isProtected ? 'AIRS · STAGE 1' : 'STAGE 1 OFF'}
                sub={isProtected ? 'tool parameters' : 'not scanned'}
                color={airs} dashed={!isProtected} titleSize={10.5} />
          <Node cx={930} cy={330} w={150} h={48}
                title={isProtected ? 'AIRS · STAGE 2' : 'STAGE 2 OFF'}
                sub={isProtected ? 'tool result' : 'not scanned'}
                color={airs} dashed={!isProtected} titleSize={10.5} />

          {/* Server panel */}
          <rect x={400} y={268} width={320} height={124} rx={12}
                fill={GREEN} fillOpacity={0.07} stroke={GREEN} strokeOpacity={0.4} strokeWidth={1.3} />
          <text x={416} y={288} fontFamily={SANS} fontSize={9.5} fontWeight={800} letterSpacing="1.1" fill={GREEN}>
            MCP SERVERS
          </text>
          {/* The manifest scan happens once per server, before any description
              reaches the model — that is the tool-poisoning control. */}
          <g>
            <rect x={566} y={277} width={140} height={15} rx={7.5}
                  fill={airs} fillOpacity={0.16} stroke={airs} strokeOpacity={0.45} strokeWidth={0.9} />
            <text x={636} y={288} textAnchor="middle" fontFamily={MONO} fontSize={7.5} fontWeight={700} fill={airs}>
              {isProtected ? 'tools/list AIRS-scanned' : 'tools/list not scanned'}
            </text>
          </g>
          {SERVERS.map((s, i) => {
            const y = 312 + i * 26
            // Chips are laid out right-to-left from the panel edge so a server
            // with one chip and a server with two still line up.
            const RIGHT = 708
            const rw = s.route === 'DIRECT' ? 48 : 62
            const rx = RIGHT - rw
            const ew = 62
            const ex = rx - 5 - ew
            return (
              <g key={s.name}>
                <circle cx={418} cy={y - 3.5} r={3} fill={s.color} />
                <text x={430} y={y} fontFamily={SANS} fontSize={10.5} fontWeight={700} fill="#E2E8F0">{s.name}</text>
                <text x={430} y={y + 10} fontFamily={SANS} fontSize={8} fill={SLATE} opacity={0.8}>{s.meta}</text>
                {s.extra && (
                  <g>
                    <rect x={ex} y={y - 11} width={ew} height={14} rx={5}
                          fill={s.extraColor} fillOpacity={0.18} stroke={s.extraColor} strokeOpacity={0.45} strokeWidth={0.8} />
                    <text x={ex + ew / 2} y={y - 1} textAnchor="middle" fontFamily={MONO}
                          fontSize={7.5} fontWeight={800} fill={s.extraColor}>{s.extra}</text>
                  </g>
                )}
                <rect x={rx} y={y - 11} width={rw} height={14} rx={5}
                      fill={s.routeColor} fillOpacity={0.18} stroke={s.routeColor} strokeOpacity={0.45} strokeWidth={0.8} />
                <text x={rx + rw / 2} y={y - 1} textAnchor="middle" fontFamily={MONO}
                      fontSize={7.5} fontWeight={800} fill={s.routeColor}>{s.route}</text>
              </g>
            )
          })}
        </g>

        {!mcpEnabled && (
          <text x={560} y={420} textAnchor="middle" fontFamily={SANS} fontSize={10} fill={SLATE} opacity={0.85}>
            MCP tool calling is off — turn it on in the left panel to let the model reach these servers.
          </text>
        )}

        {/* ── Footer: where the evidence lands ── */}
        <g opacity={0.9}>
          <text x={26} y={451} fontFamily={SANS} fontSize={9} fill={SLATE}>
            {isProtected
              ? 'Every hop above is inspected — prompt, response, tool parameters, tool results, and the tool manifest itself.'
              : 'AIRS is off: nothing on this diagram is inspected. Turn protection on to see the controls engage.'}
          </text>
          <text x={1094} y={451} textAnchor="end" fontFamily={MONO} fontSize={8.5} fill={PINK} opacity={0.85}>
            scans → SUDO-Personal · TSG 1698236796
          </text>
        </g>
      </svg>
    </div>
  )
}

/** Wrapper with the heading, so ChatCenter's empty state stays declarative. */
export function AigwWelcome({ isProtected, mcpEnabled, model }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="px-5 pb-4"
    >
      <div className="mb-3">
        <p className="text-[10px] font-black tracking-[0.14em] mb-1" style={{ color: PINK }}>
          SCM AI GATEWAY · SESSION ARCHITECTURE
        </p>
        <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 leading-tight">
          One control point, five checkpoints
        </h3>
        <p className="text-[11px] leading-relaxed mt-1 text-slate-600 dark:text-slate-400 max-w-3xl">
          On this backend the guardrail runs <strong>inside the gateway</strong> rather than as an API-layer scan, and
          the model can call live MCP servers. Follow the path: the prompt is inspected on the way in, the model may
          loop out to a tool, that tool&rsquo;s parameters and its result are each scanned before the model reads them,
          and the answer is inspected on the way back.
        </p>
      </div>
      <AigwFlowDiagram isProtected={isProtected} mcpEnabled={mcpEnabled} model={model} />
    </motion.div>
  )
}
