import React from 'react'
import { Puzzle, ExternalLink, AlertTriangle, BookOpen, ShieldCheck, ShieldX, Fingerprint, Upload } from 'lucide-react'
import { FONT, label as LBL, bloom } from '../api-intercept-2027/tokens'
import { Copyable } from '../api-intercept-2027/RecordStream'
import { scmHomeUrl } from './scanModel'

/**
 * SkillScans — AI Skill Security, as far as the portal can honestly go.
 *
 * Every statement here is from Palo Alto's AI Supply Chain Security docs
 * (the "AI Skill Security (Preview)" chapter, Sep 2026). The feature is a
 * Preview whose only documented workflow is the SCM UI — neither the docs nor
 * pan.dev publish an API to submit or list skill scans — so this panel
 * explains the capability and hands off to SCM rather than faking a history.
 * When PA publishes the API, this is where a skill-scan list belongs, beside
 * the model-scan history.
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

function Card({ t, title, children, icon: Icon, tone }) {
  return (
    <div className="mx-3 mt-2.5 px-3 py-2.5" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, borderRadius: 16, boxShadow: t.shadowSm }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={12} style={{ color: tone || t.inkDim }} />}
        <span style={{ ...LBL, fontSize: 8.5, color: tone || t.inkDim }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

const P = ({ t, children, style }) => (
  <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkDim, ...style }}>{children}</p>
)

export function SkillScans({ t, tsg }) {
  return (
    <div className="pb-3">
      <div className="mx-3 mt-3 px-3.5 py-3" style={{ background: t.panel, borderRadius: 18, boxShadow: t.shadowSm, border: `1px solid ${t.glassEdge}` }}>
        <div className="flex items-center gap-2">
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: t.sunken }}>
            <Puzzle size={15} style={{ color: t.ink }} />
          </span>
          <div className="min-w-0 flex-1">
            <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink, lineHeight: 1.15 }}>AI Skill Security</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>models decide what an agent knows · skills decide what it can do</div>
          </div>
          <span className="px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ ...LBL, fontSize: 7.5, color: t.live, background: `${t.live}16`, border: `1px solid ${t.live}40` }}>preview</span>
        </div>
        <P t={t} style={{ marginTop: 8 }}>
          Statically analyses an agent skill — a package with a <span style={{ fontFamily: FONT.mono }}>SKILL.md</span> and
          its scripts, prompts and config — against your rules, and returns an <strong style={{ color: t.pass }}>Allowed</strong> or{' '}
          <strong style={{ color: t.block }}>Blocked</strong> verdict with a fingerprint of the exact bundle.
        </P>
      </div>

      {/* Upload and history both live in SCM — the one action here is getting
          there. The Preview publishes no API, so the portal neither submits
          skills nor lists their scans. */}
      <a href={scmHomeUrl(tsg)} target="_blank" rel="noreferrer"
         className="mx-3 mt-2.5 flex items-center gap-2.5 px-3 py-2.5"
         style={{ background: `${t.block}0d`, border: `1px solid ${t.block}40`, borderRadius: 16, boxShadow: bloom(t.block, 0.35) }}>
        <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 28, height: 28, background: `${t.block}18` }}>
          <Upload size={14} style={{ color: t.block }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>Upload a skill in SCM</span>
          <span className="block" style={{ fontFamily: FONT.mono, fontSize: 9.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>
            AI Security → AI Supply Chain Security → Skill Scans → New Analysis
          </span>
        </span>
        <ExternalLink size={12} style={{ color: t.block, flexShrink: 0 }} />
      </a>

      <div className="mx-3 mt-2.5 px-3 py-2.5" style={{ background: t.sunken, border: `1px solid ${t.hairline}`, borderRadius: 16 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <AlertTriangle size={12} style={{ color: t.inkDim }} />
          <span style={{ ...LBL, fontSize: 8.5, color: t.inkDim }}>Why there is no skill-scan history here</span>
        </div>
        <P t={t}>
          AI Skill Security is a Preview whose only documented workflow is the SCM UI — Palo Alto publishes no API to submit or
          list skill scans. Model scans have one, which is why the SCM history tab can show those.
          {tsg ? <> Your tenant: <span style={{ fontFamily: FONT.mono }}>{tsg}</span>.</> : null}
        </P>
      </div>

      <Card t={t} title="Seven built-in rules" icon={ShieldX} tone={t.block}>
        <div className="space-y-1.5">
          {RULES.map(([name, what]) => (
            <div key={name}>
              <div style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: t.ink }}>{name} Check</div>
              <div style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.4, color: t.inkFaint }}>detects {what}</div>
            </div>
          ))}
        </div>
        <P t={t} style={{ marginTop: 8, fontSize: 10.5 }}>
          Each rule has two toggles in Configurations: <strong style={{ color: t.ink }}>Enabled</strong> and{' '}
          <strong style={{ color: t.ink }}>Blocking</strong>. Blocking off means a finding is recorded but does not block —
          alert only. Changes apply to later scans only.
        </P>
      </Card>

      <Card t={t} title="Package a skill" icon={Puzzle}>
        {[['Format', 'ZIP archive'], ['Compressed', '≤ 100 MB'], ['Uncompressed', '≤ 500 MB'],
          ['Entry point', 'SKILL.md at the skill root, with name and description in its front matter']].map(([k, v]) => (
          <div key={k} className="flex gap-2 py-0.5">
            <span className="flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, color: t.inkDim, width: 78 }}>{k}</span>
            <span style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.ink }}>{v}</span>
          </div>
        ))}
        <pre dir="ltr" className="mt-2 px-2.5 py-2 rounded-lg" style={{ background: t.codeBg, fontFamily: FONT.mono, fontSize: 9.5, lineHeight: 1.45, color: t.inkDim, margin: 0 }}>
{`my-skill/
├── scripts/
│   └── do-query.py
├── references/
│   └── common-workflows.md
└── SKILL.md`}
        </pre>
        <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-xl" style={{ background: t.codeBg, border: `1px solid ${t.hairline}` }}>
          <span className="flex-1 min-w-0" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.ink, wordBreak: 'break-all' }}>{ZIP_CMD}</span>
          <Copyable t={t} text={ZIP_CMD} />
        </div>
        {/* The docs disagree with themselves here — say so rather than pick. */}
        <P t={t} style={{ marginTop: 6, fontSize: 10, color: t.inkFaint }}>
          One skill per archive is the safe choice: the packaging page allows batches of up to 100, but the troubleshooting
          page expects exactly one.
        </P>
      </Card>

      <Card t={t} title="Trust, by fingerprint" icon={Fingerprint}>
        <P t={t}>
          Trusting a reviewed skill approves that exact bundle — later scans of the same fingerprint pass even with blocking
          findings. Any change to the skill makes a new fingerprint that has to be trusted again.
        </P>
      </Card>

      <Card t={t} title="Before it shows up" icon={ShieldCheck} tone={t.pass}>
        <P t={t}>
          Needs an <strong style={{ color: t.ink }}>AI Skill Security</strong> deployment profile associated with the tenant
          and an IAM role with access to it. No license during the Preview; US region only.
        </P>
      </Card>

      <a href={DOCS_URL} target="_blank" rel="noreferrer"
         className="mx-4 mt-3 inline-flex items-center gap-1" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.live }}>
        <BookOpen size={10} /> AI Supply Chain Security docs
      </a>
    </div>
  )
}
