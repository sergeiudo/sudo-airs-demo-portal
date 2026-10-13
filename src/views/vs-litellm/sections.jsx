import React, { useMemo, useState } from 'react'
import {
  ArrowRight, Quote, ShieldAlert, Package, Siren, Layers, Gauge, MessagesSquare, Trophy, Radar, Handshake, ListChecks, Calculator, Library,
  ExternalLink, BookOpen, AlertTriangle, CheckCircle2, ChevronRight, Search, X, FileCode2, Terminal, Flag, Sparkles, Target, Info,
} from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { Inline, Callout } from '../developer-corner/Blocks'
import { CodeTabs, CopyIcon } from '../developer-corner/CodeTabs'
import {
  AS_OF, BRIEF, SIDE, GROUPS, STATUS, CLAIMS, GLANCE, OVERVIEW, STATS, CVE_CLASSES, GATEWAY_DEPS, RESOLVED, TIMELINE, TIMELINE_SRC, PAYLOAD,
  CONTROLS, PRODUCTION, EDGE, OBJECTIONS, STRENGTHS, CHEAP_PATHS, DISCOVERY, COEXIST, SOURCES, SOURCE_GROUPS,
} from './content'
import {
  focusCls, inkOn, statusTone, Text, H2, Card, IconSquare, SectionBand, GlassPill, SideTag, StatusPill, ClaimChip, PortalLink,
  SourceLinks, Deeper, SayIt,
} from './parts'
import { useRecord } from './LiveRecord'
import { TailCalc, PgCalc } from './calculators'

/**
 * sections.jsx — one component per rail entry. Each opens with a band in its
 * group's tone, then cards. Every figure from the brief carries a claim chip
 * that opens the claim check at that claim.
 */

const TONE = Object.fromEntries(GROUPS.map((g) => [g.id, g.tone]))
const BRASS = TONE.brief

function ClaimChips({ t, ids, onGo }) {
  if (!ids?.length) return null
  return <div className="flex flex-wrap gap-1.5">{ids.map((id) => <ClaimChip key={id} t={t} id={id} onGo={onGo} />)}</div>
}

function SidePanel({ t, side, text, tint = false }) {
  const tone = SIDE[side].tone
  return (
    <div className="rounded-xl min-w-0" style={{ padding: '10px 12px', background: tint ? `${tone}0c` : t.sunken, border: `1px solid ${tint ? `${tone}2e` : t.hairline}` }}>
      <SideTag t={t} side={side} small />
      <div style={{ fontFamily: FONT.prose, fontSize: 13, color: t.ink, lineHeight: 1.55, marginTop: 4 }}><Inline t={t} text={text} /></div>
    </div>
  )
}

// ─── at a glance — the landing ───────────────────────────────────────────────
// One page, straight to the deal: three numbers, then one flat table of the
// points where the AIRS AI Gateway comes out ahead. Numbers are text-ink; the
// side tags carry identity. What LiteLLM does better is one line under it.
function Score({ t, side, n }) {
  return (
    <div className="min-w-0">
      <div style={{ fontFamily: FONT.display, fontSize: 34, fontWeight: 700, color: t.ink, lineHeight: 1, letterSpacing: '-0.03em' }}>{n}</div>
      <div className="mt-1 whitespace-nowrap"><SideTag t={t} side={side} small short /></div>
    </div>
  )
}

const GLANCE_COLS = '132px minmax(0, 1fr) minmax(0, 1fr)'

