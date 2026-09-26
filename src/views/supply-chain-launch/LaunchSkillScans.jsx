import React, { useState } from 'react'
import { Puzzle, ExternalLink, BookOpen, ShieldCheck, ShieldX, Fingerprint, Upload, ArrowUpRight, Info, Package } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { CopyCmd, Footnote } from '../runtime-launch/LaunchModelPicker'
import { scmHomeUrl } from '../model-scanning-2027/scanModel'

/**
 * LaunchSkillScans — AI Skill Security, in the launch design.
 *
 * Content is SkillScans' (the v1 console keeps it), every statement from Palo
 * Alto's AI Supply Chain Security docs, "AI Skill Security (Preview)", Sep
 * 2026. The Preview's only documented workflow is the SCM UI — no API to
 * submit or list skill scans — so this explains the capability and hands off
 * to SCM rather than faking a history. The hand-off is a blue CTA card, the
 * colour actions carry in this design (it was vermilion, which is reserved for
 * interception).
 */

const DOCS_URL = 'https://docs.paloaltonetworks.com/prisma-airs/ai-supply-chain-security/ai-supply-chain-security'

// The Default Security Group's built-in rules, verbatim from the docs table.
const RULES = [
  ['Prompt Integrity', 'embedded instructions intended to manipulate or override expected agent behavior'],
  ['Arbitrary Code Execution', 'executable code or patterns capable of actions beyond the skill’s documented purpose'],
  ['Secrets Disclosure', 'unauthorized access to credentials, API keys, tokens and other sensitive information'],
  ['Data Exfiltration', 'outbound communication or data transfers that may expose sensitive information'],
  ['Obfuscated Behavior', 'actions performed without appropriate visibility, logging or user awareness'],
  ['Behavior Integrity', 'modifications to agent configuration, instructions or persistent state'],
  ['Excessive Permissions', 'autonomous behaviors or capabilities that exceed expected operational boundaries'],
]

const ZIP_CMD = 'zip -r my-skill.zip . -x ".git/*" "__pycache__/*" "*.pyc" ".venv/*" "venv/*" "node_modules/*"'
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

