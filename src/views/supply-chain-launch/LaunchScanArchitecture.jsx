import React, { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Link2, FileBox, Cpu, ShieldCheck, ShieldX, AlertTriangle, Workflow, Biohazard, Scale, FileSearch,
} from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { useGeometry, pt, hCurve, arcBack, Markers, Wire, Packet, WirePill, Node, TrayLabel } from '../runtime-launch/diagramKit'

/**
 * LaunchScanArchitecture — the empty AI Supply Chain console, in the launch
 * design: HTML cards and measured wires (diagramKit), like LaunchArchitecture.
 *
 * Same story as ScanArchitecture (which the v1 console keeps), verified in the
 * SDK source: a Hugging Face scan sends only the URI and AIRS reads the repo
 * itself; a local scan runs on this host and sends file hashes and findings,
 * never the artifact. Both meet the same security group, where the verdict is
 * decided — and the verdict comes before anything loads the model.
 *
 * Live: the source toggle lights its lane and dims the other; a scanner that is
 * down or in stub mode turns the SDK into a dashed "Scanner down" and stops
 * the packets. Colours follow the console: blue is this app, green is AIRS
 * inspecting, amber a fault, vermilion only the block path.
 */

const HF = '#FFD21E' // Hugging Face's yellow — identity, not state

const COLS = 'minmax(0,1fr) minmax(34px,0.22fr) minmax(0,1fr) minmax(34px,0.22fr) minmax(0,2.2fr) minmax(38px,0.28fr) minmax(0,1fr)'

const THREATS = ['code exec on load', 'runtime code exec', 'suspicious components']
const POLICY = ['license', 'verified publisher', 'approved format']

// Why the gate sits before the load, in the three terms an audience weighs.
const GATE = [
  { icon: Biohazard,  title: 'Security',   text: 'A pickle or Keras payload runs the moment the model is loaded — the check has to come first.' },
  { icon: Scale,      title: 'Governance', text: 'License, publisher and file-format rules are enforced by the security group, not left to review.' },
  { icon: FileSearch, title: 'Evidence',   text: 'Every verdict is a scan record in Strata Cloud Manager, down to the file, hash and rule that fired.' },
]

function RulePills({ t, title, tone, items, off }) {
  const ink = t.isLight ? shade(tone, 0.3) : tone
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="rounded-full" style={{ width: 6, height: 6, background: off ? t.inkFaint : tone }} aria-hidden="true" />
        <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: off ? t.inkDim : ink }}>{title}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((k) => (
          <span key={k} className="rounded-full px-2"
                style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: '18px', color: off ? t.inkDim : ink, background: off ? t.sunken : `${tone}14` }}>
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}