export function Glance({ t, onGo }) {
  const { data } = useRecord()
  const val = (v) => (typeof v === 'function' ? v(data) : v)
  const airs = SIDE.airs.tone
  const ok = inkOn(t, t.pass, 0.3)
  return (
    <>
      <SectionBand t={t} tone={BRASS} icon={Target} eyebrow="At a glance · AI Gateway" title={GLANCE.title} sub={GLANCE.sub} />

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))' }}>
        {GLANCE.score.map((s) => (
          <div key={s.label} className="rounded-2xl" style={{ padding: '13px 15px', background: t.panel, border: `1px solid ${t.hairline}` }}>
            <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>{s.label}</div>
            <div className="grid items-start gap-3 mt-2.5" style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}>
              <Score t={t} side="airs" n={s.airs(data)} />
              <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkFaint, paddingTop: 12 }}>vs</span>
              <Score t={t} side="litellm" n={s.litellm(data)} />
            </div>
            <div style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 8 }}>{s.note(data)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" role="table" aria-label="Where AIRS AI Gateway is ahead of LiteLLM" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
        <div role="row" className="grid items-center" style={{ gridTemplateColumns: GLANCE_COLS, borderBottom: `1px solid ${t.hairline}` }}>
          <span role="columnheader" style={{ padding: '10px 14px', ...LBL, fontSize: 9.5, color: t.inkDim }}>Where it matters</span>
          <span role="columnheader" style={{ padding: '10px 14px', background: `${airs}0d` }}><SideTag t={t} side="airs" /></span>
          <span role="columnheader" style={{ padding: '10px 14px' }}><SideTag t={t} side="litellm" /></span>
        </div>
        {GLANCE.groups.map((g) => (
          <div key={g.title} role="rowgroup">
            <div role="row" className="grid" style={{ gridTemplateColumns: GLANCE_COLS, background: t.sunken, borderBottom: `1px solid ${t.hairline}` }}>
              <span role="rowheader" style={{ gridColumn: '1 / -1', padding: '6px 14px', ...LBL, fontSize: 9, color: inkOn(t, BRASS, 0.4) }}>{g.title}</span>
            </div>
            {g.rows.map((r) => (
              <div key={r.topic} role="row" className="grid" style={{ gridTemplateColumns: GLANCE_COLS, borderBottom: `1px solid ${t.hairline}` }}>
                <span role="cell" style={{ padding: '9px 14px', fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink, lineHeight: 1.35 }}>{r.topic}</span>
                <span role="cell" className="flex gap-2" style={{ padding: '9px 14px', background: `${airs}0d` }}>
                  <CheckCircle2 size={14} aria-hidden="true" style={{ color: ok, flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink, lineHeight: 1.45 }}>{val(r.airs)}</span>
                </span>
                <span role="cell" style={{ padding: '9px 14px', fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, lineHeight: 1.45 }}>{val(r.litellm)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl" style={{ padding: '9px 12px', background: t.sunken, border: `1px solid ${t.hairline}` }}>
        <Info size={14} aria-hidden="true" style={{ color: t.inkDim, flexShrink: 0, marginTop: 2 }} />
        <span className="flex-1" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, lineHeight: 1.5 }}>{GLANCE.concede}</span>
        <button type="button" onClick={() => onGo('strengths')} className={`inline-flex items-center gap-1 flex-shrink-0 ${focusCls}`}
                style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: inkOn(t, t.live, 0.2) }}>
          Where LiteLLM is strong <ArrowRight size={12} aria-hidden="true" />
        </button>
      </div>

      <ClosingQuestion t={t} />

      <div className="flex flex-wrap items-center gap-1.5">
        <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginRight: 4 }}>Go deeper</span>
        {[['questions', 'The three questions'], ['safe', 'Security record'], ['objections', 'Objections'], ['claims', 'Claim check'], ['math', 'Do the math']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => onGo(id)} className={`inline-flex items-center gap-1 rounded-full px-2.5 ${focusCls}`}
                  style={{ height: 26, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BRASS}66` }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.hairline }}>
            {label} <ArrowRight size={11} aria-hidden="true" style={{ color: t.inkDim }} />
          </button>
        ))}
      </div>
      <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint, margin: 0 }}>Every point is traced in the claim check ({AS_OF}); the CVE counts are read live.</p>
    </>
  )
}

// ─── the three questions (the brief's overview) ──────────────────────────────
export function Questions({ t, onGo }) {
  const counts = useMemo(() => {
    const c = { pass: 0, warn: 0, idle: 0 }
    for (const x of CLAIMS) c[STATUS[x.status].key]++
    return c
  }, [])
  return (
    <>
      <SectionBand t={t} tone={BRASS} icon={BookOpen} eyebrow="The brief · how to open" title="The three questions" sub={`${BRIEF.subtitle}. The brief, its seller notes, and every claim traced to its source.`}>
        <GlassPill icon={BookOpen} href={BRIEF.url}>Brief · {BRIEF.date}</GlassPill>
        <GlassPill icon={ListChecks} onClick={() => onGo('claims')}>Claims traced {AS_OF}</GlassPill>
      </SectionBand>

      <div className="rounded-3xl relative overflow-hidden" style={{ padding: '18px 20px', background: `${BRASS}10`, border: `1px solid ${BRASS}40` }}>
        <Quote aria-hidden="true" size={64} strokeWidth={1.2} style={{ position: 'absolute', right: 14, top: 8, color: BRASS, opacity: 0.16 }} />
        <div style={{ ...LBL, fontSize: 9.5, color: inkOn(t, BRASS, 0.4), marginBottom: 6 }}>How to open</div>
        <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 600, color: t.ink, lineHeight: 1.5, maxWidth: 760 }}><Inline t={t} text={OVERVIEW.lead} /></div>
      </div>

      <div>
        <H2 t={t} sub="Answer them in this order. Each opens its section.">The three questions</H2>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {OVERVIEW.questions.map((q) => <QuestionCard key={q.n} t={t} q={q} onGo={onGo} />)}
        </div>
      </div>

      <Card t={t}>
        <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 6 }}>What the customer reads</div>
        <Text t={t} text={OVERVIEW.customer} dim={false} size={14} />
        <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint, margin: '8px 0 0' }}>
          The brief's customer PDF prints "107 packages" and "27 CVEs"; the wording here uses the figures that survive the claim check.
        </p>
      </Card>

      <div>
        <H2 t={t} sub="How this pillar is laid out.">Use it</H2>
        <div className="mt-3 space-y-2">
          {OVERVIEW.howTo.map((h) => (
            <button key={h.title} type="button" onClick={() => onGo(h.go)} className={`w-full flex items-center gap-3 rounded-2xl text-left ${focusCls}`}
                    style={{ padding: '11px 13px', background: t.panel, border: `1px solid ${t.hairline}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BRASS}66` }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.hairline }}>
              <IconSquare t={t} icon={h.icon} tone={BRASS} />
              <span className="flex-1 min-w-0">
                <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{h.title}</span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 1, lineHeight: 1.45 }}>{h.text}</span>
              </span>
              <ChevronRight size={15} style={{ color: t.inkDim }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={() => onGo('claims')} className={`w-full rounded-2xl text-left ${focusCls}`}
              style={{ padding: '12px 14px', background: t.panel, border: `1px solid ${t.hairline}` }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink, marginRight: 4 }}>The claim check, in one line</span>
          {[['pass', 'hold'], ['warn', 'need care'], ['idle', 'not checked here']].map(([k, w]) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full px-2" style={{ height: 22, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: inkOn(t, t[k], k === 'warn' ? 0.45 : 0.3), background: `${t[k]}1a` }}>
              {counts[k]} {w}
            </span>
          ))}
          <ArrowRight size={14} style={{ color: t.inkDim, marginLeft: 'auto' }} aria-hidden="true" />
        </div>
      </button>

      <ClosingQuestion t={t} />
    </>
  )
}

function QuestionCard({ t, q, onGo }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" onClick={() => onGo(q.go)} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`text-left rounded-2xl flex flex-col ${focusCls}`}
            style={{ padding: '14px 15px', background: t.panel, border: `1px solid ${hot ? `${BRASS}66` : t.hairline}`, boxShadow: hot ? `0 10px 24px ${BRASS}1c` : 'none', transition: 'border-color 160ms, box-shadow 200ms' }}>
      <span className="grid place-items-center rounded-xl" style={{ width: 34, height: 34, background: bandBg(BRASS), color: '#fff', fontFamily: FONT.mono, fontSize: 12, fontWeight: 700 }}>{q.n}</span>
      <span className="block mt-2.5" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, lineHeight: 1.3 }}>{q.q}</span>
      <span className="block mt-2 pt-2 flex-1" style={{ borderTop: `1px solid ${t.hairline}` }}>
        <SideTag t={t} side="litellm" small />
        <span className="block mt-1" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, lineHeight: 1.5 }}>{q.litellm}</span>
      </span>
      <span className="inline-flex items-center gap-1 mt-2" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: inkOn(t, BRASS, 0.35) }}>Open the section <ArrowRight size={12} aria-hidden="true" /></span>
    </button>
  )
}

function ClosingQuestion({ t }) {
  return (
    <div className="rounded-3xl" style={{ padding: '18px 20px', background: `linear-gradient(180deg, ${BRASS}14, ${BRASS}06)`, border: `1px solid ${BRASS}66` }}>
      <div className="flex items-center gap-2">
        <span style={{ ...LBL, fontSize: 9.5, color: inkOn(t, BRASS, 0.4) }}>The question to leave with the customer</span>
        <span className="ml-auto" style={{ color: t.inkDim }}><CopyIcon text={OVERVIEW.closing} light={t.isLight} size={13} /></span>
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 600, color: t.ink, lineHeight: 1.4, marginTop: 6, maxWidth: 640 }}>{OVERVIEW.closing}</div>
    </div>
  )
}

// ─── 01 · safe ───────────────────────────────────────────────────────────────
export function Safe({ t, onGo, ledgerRef }) {
  const { data } = useRecord()
  const ll = data?.litellm
  const urlFor = (cve) => ll?.items?.find((x) => x.cve === cve)?.url ?? `https://osv.dev/vulnerability/${cve}`
  return (
    <>
      <SectionBand t={t} tone={BRASS} icon={ShieldAlert} eyebrow="01 · Safe in the request path" title="Is it safe in the request path?"
                   sub="A gateway sees every prompt, every response and every provider key. Check its security record before you compare features." />

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))' }}>
        {STATS.map((s) => (
          <div key={s.label} className="rounded-2xl flex flex-col" style={{ padding: '14px 15px', background: t.panel, border: `1px solid ${SIDE.litellm.tone}38` }}>
            <div className="flex items-end gap-2 flex-wrap">
              <span style={{ fontFamily: FONT.display, fontSize: 38, fontWeight: 700, color: t.ink, lineHeight: 1, letterSpacing: '-0.03em' }}>{s.value}</span>
              {s.live === 'cves' && ll && (
                <span className="rounded-full px-2 mb-1" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: inkOn(t, SIDE.litellm.tone, 0.3), background: `${SIDE.litellm.tone}17` }}>OSV today: {ll.cves}</span>
              )}
              {s.value === '107' && (
                <span className="rounded-full px-2 mb-1" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: inkOn(t, SIDE.litellm.tone, 0.3), background: `${SIDE.litellm.tone}17` }}>re-resolved: {RESOLVED.packages.length}</span>
              )}
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink, marginTop: 6 }}>{s.label}</div>
            <div className="flex-1" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, lineHeight: 1.55, marginTop: 4 }}><Inline t={t} text={s.text} /></div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.source}</div>
            <div className="mt-2"><ClaimChip t={t} id={s.claim} onGo={onGo} /></div>
          </div>
        ))}
      </div>

      <div>
        <H2 t={t} sub="Grouped by what they would mean for the box that holds every provider key. Severity as OSV rates it.">What the CVEs are</H2>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {CVE_CLASSES.map((c) => (
            <Card key={c.title} t={t}>
              <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{c.title}</div>
              <div style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, lineHeight: 1.5, marginTop: 2 }}>{c.why}</div>
              <div className="mt-2 space-y-0.5">
                {c.items.map(([cve, sev, text]) => (
                  <a key={cve} href={urlFor(cve)} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-2 rounded-lg ${focusCls}`} style={{ padding: '5px 4px' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = t.sunken }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <span className="flex-1 min-w-0">
                      <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, lineHeight: 1.4 }}>{text}</span>
                      <span className="block" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 1 }}>{cve} · {sev.toUpperCase()}</span>
                    </span>
                    <ExternalLink size={11} style={{ color: t.inkFaint, marginTop: 4, flexShrink: 0 }} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div ref={ledgerRef}><Ledger t={t} /></div>

      <div>
        <H2 t={t} sub="The brief's architecture argument: what a gateway has to load to answer one request.">Dependency surface</H2>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <DepCard t={t} side="litellm" count={RESOLVED.packages.length} what={`packages resolved for ${RESOLVED.spec}`}
                   note={`Re-resolved here on ${AS_OF}: pip ${RESOLVED.pip}, Python ${RESOLVED.python}, ${RESOLVED.platform} — a metadata-only dry run. The brief measured 107.`}
                   items={RESOLVED.packages} />
          <DepCard t={t} side="airs" count={GATEWAY_DEPS.length} what="declared dependencies in @portkey-ai/gateway 1.15.2"
                   note="The open-source gateway core on npm — the package the brief names. Not a statement about the AIRS data-plane image."
                   items={GATEWAY_DEPS} open />
        </div>
        <div className="mt-2.5"><ClaimChips t={t} ids={['packages', 'deps15', 'gwAdvisory']} onGo={onGo} /></div>
      </div>
    </>
  )
}

function DepCard({ t, side, count, what, note, items, open = false }) {
  const tone = SIDE[side].tone
  return (
    <Card t={t} tone={tone}>
      <SideTag t={t} side={side} />
      <div className="flex items-end gap-2 mt-2">
        <span style={{ fontFamily: FONT.display, fontSize: 36, fontWeight: 700, color: t.ink, lineHeight: 1 }}>{count}</span>
        <span className="pb-1" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>{what}</span>
      </div>
      <Text t={t} size={12} text={note} style={{ marginTop: 6 }} />
      <div className="mt-2.5">
        <Deeper t={t} tone={tone} title={`Show all ${count}`} defaultOpen={open}>
          <div className="flex flex-wrap gap-1">
            {items.map((d) => <span key={d} className="rounded-md px-1.5" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>{d}</span>)}
          </div>
        </Deeper>
      </div>
    </Card>
  )
}

const LEDGER_FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'critical', label: 'Critical', test: (x) => x.severity === 'critical' },
  { id: 'high', label: 'High', test: (x) => x.severity === 'high' },
  { id: 'year', label: String(new Date().getFullYear()), test: (x) => x.published?.startsWith(String(new Date().getFullYear())) },
  { id: 'nocve', label: 'No CVE', test: (x) => !x.cve },
]

function Ledger({ t }) {
  const { data, loading } = useRecord()
  const ll = data?.litellm
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const items = useMemo(() => {
    const f = LEDGER_FILTERS.find((x) => x.id === filter) ?? LEDGER_FILTERS[0]
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (ll?.items ?? []).filter(f.test).filter((x) => words.every((w) => `${x.cve ?? ''} ${x.ids.join(' ')} ${x.summary}`.toLowerCase().includes(w)))
  }, [ll, filter, q])
  return (
    <Card t={t} pad="14px 16px">
      <H2 t={t} sub={ll ? `${ll.cves} CVEs and ${ll.other} advisories without one, from ${ll.osvRecords} OSV records — newest first. Read live.` : loading ? 'Reading OSV…' : 'OSV did not answer; the counts above carry their date.'}>
        The full ledger
      </H2>
      {ll && (
        <>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div role="radiogroup" aria-label="Filter the ledger" className="flex flex-wrap gap-1">
              {LEDGER_FILTERS.map((f) => {
                const on = f.id === filter
                const n = ll.items.filter(f.test).length
                return (
                  <button key={f.id} type="button" role="radio" aria-checked={on} onClick={() => setFilter(f.id)} className={`rounded-full px-2.5 ${focusCls}`}
                          style={{ height: 26, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.ink, background: on ? bandBg(SIDE.litellm.tone) : t.sunken, border: `1px solid ${on ? 'transparent' : t.hairline}` }}>
                    {f.label} <span style={{ opacity: 0.75 }}>{n}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 ml-auto" style={{ height: 28, background: t.sunken, border: `1px solid ${t.hairline}`, minWidth: 180 }}>
              <Search size={12} style={{ color: t.inkDim }} aria-hidden="true" />
              <input ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')} value={q} onChange={(e) => setQ(e.target.value)}
                     placeholder="mcp, sql, auth…" aria-label="Search the ledger" className="flex-1 min-w-0 outline-none" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink, border: 'none' }} />
              {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" className={focusCls} style={{ color: t.inkDim }}><X size={12} /></button>}
            </div>
          </div>
          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.hairline}` }}>
            <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
              {items.length === 0 && <div style={{ padding: 14, fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>Nothing matches.</div>}
              {items.map((x, i) => (
                <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" className={`grid items-start gap-3 ${focusCls}`}
                   style={{ gridTemplateColumns: '84px minmax(0, 1fr) 82px', padding: '8px 12px', borderTop: i ? `1px solid ${t.hairline}` : 'none' }}
                   onMouseEnter={(e) => { e.currentTarget.style.background = t.sunken }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: x.malware ? inkOn(t, t.warn, 0.45) : t.ink }}>{x.malware ? 'Malware' : (x.severity ?? 'unrated').replace(/^./, (c) => c.toUpperCase())}</span>
                  <span className="min-w-0">
                    <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, lineHeight: 1.4 }}>{x.summary}</span>
                    <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 1 }}>{x.ids.join(' · ')}{x.fixed ? ` · fixed ${x.fixed}` : ''}</span>
                  </span>
                  <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, textAlign: 'right' }}>{x.published}</span>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