function Section({ t, icon: Icon, tone, title, children }) {
  const c = tone ?? t.live
  return (
    <div className="rounded-2xl px-3 py-3" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
      <div className="flex items-center gap-2.5 mb-2">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${c}14`, color: c }}>
          <Icon size={14} aria-hidden="true" />
        </span>
        <span style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

const P = ({ t, children, style }) => (
  <p style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim, ...style }}>{children}</p>
)

export function LaunchSkillScans({ t, tone, tsg }) {
  const [hot, setHot] = useState(false)
  const live = t.live
  return (
    <div className="px-3 pt-3.5 pb-4 space-y-2.5">
      {/* ── what it is ── */}
      <div className="rounded-2xl px-3 py-3" style={{ background: t.panel, border: `1px solid ${tone}40`, boxShadow: `0 8px 20px ${tone}14` }}>
        <div className="flex items-center gap-3">
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}45` }}>
            <Puzzle size={16} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>AI Skill Security</span>
              <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, lineHeight: '18px', color: t.isLight ? shade(live, 0.2) : live, background: `${live}17` }}>preview</span>
            </div>
            <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>
              Models decide what an agent knows; skills decide what it can do.
            </div>
          </div>
        </div>
        <P t={t} style={{ marginTop: 9 }}>
          Statically analyses an agent skill — a package with a <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>SKILL.md</span> and
          its scripts, prompts and config — against your rules, and returns an <strong style={{ color: t.ink }}>Allowed</strong> or{' '}
          <strong style={{ color: t.ink }}>Blocked</strong> verdict with a fingerprint of the exact bundle.
        </P>
      </div>

      {/* ── the one action: go to SCM ── */}
      <a href={scmHomeUrl(tsg)} target="_blank" rel="noreferrer"
         onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
         className={`flex items-center gap-3 rounded-2xl ${focusCls}`}
         style={{
           padding: '10px 10px 10px 11px', background: t.panel,
           border: `1px solid ${hot ? `${live}88` : `${live}40`}`,
           boxShadow: hot ? `0 10px 24px ${live}2e` : `0 6px 16px ${live}17`,
           transition: 'border-color 160ms ease, box-shadow 200ms ease',
         }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: bandBg(live), boxShadow: `0 5px 12px ${live}55` }}>
          <Upload size={16} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>Upload a skill in SCM</span>
          <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.4, color: t.inkDim, marginTop: 1 }}>
            AI Security → AI Supply Chain Security → Skill Scans → New Analysis
          </span>
        </span>
        <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
              style={{ width: 28, height: 28, color: hot ? '#fff' : live, background: hot ? shade(live) : `${live}14`, transition: 'background 140ms ease, color 140ms ease' }}>
          <ArrowUpRight size={14} />
        </span>
      </a>

      <Footnote t={t} icon={Info} tone={t.inkDim} title="Why there is no skill-scan history here">
        AI Skill Security is a Preview whose only documented workflow is the SCM UI — Palo Alto publishes no API to submit or
        list skill scans. Model scans have one, which is why the SCM history tab can show those.
        {tsg ? <> Your tenant: <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{tsg}</span>.</> : null}
      </Footnote>

      <Section t={t} icon={ShieldX} tone={tone} title="Seven built-in rules">
        <div className="space-y-2">
          {RULES.map(([name, what]) => (
            <div key={name} className="pl-2.5" style={{ borderLeft: `2px solid ${tone}40` }}>
              <div style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{name} check</div>
              <div style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.4, color: t.inkDim }}>Detects {what}.</div>
            </div>
          ))}
        </div>
        <P t={t} style={{ marginTop: 10, fontSize: 11 }}>
          Each rule has two toggles in Configurations: <strong style={{ color: t.ink }}>Enabled</strong> and{' '}
          <strong style={{ color: t.ink }}>Blocking</strong>. Blocking off means a finding is recorded but does not block —
          alert only. Changes apply to later scans only.
        </P>
      </Section>

      <Section t={t} icon={Package} tone={tone} title="Package a skill">
        {[['Format', 'ZIP archive'], ['Compressed', '≤ 100 MB'], ['Uncompressed', '≤ 500 MB'],
          ['Entry point', 'SKILL.md at the skill root, with name and description in its front matter']].map(([k, v]) => (
          <div key={k} className="flex gap-3 py-1" style={{ borderTop: `1px solid ${t.hairline}` }}>
            <span className="flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 500, color: t.inkDim, width: 88 }}>{k}</span>
            <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.ink }}>{v}</span>
          </div>
        ))}
        <pre dir="ltr" className="mt-2 px-2.5 py-2 rounded-lg" style={{ background: t.codeBg, fontFamily: FONT.mono, fontSize: 10, lineHeight: 1.45, color: t.inkDim, margin: 0 }}>
{`my-skill/
├── scripts/
│   └── do-query.py
├── references/
│   └── common-workflows.md
└── SKILL.md`}
        </pre>
        <CopyCmd t={t} cmd={ZIP_CMD} />
        {/* The docs disagree with themselves here — say so rather than pick. */}
        <P t={t} style={{ marginTop: 6, fontSize: 10.5 }}>
          One skill per archive is the safe choice: the packaging page allows batches of up to 100, but the troubleshooting
          page expects exactly one.
        </P>
      </Section>

      <Section t={t} icon={Fingerprint} tone={tone} title="Trust, by fingerprint">
        <P t={t}>
          Trusting a reviewed skill approves that exact bundle — later scans of the same fingerprint pass even with blocking
          findings. Any change to the skill makes a new fingerprint that has to be trusted again.
        </P>
      </Section>

      <Section t={t} icon={ShieldCheck} tone={t.pass} title="Before it shows up">
        <P t={t}>
          Needs an <strong style={{ color: t.ink }}>AI Skill Security</strong> deployment profile associated with the tenant
          and an IAM role with access to it. No license during the Preview; US region only.
        </P>
      </Section>

      <a href={DOCS_URL} target="_blank" rel="noreferrer"
         className="inline-flex items-center gap-1.5 px-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.live }}>
        <BookOpen size={12} aria-hidden="true" /> AI Supply Chain Security docs <ExternalLink size={10} aria-hidden="true" />
      </a>
    </div>
  )
}