export function LaunchScanArchitecture({ t, tone, mode, ready }) {
  const hf = mode !== 'local'
  const reduce = useReducedMotion()
  const mid = useId().replace(/:/g, '')
  const { root, bind, geo } = useGeometry([mode, ready])
  const compact = !!geo && geo.w < 720
  const g = geo
  const readyAll = g && g.hf && g.local && g.sdk && g.airs && g.allow && g.block
  const airs = ready ? t.pass : t.warn
  const hfTone = t.isLight ? '#B98A00' : HF
  const neutral = t.inkFaint

  let wires = null
  let pills = null
  if (readyAll) {
    const inHf = hCurve(g.hf.r + 6, g.hf.cy, g.sdk.x - 7, g.sdk.cy - 10)
    const inLocal = hCurve(g.local.r + 6, g.local.cy, g.sdk.x - 7, g.sdk.cy + 10)
    const toAirs = `M${pt(g.sdk.r + 6, g.sdk.cy)} L${pt(g.airs.x - 7, g.sdk.cy)}`
    const toAllow = hCurve(g.airs.r + 6, g.airs.cy - 16, g.allow.x - 7, g.allow.cy)
    const toBlock = hCurve(g.airs.r + 6, g.airs.cy + 16, g.block.x - 7, g.block.cy)
    const fetch = arcBack(g.airs.x + 26, g.airs.y - 3, g.hf.cx, g.hf.y - 6)
    const active = hf ? inHf : inLocal
    const feed = `${active.d} L${pt(g.airs.x, g.sdk.cy)}`
    wires = (
      <svg aria-hidden="true" className="absolute inset-0 pointer-events-none" width={g.w} height={g.h} style={{ zIndex: 1, overflow: 'visible' }}>
        <Markers id={mid} colors={{ hf: hfTone, local: t.live, airs, pass: t.pass, block: t.block, neutral }} />
        <Wire d={inHf.d} color={hf ? hfTone : neutral} opacity={hf ? 0.8 : 0.35} dashed={!hf} marker={`${mid}-${hf ? 'hf' : 'neutral'}`} />
        <Wire d={inLocal.d} color={!hf ? t.live : neutral} opacity={!hf ? 0.8 : 0.35} dashed={hf} marker={`${mid}-${!hf ? 'local' : 'neutral'}`} />
        <Wire d={toAirs} color={ready ? airs : neutral} opacity={ready ? 0.8 : 0.5} dashed={!ready} marker={`${mid}-${ready ? 'airs' : 'neutral'}`} />
        <g opacity={ready ? 1 : 0.35}>
          <Wire d={toAllow.d} color={t.pass} opacity={0.75} marker={`${mid}-pass`} />
          <Wire d={toBlock.d} color={t.block} opacity={0.8} dashed width={1.8} marker={`${mid}-block`} />
        </g>
        {hf && <Wire d={fetch.d} color={hfTone} opacity={ready ? 0.6 : 0.3} dashed marker={`${mid}-hf`} />}
        {!reduce && ready && (
          <g key={`${g.w}x${g.h}-${mode}`}>
            <Packet d={feed} color={hf ? hfTone : t.live} dur={3} r={3.8} />
            {hf && <Packet d={fetch.d} color={hfTone} dur={3.2} delay={1.4} r={2.8} />}
            <Packet d={toAllow.d} color={t.pass} dur={2.4} delay={2.2} r={3} />
            <Packet d={toBlock.d} color={t.block} dur={2.4} delay={3.4} r={3} />
          </g>
        )}
      </svg>
    )
    pills = hf ? (
      <WirePill t={t} x={Math.max(150, fetch.m.x)} y={fetch.m.y} tone={hfTone}>
        {compact ? 'AIRS reads the repo itself' : 'AIRS reads the repo itself · only the URI leaves this app'}
      </WirePill>
    ) : null
  }

  return (
    <div className="w-full px-4 pt-3 pb-4 self-start">
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                      aria-label="AI Supply Chain scan architecture" className="overflow-hidden" style={glass(t, { radius: 22 })}>
        <header className="flex items-center gap-3 px-4 pt-4 pb-2">
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}45` }}>
            <Workflow size={16} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Scan architecture</div>
            <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, marginTop: 1 }}>
              How a model is checked before it loads
            </div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 1 }}>
              {hf
                ? 'Hugging Face: Prisma AIRS reads the repo by URI — nothing is downloaded here.'
                : 'Local file: scanned on this host — only file hashes and findings leave it.'}
            </div>
          </div>
        </header>

        <div className="pt-2 pb-5">
          <div ref={root} className="relative" style={{ display: 'grid', gridTemplateColumns: COLS, gridTemplateRows: '58px auto auto 8px', padding: '0 14px', rowGap: 12 }}>
            {/* Everything before the verdict happens before anything loads the
                model; the outcomes sit outside the tray. */}
            <div aria-hidden="true" style={{
              gridRow: '1 / 5', gridColumn: '1 / 6', margin: '0 -12px -4px', borderRadius: 22, zIndex: 0, position: 'relative',
              background: t.isLight ? 'rgba(20,20,24,0.022)' : 'rgba(255,255,255,0.025)',
              border: `1.5px dashed ${t.isLight ? 'rgba(20,20,24,0.14)' : 'rgba(255,255,255,0.13)'}`,
            }} />
            <TrayLabel t={t} icon={Workflow} style={{ gridRow: 1, gridColumn: '3 / 6', marginRight: -2 }}>The scan gates the first load</TrayLabel>

            <Node t={t} nodeRef={bind('hf')} kind="user" tone={hfTone} icon={Link2} compact={compact}
                  title="Hugging Face" sub="repo · by URI" style={{ gridRow: 2, gridColumn: 1, opacity: hf ? 1 : 0.45 }} />
            <Node t={t} nodeRef={bind('local')} kind="user" tone={t.live} icon={FileBox} compact={compact} delay={0.05}
                  title="Local artifact" sub={compact ? 'uploaded here' : 'uploaded to this app'} style={{ gridRow: 3, gridColumn: 1, opacity: hf ? 0.45 : 1 }} />

            <Node t={t} nodeRef={bind('sdk')} kind={ready ? 'user' : 'scan'} tone={ready ? t.live : t.warn} icon={ready ? Cpu : AlertTriangle}
                  off={!ready} compact={compact} delay={0.1}
                  title={ready ? 'Model Security SDK' : 'Scanner down'} sub={ready ? 'this app · scanner :8001' : 'the library panel says why'}
                  style={{ gridRow: '2 / 4', gridColumn: 3 }}>
              {ready && !hf && (
                <span className="relative block mt-2 rounded-lg px-2 py-1"
                      style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.35, color: t.isLight ? shade(t.live, 0.2) : t.live, background: `${t.live}12` }}>
                  scanned here · only hashes and findings leave
                </span>
              )}
            </Node>

            {/* the enforcement point: the security group */}
            <div ref={bind('airs')} className="relative" style={{
              gridRow: '2 / 4', gridColumn: 5, alignSelf: 'center', zIndex: 2, padding: '12px 14px', borderRadius: 18,
              background: t.panel, opacity: ready ? 1 : 0.7,
              border: ready ? `1px solid ${t.pass}40` : `1.5px dashed ${t.warn}77`,
              boxShadow: ready ? `0 10px 24px ${t.pass}17` : 'none',
            }}>
              <div className="flex items-center gap-3">
                <span className="grid place-items-center rounded-xl flex-shrink-0"
                      style={ready
                        ? { width: 34, height: 34, background: bandBg(t.pass), color: '#fff', boxShadow: `0 5px 12px ${t.pass}55` }
                        : { width: 34, height: 34, background: `${t.warn}17`, color: t.isLight ? shade(t.warn, 0.38) : t.warn }}>
                  <ShieldCheck size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>Prisma AIRS Model Security</span>
                  <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, marginTop: 1 }}>api.sase.paloaltonetworks.com/aims</span>
                </span>
              </div>
              <div style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim, margin: '10px 0 8px' }}>
                Security group — every rule, every file
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: compact ? '1fr' : '1fr 1fr' }}>
                <RulePills t={t} title="Threats" tone={t.block} items={THREATS} off={!ready} />
                <RulePills t={t} title="Policy" tone={t.warn} items={POLICY} off={!ready} />
              </div>
              <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 10 }}>Any blocking rule that fails blocks the model.</p>
            </div>

            <Node t={t} nodeRef={bind('allow')} kind="scan" tone={t.pass} icon={ShieldCheck} compact={compact} delay={0.2}
                  title="Allowed" sub="all rules pass · safe to load" style={{ gridRow: 2, gridColumn: 7, opacity: ready ? 1 : 0.5 }} />
            <Node t={t} nodeRef={bind('block')} kind="scan" tone={t.block} icon={ShieldX} compact={compact} delay={0.25}
                  title="Blocked" sub="a rule fails · never loaded" style={{ gridRow: 3, gridColumn: 7, opacity: ready ? 1 : 0.5 }} />

            {wires}
            {pills}
          </div>
        </div>

        {/* The runtime console's short-circuit note, translated: there the
            model is never called; here it is never loaded. */}
        <div className="px-4 pt-3.5 pb-4" style={{ borderTop: `1px solid ${t.hairline}` }}>
          <div style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, marginBottom: 10, color: t.isLight ? shade(t.block, 0.2) : t.block }}>
            On a block, the model is never loaded
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            {GATE.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-2.5">
                <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${t.block}14`, color: t.block }}>
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
                  <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <p className="px-1 mt-2.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint }}>
        Pick a model from the library, or enter a Hugging Face repo below. This becomes the live scan line once the session has a record.
      </p>
    </div>
  )
}