// ─── the March 2026 compromise ───────────────────────────────────────────────
const CHAIN = [
  { title: 'Scanner tag moved', text: '`trivy-action` → malicious v0.69.4' },
  { title: 'CI runs it unpinned', text: 'LiteLLM\'s pipeline pulls the moved tag' },
  { title: 'Tokens harvested', text: '`PYPI_PUBLISH` and GitHub tokens' },
  { title: 'Releases published', text: '1.82.7, then 1.82.8 with a `.pth`' },
  { title: 'Every host that installed', text: 'credentials out, backdoor in' },
]

export function Compromise({ t, onGo }) {
  return (
    <>
      <SectionBand t={t} tone={BRASS} icon={Siren} eyebrow="Supply chain · March 2026" title="How the March 2026 compromise happened"
                   sub="An unpinned scanner in CI became a malicious PyPI release in five days." />

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))' }}>
        {CHAIN.map((c, i) => (
            <div key={c.title} className="relative rounded-2xl" style={{ padding: '10px 11px', background: t.panel, border: `1px solid ${i === 4 ? `${t.warn}55` : t.hairline}` }}>
              <div className="grid place-items-center rounded-lg" style={{ width: 22, height: 22, background: bandBg(i === 4 ? t.warn : SIDE.litellm.tone), color: '#fff', fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 700 }}>{i + 1}</div>
              <div style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink, marginTop: 6, lineHeight: 1.3 }}>{c.title}</div>
              <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 2, lineHeight: 1.4 }}><Inline t={t} text={c.text} /></div>
              {i < CHAIN.length - 1 && <ChevronRight size={13} aria-hidden="true" className="absolute" style={{ right: -11, top: '50%', marginTop: -6.5, color: t.inkFaint }} />}
            </div>
        ))}
      </div>

      <Card t={t} pad="16px 18px">
        <H2 t={t} sub="Each line says where it comes from: the brief, or a primary record you can open.">Timeline</H2>
        <ol className="mt-4">
          {TIMELINE.map((e, i) => {
            const src = TIMELINE_SRC[e.src]
            return (
              <li key={i} className="flex gap-3.5">
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: 14 }}>
                  <span className="rounded-full" style={{ width: 11, height: 11, marginTop: 4, background: e.hot ? t.warn : e.src === 'brief' ? BRASS : t.pass, boxShadow: `0 0 0 3px ${t.panel}` }} aria-hidden="true" />
                  {i < TIMELINE.length - 1 && <span className="flex-1" style={{ width: 2, background: t.hairline, marginTop: 2 }} />}
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span style={{ fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 700, color: inkOn(t, e.hot ? t.warn : t.inkDim, 0.45) }}>{e.when.toUpperCase()}</span>
                    <span className="rounded-full px-1.5" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, color: inkOn(t, src.tone, 0.35), background: `${src.tone}17` }}>{src.label}</span>
                  </div>
                  <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink, marginTop: 3 }}><Inline t={t} text={e.title} /></div>
                  <div style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, marginTop: 2, lineHeight: 1.55 }}><Inline t={t} text={e.text} /></div>
                </div>
              </li>
            )
          })}
        </ol>
        <ClaimChips t={t} ids={['timeline', 'trivy', 'exposure']} onGo={onGo} />
      </Card>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Card t={t}>
          <H2 t={t} sub="From PYSEC-2026-2. Domains defanged, as the advisory prints them.">What the payload did</H2>
          <div className="mt-3 space-y-3">
            {PAYLOAD.map((p, i) => (
              <div key={p.stage} className="flex gap-3">
                <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 24, height: 24, background: `${t.warn}1c`, color: inkOn(t, t.warn, 0.45), fontFamily: FONT.mono, fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                <div className="min-w-0">
                  <div style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{p.stage}</div>
                  <Text t={t} size={12.5} text={p.text} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3"><SourceLinks t={t} ids={['osvMalware', 'litellmBlog', 'wizTeampcp']} /></div>
        </Card>
        <Card t={t}>
          <H2 t={t} sub="Why 1.82.8 was worse than 1.82.7.">The `.pth` trick</H2>
          <Text t={t} size={13} style={{ marginTop: 10 }} text="Python's `site` module reads every `.pth` file in `site-packages` when the interpreter starts, and runs any line in one that begins with `import`. So `litellm_init.pth` ran its payload in **every** Python process on the machine — a test run, a notebook, a CI job, another service — whether or not anything imported LiteLLM." />
          <Text t={t} size={12.5} style={{ marginTop: 8 }} text="1.82.7 needed the proxy to be loaded; 1.82.8 only needed the package to be installed." />
          <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint, margin: '8px 0 0' }}>How Python works, not a claim from the brief.</p>
        </Card>
      </div>

      <Callout t={t} block={{ tone: 'warn', title: 'Ask this first', text: [DISCOVERY[0].q, DISCOVERY[0].why] }} />
    </>
  )
}

// ─── 02 · scope ──────────────────────────────────────────────────────────────
export function Scope({ t, onGo }) {
  return (
    <>
      <SectionBand t={t} tone={BRASS} icon={Layers} eyebrow="02 · What else it secures" title="What else does it secure?"
                   sub="A gateway is one of nine control points that Prisma AIRS runs under one policy and one management console. LiteLLM covers one." />

      <Card t={t}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {[['airs', CONTROLS.length, 'Prisma AIRS', ' (Agent Identity coming)'], ['litellm', CONTROLS.filter((c) => c.covered).length, 'LiteLLM', '']].map(([side, n, name, note]) => (
            <div key={side} className="flex items-center gap-3">
              <div className="flex gap-1" aria-hidden="true">
                {CONTROLS.map((c, i) => (
                  <span key={i} className="rounded" style={{ width: 14, height: 14, background: i < n ? SIDE[side].tone : 'transparent', border: `1.5px solid ${i < n ? SIDE[side].tone : t.hairline}` }} />
                ))}
              </div>
              <span style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink }}><b>{name}</b> · {n} of {CONTROLS.length}{note}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
        {CONTROLS.map((c) => <ControlCard key={c.title} t={t} c={c} onGo={onGo} />)}
      </div>

      <div className="rounded-2xl" style={{ padding: '14px 16px', background: t.panel, border: `1px solid ${BRASS}55` }}>
        <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 600, color: t.ink, lineHeight: 1.5 }}>
          The choice is between one platform for AI security and a gateway with a separate product for each of the other control points.
        </div>
      </div>
      <ClaimChips t={t} ids={['namedCves', 'guardrailsPaid']} onGo={onGo} />
    </>
  )
}

function ControlCard({ t, c, onGo }) {
  const coming = c.status === 'Coming'
  const sTone = coming ? t.warn : t.pass
  return (
    <div className="rounded-2xl flex flex-col" style={{ padding: '13px 14px', background: c.covered ? `${BRASS}0a` : t.panel, border: `1px solid ${c.covered ? `${BRASS}66` : t.hairline}` }}>
      <div className="flex items-start gap-2.5">
        <IconSquare t={t} icon={c.icon} tone={SIDE.airs.tone} size={30} />
        <span className="flex-1 min-w-0" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink, lineHeight: 1.25, paddingTop: 5 }}>{c.title}</span>
        <span className="rounded-full px-2 flex-shrink-0" style={{ height: 20, lineHeight: '20px', fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, color: inkOn(t, sTone, coming ? 0.45 : 0.3), background: `${sTone}1a` }}>{c.status}</span>
      </div>
      <div style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, lineHeight: 1.55, marginTop: 8 }}>{c.airs}</div>
      <div className="flex-1 mt-2 pt-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
        <SideTag t={t} side="litellm" small />
        <div style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, lineHeight: 1.5, marginTop: 2 }}>{c.litellm}</div>
      </div>
      {c.portal && <div className="mt-2.5"><PortalLink t={t} pillarId={c.portal} rel={c.rel} text={c.relText} onGo={onGo} /></div>}
    </div>
  )
}

// ─── 03 · production ─────────────────────────────────────────────────────────
export function Production({ t, onGo }) {
  return (
    <>
      <SectionBand t={t} tone={BRASS} icon={Gauge} eyebrow="03 · In production" title="How does it hold up in production?"
                   sub="The two gateways differ in how they deploy, how they behave under load and what an enterprise gets without paying extra." />
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>Each row says who it favours once the claim check is applied:</span>
        {Object.entries(EDGE).map(([k, e]) => <EdgePill key={k} t={t} edge={k} />)}
      </div>
      {PRODUCTION.map((g) => (
        <div key={g.group} className="space-y-2.5">
          <H2 t={t}>{g.group}</H2>
          {g.rows.map((r) => <ProdRow key={r.topic} t={t} r={r} onGo={onGo} />)}
        </div>
      ))}
    </>
  )
}

function EdgePill({ t, edge }) {
  const e = EDGE[edge]
  const c = t[e.key]
  return <span className="rounded-full px-2 flex-shrink-0" style={{ height: 20, lineHeight: '20px', fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: inkOn(t, c, e.key === 'warn' ? 0.45 : 0.3), background: `${c}1c` }}>{e.label}</span>
}

function ProdRow({ t, r, onGo }) {
  return (
    <Card t={t} pad="12px 14px">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="flex-1" style={{ fontFamily: FONT.display, fontSize: 14.5, fontWeight: 700, color: t.ink }}>{r.topic}</span>
        <EdgePill t={t} edge={r.edge} />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <SidePanel t={t} side="airs" text={r.airs} tint />
        <SidePanel t={t} side="litellm" text={r.litellm} />
      </div>
      <div className="mt-2.5">
        <Deeper t={t} tone={BRASS}>
          {r.deeper && <Text t={t} size={13} text={r.deeper} />}
          {r.say && <SayIt t={t} tone={BRASS} text={r.say} />}
          <div className="flex flex-wrap items-center gap-1.5">
            <ClaimChips t={t} ids={r.claims} onGo={onGo} />
            {r.math && (
              <button type="button" onClick={() => onGo('math')} className={`inline-flex items-center gap-1.5 rounded-full px-2 ${focusCls}`}
                      style={{ height: 22, fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: inkOn(t, t.live, 0.2), background: `${t.live}12` }}>
                <Calculator size={11} aria-hidden="true" /> Do the math
              </button>
            )}
          </div>
          {r.portal && <PortalLink t={t} pillarId={r.portal} text={r.portal === 'enterpriseAccess' ? 'Short-lived JWTs as gateway credentials, live' : 'Read the hook verdict in Prompt Telemetry'} onGo={onGo} />}
        </Deeper>
      </div>
    </Card>
  )
}

// ─── objections ──────────────────────────────────────────────────────────────
export function Objections({ t, onGo }) {
  const tone = TONE.sell
  const [from, setFrom] = useState('all')
  const list = OBJECTIONS.filter((o) => from === 'all' || o.from === from)
  return (
    <>
      <SectionBand t={t} tone={tone} icon={MessagesSquare} eyebrow="Sell it" title="Objections you will hear" sub="Each one has a follow-up question. Agree first where it is true." />
      <div role="radiogroup" aria-label="Which objections" className="flex flex-wrap gap-1">
        {[['all', 'All', OBJECTIONS.length], ['brief', 'From the brief', OBJECTIONS.filter((o) => o.from === 'brief').length], ['research', 'New since the brief', OBJECTIONS.filter((o) => o.from === 'research').length]].map(([id, label, n]) => {
          const on = from === id
          return (
            <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setFrom(id)} className={`rounded-full px-3 ${focusCls}`}
                    style={{ height: 28, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.ink, background: on ? bandBg(tone) : t.sunken, border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${tone}40` : 'none' }}>
              {label} <span style={{ opacity: 0.75 }}>{n}</span>
            </button>
          )
        })}
      </div>
      <div className="space-y-3">
        {list.map((o) => (
          <Card key={o.q} t={t} pad="14px 16px">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${tone}17`, color: inkOn(t, tone, 0.25) }}><Quote size={15} aria-hidden="true" /></span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span style={{ fontFamily: FONT.display, fontSize: 15.5, fontWeight: 700, color: t.ink, lineHeight: 1.35 }}>“{o.q}”</span>
                  {o.from === 'research' && <span className="inline-flex items-center gap-1 rounded-full px-2" style={{ height: 20, fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, color: inkOn(t, tone, 0.3), background: `${tone}17` }}><Sparkles size={10} aria-hidden="true" /> new since the brief</span>}
                </div>
                <Text t={t} size={13} text={o.a} style={{ marginTop: 6 }} />
                <div style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 650, color: t.ink, marginTop: 6, lineHeight: 1.45 }}><Inline t={t} text={o.punch} /></div>
                <div className="mt-2.5"><SayIt t={t} tone={tone} label="Follow-up question" text={o.follow} /></div>
                {o.careful && <div className="mt-2.5"><Callout t={t} compact block={{ tone: 'warn', title: 'Careful', text: o.careful }} /></div>}
                {o.go && (
                  <button type="button" onClick={() => onGo(o.go)} className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                          style={{ height: 26, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: inkOn(t, tone, 0.3), background: `${tone}14` }}>
                    The land play <ArrowRight size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

// ─── strengths ───────────────────────────────────────────────────────────────
export function Strengths({ t, onGo }) {
  const tone = TONE.sell
  const { data } = useRecord()
  return (
    <>
      <SectionBand t={t} tone={tone} icon={Trophy} eyebrow="Sell it" title="Where LiteLLM is strong" sub="Three things it does better than AIRS AI Gateway. Concede them early — it buys credibility for section 01." />
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {STRENGTHS.map((s) => (
          <Card key={s.title} t={t} tone={SIDE.litellm.tone}>
            <SideTag t={t} side="litellm" small />
            <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, marginTop: 5 }}>{s.title}</div>
            <Text t={t} size={12.5} text={s.text} style={{ marginTop: 4 }} />
            {s.live === 'pace' && data?.pypi && (
              <div className="rounded-xl mt-2.5" style={{ padding: '7px 9px', background: t.sunken, fontFamily: FONT.prose, fontSize: 12, color: t.ink }}>
                Today: <b>{data.pypi.last30}</b> releases in 30 days, on <b>{data.pypi.releaseDays90}</b> of the last 90 days.
              </div>
            )}
            <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
              <div style={{ ...LBL, fontSize: 9, color: t.inkDim, marginBottom: 3 }}>How to concede</div>
              <Text t={t} size={12.5} dim={false} text={s.counter} />
            </div>
          </Card>
        ))}
      </div>
      <div>
        <H2 t={t} sub="From the brief's seller notes. It means one of two things.">When a prospect asks for a cheap gateway</H2>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {CHEAP_PATHS.map((p) => {
            const c = t[p.tone]
            return (
              <div key={p.label} className="rounded-2xl" style={{ padding: '14px 15px', background: `${c}0e`, border: `1px solid ${c}40` }}>
                <div className="flex items-center gap-1.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: inkOn(t, c, p.tone === 'warn' ? 0.45 : 0.3) }}>
                  {p.tone === 'pass' ? <Flag size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />} {p.label}
                </div>
                <div style={{ fontFamily: FONT.display, fontSize: 14.5, fontWeight: 700, color: t.ink, marginTop: 5, lineHeight: 1.35 }}>{p.title}</div>
                <Text t={t} size={12.5} text={p.text} style={{ marginTop: 4 }} />
              </div>
            )
          })}
        </div>
      </div>
      <button type="button" onClick={() => onGo('safe')} className={`inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
              style={{ height: 28, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: inkOn(t, BRASS, 0.35), background: `${BRASS}14` }}>
        Section 01 · Safe in the request path <ArrowRight size={12} aria-hidden="true" />
      </button>
    </>
  )
}

// ─── discovery ───────────────────────────────────────────────────────────────
export function Discovery({ t }) {
  const tone = TONE.sell
  const areas = [...new Set(DISCOVERY.map((d) => d.area))]
  const plain = DISCOVERY.map((d, i) => `${i + 1}. ${d.q}`).join('\n') + `\n\n${OVERVIEW.closing}`
  return (
    <>
      <SectionBand t={t} tone={tone} icon={Radar} eyebrow="Sell it" title="Discovery questions" sub="What to ask, and why each answer matters. Every question traces to a fact in the brief or a primary source." />
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>Copy all {DISCOVERY.length} questions and the closing one</span>
        <span style={{ color: t.inkDim }}><CopyIcon text={plain} light={t.isLight} size={13} /></span>
      </div>
      {areas.map((a) => (
        <Card key={a} t={t} pad="12px 14px">
          <div style={{ ...LBL, fontSize: 9.5, color: inkOn(t, tone, 0.35), marginBottom: 6 }}>{a}</div>
          <div className="space-y-1">
            {DISCOVERY.filter((d) => d.area === a).map((d) => {
              const n = DISCOVERY.indexOf(d) + 1
              return (
                <div key={d.q} className="flex gap-3 rounded-xl" style={{ padding: '8px 6px' }}>
                  <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 24, height: 24, background: bandBg(tone), color: '#fff', fontFamily: FONT.mono, fontSize: 11, fontWeight: 700 }}>{n}</span>
                  <div className="min-w-0">
                    <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink, lineHeight: 1.4 }}>{d.q}</div>
                    <Text t={t} size={12.5} text={d.why} style={{ marginTop: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ))}
      <ClosingQuestion t={t} />
    </>
  )
}

// ─── already on LiteLLM? ─────────────────────────────────────────────────────
export function Coexist({ t, onGo }) {
  const tone = TONE.sell
  return (
    <>
      <SectionBand t={t} tone={tone} icon={Handshake} eyebrow="Sell it · the land play" title="Already on LiteLLM?" sub="Land Prisma AIRS inside it today, then expand to the control points LiteLLM does not cover." />
      <Text t={t} size={14} dim={false} text={COEXIST.intro} />

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {COEXIST.play.map((p, i) => (
          <div key={p.title} className="rounded-2xl" style={{ padding: '13px 14px', background: t.panel, border: `1px solid ${tone}40` }}>
            <div className="flex items-center gap-2">
              <span className="grid place-items-center rounded-lg" style={{ width: 24, height: 24, background: bandBg(tone), color: '#fff', fontFamily: FONT.mono, fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>{p.title}</span>
            </div>
            <Text t={t} size={12.5} text={p.text} style={{ marginTop: 6 }} />
          </div>
        ))}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))' }}>
        <Card t={t}>
          <H2 t={t} sub="LiteLLM's guardrail modes for panw_prisma_airs.">When it scans</H2>
          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.hairline}` }}>
            {COEXIST.modes.map(([mode, when, what], i) => (
              <div key={mode} className="grid gap-2" style={{ gridTemplateColumns: '118px minmax(0,1fr) minmax(0,0.9fr)', padding: '7px 10px', borderTop: i ? `1px solid ${t.hairline}` : 'none', background: i % 2 ? 'transparent' : t.sunken }}>
                <code style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink }}>{mode}</code>
                <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink }}>{when}</span>
                <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>{what}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card t={t}>
          <H2 t={t} sub="As LiteLLM's own page lists them.">What it brings</H2>
          <ul className="mt-3 space-y-1.5">
            {COEXIST.features.map((f) => (
              <li key={f} className="flex gap-2" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, lineHeight: 1.5 }}>
                <CheckCircle2 size={14} style={{ color: inkOn(t, t.pass, 0.3), flexShrink: 0, marginTop: 2 }} aria-hidden="true" /><span><Inline t={t} text={f} /></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <CodeTabs title="config.yaml — LiteLLM proxy" tabs={[{ id: 'yaml', lang: 'yaml', label: 'YAML', code: COEXIST.config }]} />
      <Callout t={t} block={{ tone: 'warn', title: 'Before you configure it', text: COEXIST.caveat }} />

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <button type="button" onClick={() => onGo(`guide:${COEXIST.guide}`)} className={`flex items-center gap-3 rounded-2xl text-left ${focusCls}`}
                style={{ padding: '11px 13px', background: t.panel, border: `1px solid ${t.live}40` }}>
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg('#0ea5e9') }}><FileCode2 size={15} style={{ color: '#fff' }} aria-hidden="true" /></span>
          <span className="flex-1 min-w-0">
            <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>The full integration guide</span>
            <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>Developer Corner · API gateways with a native integration</span>
          </span>
          <ArrowRight size={14} style={{ color: t.inkDim }} aria-hidden="true" />
        </button>
        <a href={SOURCES.llPanw.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 rounded-2xl ${focusCls}`}
           style={{ padding: '11px 13px', background: t.panel, border: `1px solid ${t.hairline}` }}>
          <IconSquare t={t} icon={BookOpen} tone={SIDE.litellm.tone} size={34} />
          <span className="flex-1 min-w-0">
            <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>LiteLLM's own page</span>
            <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>docs.litellm.ai · PANW Prisma AIRS guardrail</span>
          </span>
          <ExternalLink size={13} style={{ color: t.inkDim }} aria-hidden="true" />
        </a>
      </div>
    </>
  )
}

// ─── claim check ─────────────────────────────────────────────────────────────
const CLAIM_FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'pass', label: 'Holds', test: (c) => STATUS[c.status].key === 'pass' },
  { id: 'warn', label: 'Needs care', test: (c) => STATUS[c.status].key === 'warn' },
  { id: 'idle', label: 'Not checked here', test: (c) => STATUS[c.status].key === 'idle' },
]

export function Claims({ t, onGo, focus }) {
  const tone = TONE.proof
  const [filter, setFilter] = useState(() => (focus ? 'all' : 'warn'))
  const list = CLAIMS.filter((CLAIM_FILTERS.find((f) => f.id === filter) ?? CLAIM_FILTERS[0]).test)
  return (
    <>
      <SectionBand t={t} tone={tone} icon={ListChecks} eyebrow="Proof" title="Claim check" sub={`Every number in the brief, traced to its primary source on ${AS_OF}. Read the amber ones before you quote anything.`} />
      <Deeper t={t} tone={tone} title="What each status means">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          {Object.entries(STATUS).map(([k, s]) => (
            <div key={k} className="flex items-start gap-2 rounded-xl" style={{ padding: '7px 9px', background: t.panel, border: `1px solid ${t.hairline}` }}>
              <StatusPill t={t} status={k} />
              <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, lineHeight: 1.4 }}>{s.note}</span>
            </div>
          ))}
        </div>
      </Deeper>
      <div role="radiogroup" aria-label="Filter claims" className="flex flex-wrap gap-1">
        {CLAIM_FILTERS.map((f) => {
          const on = f.id === filter
          return (
            <button key={f.id} type="button" role="radio" aria-checked={on} onClick={() => setFilter(f.id)} className={`rounded-full px-3 ${focusCls}`}
                    style={{ height: 28, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.ink, background: on ? bandBg(tone) : t.sunken, border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${tone}40` : 'none' }}>
              {f.label} <span style={{ opacity: 0.75 }}>{CLAIMS.filter(f.test).length}</span>
            </button>
          )
        })}
      </div>
      <div className="space-y-2.5">
        {list.map((c) => <ClaimCard key={c.id} t={t} c={c} focused={focus === c.id} onGo={onGo} />)}
      </div>
    </>
  )
}

function ClaimCard({ t, c, focused, onGo }) {
  const tone = statusTone(t, c.status)
  return (
    <div id={`claim-${c.id}`} className="rounded-2xl" style={{ padding: '13px 15px', background: t.panel, border: `1px solid ${focused ? tone : `${tone}3a`}`, boxShadow: focused ? `0 0 0 3px ${tone}30` : 'none', borderLeft: `4px solid ${tone}`, transition: 'box-shadow 300ms' }}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill t={t} status={c.status} />
        <SideTag t={t} side={c.side} small />
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: 14.5, fontWeight: 650, color: t.ink, lineHeight: 1.45, marginTop: 6 }}>“{c.claim}”</div>
      <div className="mt-2 space-y-2">
        {c.finding.map((p, i) => <Text key={i} t={t} size={13} text={p} />)}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-2.5">
        <SourceLinks t={t} ids={c.sources} />
        {c.portal && <button type="button" onClick={() => onGo(`pillar:${c.portal}`)} className={`inline-flex items-center gap-1 ${focusCls}`} style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: inkOn(t, t.live, 0.2) }}>See it in this portal <ArrowRight size={11} aria-hidden="true" /></button>}
      </div>
    </div>
  )
}

// ─── the math ────────────────────────────────────────────────────────────────
export function MathSection({ t }) {
  const tone = TONE.proof
  return (
    <>
      <SectionBand t={t} tone={tone} icon={Calculator} eyebrow="Proof" title="Do the math" sub="The arithmetic behind the brief's performance claims — run it with the prospect's own numbers." />
      <TailCalc t={t} tone={tone} />
      <PgCalc t={t} tone={tone} />
    </>
  )
}

// ─── sources ─────────────────────────────────────────────────────────────────
const METHOD = [
  { icon: ShieldAlert, title: 'CVEs', text: '`POST https://api.osv.dev/v1/query` for PyPI `litellm` and npm `@portkey-ai/gateway`; records merged through their aliases so each CVE counts once.' },
  { icon: Package, title: 'Releases and the malicious versions', text: '`https://pypi.org/pypi/litellm/json` — upload times per version, and whether 1.82.7 and 1.82.8 are still listed.' },
  { icon: Terminal, title: 'Dependency count', text: '`pip install --dry-run --only-binary=:all: --ignore-installed --report r.json "litellm[proxy]==1.98.0"` in a fresh virtualenv: resolution from wheel metadata only, nothing installed, no package code run.' },
  { icon: BookOpen, title: 'LiteLLM\'s own claims', text: 'Its docs pages (benchmarks, production, enterprise, routing, Prometheus, the Prisma AIRS guardrail) and its repository (Helm values, `litellm-rust`), read as published.' },
]

export function Sources({ t }) {
  const tone = TONE.proof
  const byGroup = SOURCE_GROUPS.map((g) => [g, Object.values(SOURCES).filter((s) => s.group === g)]).filter(([, l]) => l.length)
  return (
    <>
      <SectionBand t={t} tone={tone} icon={Library} eyebrow="Proof" title="Sources" sub={`Every link opened on ${AS_OF}. The right-hand pane re-reads the live ones on demand.`} />
      <Card t={t}>
        <H2 t={t} sub="How each kind of number was checked.">Method</H2>
        <div className="mt-3 space-y-3">
          {METHOD.map((m) => (
            <div key={m.title} className="flex gap-3">
              <IconSquare t={t} icon={m.icon} tone={tone} size={28} />
              <div className="min-w-0">
                <div style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{m.title}</div>
                <Text t={t} size={12.5} text={m.text} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      {byGroup.map(([g, list]) => (
        <Card key={g} t={t} pad="10px 12px">
          <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, margin: '2px 4px 6px' }}>{g}</div>
          {list.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 rounded-xl ${focusCls}`} style={{ padding: '7px 6px' }}
               onMouseEnter={(e) => { e.currentTarget.style.background = t.sunken }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              <ExternalLink size={13} style={{ color: t.inkDim, flexShrink: 0 }} aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, lineHeight: 1.4 }}>{s.title}</span>
                <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 1 }}>{s.url}</span>
              </span>
            </a>
          ))}
        </Card>
      ))}
    </>
  )
}
