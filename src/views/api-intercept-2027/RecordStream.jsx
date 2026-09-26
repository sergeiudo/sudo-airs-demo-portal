import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, FileText, ShieldCheck, ShieldX, AlertTriangle, Brain, Wrench,
  Route, ListTree, Server, Globe, Copy, Check, Activity, Ban, Crosshair, ChevronDown,
} from 'lucide-react'
import { Languages, RotateCcw, Loader2 } from 'lucide-react'
import { FONT, label as LBL, SEVERITY, VERDICT_META, verdictOf, glass, bloom } from './tokens'
import { SecurityAnalysis } from './SecurityAnalysis'
import { bandBg, bandDots } from '../home-2027/band'
import { Markdown } from './Markdown'

/**
 * Two looks, like the evidence pane: 'classic' (the v1 console) and 'band'
 * (RuntimeLaunch) — disclosures become cards with a gradient icon, the block
 * notice takes the verdict band's gradient, labels drop their capitals.
 */
export const StreamLook = createContext('classic')
const useBand = () => useContext(StreamLook) === 'band'

// The original console's list, kept verbatim — this is a demo prop for a
// multilingual room, and a shorter list quietly drops languages someone came
// to see their own payload rendered in. Flags carry the scan at a glance.
const LANGUAGES = [
  { label: 'English',            flag: '🇺🇸' },
  { label: 'Spanish',            flag: '🇪🇸' },
  { label: 'Russian',            flag: '🇷🇺' },
  { label: 'German',             flag: '🇩🇪' },
  { label: 'French',             flag: '🇫🇷' },
  { label: 'Japanese',           flag: '🇯🇵' },
  { label: 'Portuguese',         flag: '🇧🇷' },
  { label: 'Italian',            flag: '🇮🇹' },
  { label: 'Simplified Chinese', flag: '🇨🇳' },
  { label: 'Hebrew',             flag: '🇮🇱' },
]

/** Copy · resend · translate, the way the original console had them. */
function Actions({ t, prompt, response, onResend, onTranslate, translating, onOpenTrace, traceId, align = 'start' }) {
  const [copied, setCopied] = useState(null)
  const [langOpen, setLangOpen] = useState(false)
  const copy = (what, text) => {
    navigator.clipboard?.writeText(text)
    setCopied(what); setTimeout(() => setCopied(null), 1100)
  }
  const Btn = ({ onClick, icon: Icon, children, tone, title }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick() }} title={title}
            className="flex items-center gap-1 transition-opacity hover:opacity-100"
            style={{
              fontFamily: FONT.prose, fontSize: 10, fontWeight: 500,
              color: tone || t.inkFaint, opacity: tone ? 1 : 0.75,
            }}>
      <Icon size={11} /> {children}
    </button>
  )
  return (
    <div className={`relative flex flex-wrap items-center gap-3 mt-1.5 px-0.5 ${align === 'end' ? 'justify-end' : ''}`}>
      <Btn onClick={() => copy('prompt', prompt)} icon={copied === 'prompt' ? Check : Copy}
           tone={copied === 'prompt' ? t.pass : null} title="Copy the payload">
        {copied === 'prompt' ? 'Copied' : 'Copy'}
      </Btn>
      {response && (
        <Btn onClick={() => copy('response', response)} icon={copied === 'response' ? Check : Copy}
             tone={copied === 'response' ? t.pass : null} title="Copy the response">
          {copied === 'response' ? 'Copied' : 'Copy reply'}
        </Btn>
      )}
      {onResend && (
        <Btn onClick={() => onResend(prompt)} icon={RotateCcw} title="Fire this payload again">Resend</Btn>
      )}
      {onTranslate && (
        <Btn onClick={() => setLangOpen((o) => !o)} icon={translating ? Loader2 : Languages}
             title="Translate the payload — sent unprotected so the translation itself is not scanned">
          {translating ? 'Translating…' : 'Translate'}
        </Btn>
      )}
      {traceId && onOpenTrace && (
        <Btn onClick={() => onOpenTrace(traceId)} icon={Activity} tone={t.live} title="Open the full trace">
          Telemetry
        </Btn>
      )}

      <AnimatePresence>
        {langOpen && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className={`absolute z-30 top-full mt-1 p-1 rounded-xl max-h-[320px] overflow-y-auto ${align === 'end' ? 'right-0' : 'left-0'}`}
                      style={{ ...glass(t, { radius: 14 }), minWidth: 178 }}>
            {LANGUAGES.map(({ label, flag }) => (
              <button key={label}
                      onClick={(e) => { e.stopPropagation(); setLangOpen(false); onTranslate(prompt, label) }}
                      className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = t.sunken }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{flag}</span>{label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * RecordStream — the transcript as a stack of evidence cards.
 *
 * Each turn is one card carrying a coloured verdict rail down its left edge and
 * a matching glow, so scanning the column answers "what got through" before you
 * read a word. Cards animate in; an interception lands with a flash and leaves
 * a struck VOID panel where the answer would have been — a blocked answer must
 * never read as a missing message.
 */

export function Copyable({ t, text, children }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1100) }}
      className="inline-flex items-center gap-1 transition-colors"
      style={{ color: done ? t.pass : t.inkFaint }} title="Copy"
    >
      {children}{done ? <Check size={10} /> : <Copy size={10} />}
    </button>
  )
}

/**
 * FaultNotice — what a failed call shows.
 *
 * Until this existed, `verdict: 'ERROR'` rendered nothing at all: the error
 * message carries `content: null`, so the transcript printed a bare FAULT chip
 * and the actual reason sat unread in the record's telemetry. On stage that
 * reads as the app being broken.
 *
 * The common cause by far is an expired credential, and both providers fail
 * with a distinctive string, so the panel matches on those and prints the exact
 * fix with a copy button — no hunting through CLAUDE.md mid-demo.
 *
 * The remedy is host-aware on purpose. A Vertex auth failure means a lapsed ADC
 * login on a laptop, but on the EC2 host Vertex runs on Workload Identity
 * Federation and there is no login to renew — telling someone to run
 * `gcloud auth application-default login` there would send them the wrong way.
 */
const FAULT_REMEDIES = [
  {
    id: 'vertex-adc',
    match: /GoogleAuthError|Unable to authenticate your request|invalid_grant|Reauthentication|application default credentials|could not (load|refresh) the default credentials/i,
    title: 'Vertex credentials have expired',
    local: {
      why: 'The corp SSO session behind your Application Default Credentials has lapsed. There is no key file to replace — just sign in again.',
      cmd: 'gcloud auth application-default login',
      after: 'Then restart the Express server: GoogleAuth caches its client in-process, so a running server keeps using the dead credential.',
    },
    remote: {
      why: 'This host authenticates to Vertex with Workload Identity Federation off its instance role, so there is no login to renew. Check that GOOGLE_APPLICATION_CREDENTIALS still points at the WIF config and that the instance role is attached.',
      cmd: 'pm2 restart airs-server --update-env',
      after: 'A plain `pm2 restart` reuses the environment pm2 captured at first start, and dotenv will not overwrite an env var that already exists.',
    },
  },
  {
    id: 'bedrock-sts',
    match: /security token included in the request is invalid|ExpiredToken|InvalidClientTokenId|UnrecognizedClientException/i,
    title: 'AWS credentials have expired',
    local: {
      why: 'The AWS keys in .env are ASIA… STS credentials, which are short-lived. All three values must be refreshed together.',
      cmd: 'AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN',
      after: 'Paste a fresh set into .env and restart the Express server.',
    },
    remote: {
      why: 'This host uses its IAM instance role for Bedrock rather than keys, so an expired-token error points at the role or its trust policy, not at .env.',
      cmd: 'aws sts get-caller-identity',
      after: 'Run it on the host — if that fails too, the instance role itself is the problem.',
    },
  },
]

function FaultNotice({ t, reason }) {
  const text = String(reason || '').trim()
  // A browser pointed at localhost is the dev laptop; anything else is a
  // deployed host, where the remedies genuinely differ.
  const isLocal = typeof window !== 'undefined'
    && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
  const hit = FAULT_REMEDIES.find((r) => r.match.test(text))
  const fix = hit && (isLocal ? hit.local : hit.remote)
  const band = useBand()

  return (
    <div className="px-4 py-3 w-full" style={{
      background: `${t.warn}0f`, border: `1px solid ${t.warn}44`,
      borderRadius: 20, borderBottomLeftRadius: 6,
    }}>
      {band ? (
        <div className="flex items-center gap-2.5 mb-2">
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: bandBg(t.warn) }}>
            <AlertTriangle size={14} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>
            {hit ? hit.title : 'The call did not complete'}
          </span>
        </div>
      ) : (
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle size={13} style={{ color: t.warn }} />
        <span style={{ ...LBL, fontSize: 9, color: t.warn }}>
          {hit ? hit.title : 'The call did not complete'}
        </span>
      </div>
      )}

      {text && (
        <p style={{
          fontFamily: FONT.mono, fontSize: 10.5, lineHeight: 1.5, color: t.inkDim,
          wordBreak: 'break-word', overflowWrap: 'anywhere',
        }}>
          {text}
        </p>
      )}

      {fix && (
        <div className="mt-2.5">
          <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.55, color: t.inkDim }}>
            {fix.why}
          </p>
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl"
               style={{ background: t.codeBg, border: `1px solid ${t.hairline}` }}>
            <span className="flex-1 min-w-0" style={{
              fontFamily: FONT.mono, fontSize: 11.5, color: t.ink,
              wordBreak: 'break-all', userSelect: 'all',
            }}>
              {fix.cmd}
            </span>
            <Copyable t={t} text={fix.cmd} />
          </div>
          <p className="mt-1.5" style={{ fontFamily: FONT.prose, fontSize: 10, lineHeight: 1.5, color: t.inkFaint }}>
            {fix.after}
          </p>
        </div>
      )}
    </div>
  )
}

export function Reveal({ t, icon: Icon, title, count, accent, children, defaultOpen = false, sub }) {
  const [open, setOpen] = useState(defaultOpen)
  const band = useBand()
  const c = accent || t.inkDim
  if (band) {
    // Closed, two cards share a row; open, one takes the full width.
    return (
      <div className="rounded-2xl overflow-hidden"
           style={{
             flex: open ? '1 1 100%' : '1 1 250px', maxWidth: '100%',
             background: t.panel, border: `1px solid ${open ? `${c}55` : t.hairline}`,
             boxShadow: open ? `0 10px 24px ${c}1a` : t.shadowSm,
             transition: 'border-color 160ms ease, box-shadow 200ms ease',
           }}>
        <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }} aria-expanded={open}
                className="w-full flex items-center gap-3 text-left" style={{ padding: '9px 10px' }}>
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: bandBg(c), boxShadow: `0 4px 10px ${c}40` }}>
            {Icon && <Icon size={15} style={{ color: '#fff' }} aria-hidden="true" />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
            {(sub ?? count) && <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>{sub ?? count}</span>}
          </span>
          <ChevronDown size={14} className="flex-shrink-0" style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} aria-hidden="true" />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-3.5 pb-3">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
  return (
    <div className="rounded-xl overflow-hidden transition-all"
         style={{
           background: t.sunken,
           border: `1px solid ${open ? `${c}44` : t.hairline}`,
           width: open ? '100%' : 'fit-content',
           maxWidth: '100%',
         }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
      >
        <ChevronRight size={12} style={{ color: c, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }} />
        {Icon && <Icon size={12} style={{ color: c }} />}
        <span style={{ ...LBL, fontSize: 9.5, color: open ? c : t.inkDim }}>{title}</span>
        {count != null && (
          <span className={open ? 'ml-auto px-1.5 rounded-full' : 'px-1.5 rounded-full'}
                style={{ fontFamily: FONT.mono, fontSize: 9.5, color: c, background: `${c}1a` }}>
            {count}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Chip({ t, tone, children, glow }) {
  return (
    <span className="px-2 py-0.5 rounded-full"
          style={{
            ...LBL, fontSize: 8.5, color: tone,
            background: `${tone}1c`, border: `1px solid ${tone}4d`,
            boxShadow: glow ? bloom(tone, 0.45) : 'none',
          }}>
      {children}
    </span>
  )
}

const BACKEND_LABEL = {
  vertex: 'Vertex AI', bedrock: 'Bedrock', azure: 'Azure OpenAI', aigw: 'SCM AI-GW',
}

/**
 * Which backend a record actually ran on.
 *
 * Read from the server's own `summary.model` stamp (`bedrock/anthropic…`,
 * `aigw/@sudo-bedrock/…`), never from the current picker. Taking it from the
 * picker meant a historical record rewrote its own security context when you
 * switched target — a Bedrock block would start claiming the SCM AI Gateway
 * enforced it. The transcript is evidence; it does not get to change its story.
 */
function recordBackend(assistant, fallback) {
  const head = String(assistant?.telemetry?.summary?.model ?? '').split('/')[0]
  return BACKEND_LABEL[head] ? head : fallback
}

/** Any Hebrew letter. Drives font + direction for the whole record. */
const HEBREW_RE = /[\u0590-\u05FF]/
const hasHebrew = (s) => HEBREW_RE.test(String(s ?? ''))

function detectorKeys(d) {
  if (!d) return []
  return Array.isArray(d) ? d : Object.entries(d).filter(([, v]) => v).map(([k]) => k)
}

// ─── MCP reasoning ────────────────────────────────────────────────────────────

const STEP = {
  route:    { icon: Route,    label: 'ROUTE' },
  discover: { icon: ListTree, label: 'DISCOVER' },
  think:    { icon: Brain,    label: 'REASON' },
  tool:     { icon: Wrench,   label: 'TOOL' },
  answer:   { icon: ShieldCheck, label: 'ANSWER' },
  blocked:  { icon: ShieldX,  label: 'BLOCKED' },
  error:    { icon: AlertTriangle, label: 'FAULT' },
}

function ScanTag({ t, label, scan }) {
  if (!scan) return null
  if (scan.error) return <Chip t={t} tone={t.warn}>{label} failed</Chip>
  const bad = scan.action === 'block'
  return <Chip t={t} tone={bad ? t.block : t.pass} glow={bad}>{label} {bad ? String(scan.category || 'blocked') : 'clean'}</Chip>
}

function Reasoning({ t, mcp }) {
  const [raw, setRaw] = useState({})
  const tools = mcp.steps.filter((s) => s.kind === 'tool').length
  const stopped = mcp.steps.filter((s) => s.blocked || s.kind === 'blocked').length

  return (
    <Reveal t={t} icon={Brain} accent={stopped ? t.block : t.model}
            title="Chain of thought"
            count={`${mcp.steps.length} steps · ${tools} tools${stopped ? ` · ${stopped} stopped` : ''}`}>
      <div className="relative pl-4">
        <div className="absolute left-1 top-1 bottom-1" style={{ width: 2, background: `linear-gradient(180deg, ${t.model}66, ${t.model}11)` }} />
        {mcp.steps.map((s, i) => {
          const k = STEP[s.kind] ?? STEP.answer
          const Icon = k.icon
          const key = `${i}-${s.kind}`
          const bad = s.blocked || s.kind === 'blocked'
          const c = bad ? t.block : t.model
          return (
            <motion.div key={key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }} className="relative py-2">
              <span className="absolute rounded-full" style={{
                left: -15, top: 10, width: 8, height: 8, background: c, boxShadow: bloom(c, bad ? 1.2 : 0.5),
              }} />
              <div className="flex items-center gap-2 flex-wrap">
                <Icon size={11} style={{ color: c }} />
                <span style={{ ...LBL, fontSize: 8, color: c }}>{k.label}</span>
                <span style={{ fontFamily: FONT.display, fontSize: 12, fontWeight: 600, color: t.ink }}>{s.title}</span>
                {s.brokered === true && <Chip t={t} tone={t.block}><Server size={8} style={{ display: 'inline' }} /> via gw</Chip>}
                {s.brokered === false && <Chip t={t} tone={t.warn}><Globe size={8} style={{ display: 'inline' }} /> direct</Chip>}
                <ScanTag t={t} label="manifest" scan={s.scan} />
                <ScanTag t={t} label="params" scan={s.inputScan} />
                <ScanTag t={t} label="result" scan={s.outputScan} />
              </div>
              {s.detail && <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkDim, marginTop: 3 }}>{s.detail}</p>}
              {s.toolNames?.length > 0 && (
                <p style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint, marginTop: 3, wordBreak: 'break-all' }}>
                  {s.toolNames.join(' · ')}
                </p>
              )}
              {s.args && Object.keys(s.args).length > 0 && (
                <pre className="mt-1.5 px-2.5 py-2 rounded-lg overflow-x-auto"
                     style={{ background: t.codeBg, fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, direction: 'ltr' }}>
                  {JSON.stringify(s.args, null, 2).slice(0, 600)}
                </pre>
              )}
              {s.error && <p style={{ fontFamily: FONT.prose, fontSize: 10.5, color: bad ? t.block : t.warn, marginTop: 3 }}>{s.error}</p>}
              {s.result && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setRaw((r) => ({ ...r, [key]: !r[key] })) }}
                          style={{ ...LBL, fontSize: 8, color: t.inkFaint, marginTop: 4 }}>
                    {raw[key] ? 'hide' : 'show'} result · {s.result.length.toLocaleString()} chars
                  </button>
                  {raw[key] && (
                    <pre className="mt-1.5 px-2.5 py-2 rounded-lg overflow-auto whitespace-pre-wrap break-all"
                         style={{ background: t.codeBg, fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, maxHeight: 220, direction: 'ltr' }}>
                      {s.result}
                    </pre>
                  )}
                </>
              )}
            </motion.div>
          )
        })}
      </div>
    </Reveal>
  )
}

// ─── Record card ──────────────────────────────────────────────────────────────

/**
 * One turn, rendered as a conversation.
 *
 * The payload is a right-hand bubble and the model's reply is a left-hand
 * bubble, the way any messaging client does it — this is a chatbot demo and it
 * should read like one. Everything the security story needs hangs *off* the
 * reply rather than replacing it: a one-line verdict strip under the bubble,
 * then the analysis behind a disclosure, so the conversation stays the thing
 * you look at and the evidence is one click away.
 *
 * A block is a real bubble too, not a missing message — an empty gap would read
 * as the app failing rather than the control working.
 */
/**
 * The blocked reply. Reads as an incident note from the control, not an error
 * from the app: what fired, where it fired, under which profile, and the
 * explicit reassurance that the model never saw the prompt — which is the
 * question every customer asks next.
 */
/**
 * The block notice, in the language of the payload.
 *
 * A Hebrew prompt that comes back blocked in English reads as though a
 * different system answered — and Inter and Space Grotesk carry no Hebrew, so
 * the fallback font made it look broken on top of that. Same treatment the MOH
 * pillar uses: Heebo, RTL, and the copy translated rather than transliterated.
 */
function BlockedNotice({ t, backend, stage, telemetry, he }) {
  const band = useBand()
  const isAigw = backend === 'aigw'
  const heFont = 'Heebo, Inter, sans-serif'
  const stageHe = stage === 'output gate' ? 'שער היציאה' : 'שער הכניסה'

  const facts = he
    ? (isAigw
        ? [
            'הבדיקה בוצעה על ידי Prisma AIRS.',
            'המדיניות נאכפה בתוך שער ה-AI, לפני שהבקשה יצאה ממנו.',
            'המודל לא הופעל, והעוזר מעולם לא ראה את הפרומפט.',
          ]
        : [
            'הבקשה נסרקה על ידי Prisma AIRS Runtime API לפני ביצוע הקריאה.',
            `נעצרה ב${stageHe} — הבקשה לא הגיעה לספק.`,
            'לא נוצר ולא הוחזר פלט חלקי.',
          ])
    : (isAigw
        ? [
            'Evaluated by Prisma AIRS runtime security.',
            'Policy enforced inside the SCM AI Gateway, before the request left it.',
            'The model was never invoked and the assistant never saw the prompt.',
          ]
        : [
            'Scanned by the Prisma AIRS Runtime API before the call was made.',
            `Stopped at the ${stage} — the request never reached the provider.`,
            'No partial output was generated or returned.',
          ])

  const headline = he
    ? (isAigw
        ? 'מנגנון ההגנה של Prisma AIRS בתוך שער ה-AI זיהה בקשה לא בטוחה וחסם אותה.'
        : 'Prisma AIRS יירט את הבקשה וחסם אותה לפני שהגיעה למודל.')
    : (isAigw
        ? 'The Prisma AIRS guardrail inside the SCM AI Gateway detected an unsafe request and blocked it.'
        : 'Prisma AIRS intercepted this request and blocked it before it reached the model.')

  const contextLabel = he
    ? (isAigw ? 'שער ה-AI · הקשר אבטחה' : 'זמן ריצה · הקשר אבטחה')
    : (isAigw ? 'Gateway · security context' : 'Runtime · security context')

  return (
    <motion.div
      initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 26 }}
      dir={he ? 'rtl' : 'ltr'}
      className="relative overflow-hidden px-5 py-4"
      style={{
        background: band ? bandBg(t.block) : t.block,
        borderRadius: 26,
        [he ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 8,
        boxShadow: `0 14px 34px ${t.block}55`,
      }}
    >
      {band ? (
        /* the verdict band's texture and watermark, so the notice and the
           evidence pane read as the same event */
        <>
          <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
          <ShieldX aria-hidden="true" strokeWidth={1.3} className="pointer-events-none"
                   style={{ position: 'absolute', [he ? 'left' : 'right']: -26, bottom: -46, width: 170, height: 170, color: '#fff', opacity: 0.13, transform: 'rotate(-10deg)' }} />
        </>
      ) : (
        <>
          {/* the reference's faint concentric rings in the corner */}
          <span className="absolute pointer-events-none" style={{
            right: -40, top: -40, width: 150, height: 150, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.16)',
          }} />
          <span className="absolute pointer-events-none" style={{
            right: -14, top: -58, width: 150, height: 150, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
          }} />
        </>
      )}

      <div className="relative flex items-start gap-3">
        <span className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.18)' }}>
          <Ban size={16} color="#fff" />
        </span>
        <div className="min-w-0">
          <p style={{
            fontFamily: he ? heFont : FONT.display,
            fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: '#fff',
          }}>
            {headline}
          </p>

          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.22)' }}>
            {/* LBL is Space Grotesk + uppercase; neither does anything useful
                for Hebrew, so the label drops to Heebo at its natural case. */}
            <div style={he
              ? { fontFamily: heFont, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }
              : band
              ? { fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }
              : { ...LBL, fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
              {contextLabel}
            </div>
            <ul className="space-y-1.5">
              {facts.map((f) => (
                <li key={f} className="flex items-start gap-2"
                    style={{
                      fontFamily: he ? heFont : FONT.prose,
                      fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.94)',
                    }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>·</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function Record({ t, user, assistant, onSelect, selected, onOpenTrace, onResend, onTranslate, translating, backend }) {
  const [hover, setHover] = useState(false)
  const v = verdictOf(assistant)
  const meta = VERDICT_META[v]
  const att = user?.attachment
  const sev = user?.attackMeta?.severity ? SEVERITY[user.attackMeta.severity] : null
  const stage = assistant?.telemetry?.outputScan?.action === 'block' ? 'output gate' : 'input gate'
  // JetBrains Mono and Inter ship no Hebrew subset, so a Hebrew payload was
  // rendering in whatever the browser fell back to.
  const ranOn = recordBackend(assistant, backend)
  const heIn = hasHebrew(user?.content)
  const heOut = hasHebrew(assistant?.content)
  const detected = detectorKeys(assistant?.telemetry?.summary?.threats_detected ?? assistant?.telemetry?.inputScan?.prompt_detected)
  const time = new Date(user?.timestamp ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const band = useBand()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(assistant ?? user)}
      className="px-5 py-2"
      style={{ background: selected ? `${meta.color}08` : 'transparent', borderRadius: 14 }}
    >
      {/* ── Outgoing ─────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <div className="flex flex-col items-end" style={{ maxWidth: '74%' }}>
          {user?.attackMeta && (
            <div className="flex items-center gap-1.5 mb-1 flex-wrap justify-end">
              <span style={{ fontFamily: FONT.display, fontSize: 10.5, fontWeight: 700, color: t.inkDim }}>
                {user.attackMeta.label}
              </span>
              {sev && (
                <span className="px-1.5 rounded-full" style={{ ...LBL, fontSize: 7.5, color: sev, background: `${sev}1c`, border: `1px solid ${sev}44` }}>
                  {user.attackMeta.severity}
                </span>
              )}
            </div>
          )}

          {att && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded-2xl"
                 style={{ background: t.sunken, border: `1px solid ${att.scanned ? `${t.pass}44` : `${t.warn}44`}` }}>
              <FileText size={12} style={{ color: att.scanned ? t.pass : t.warn }} />
              <span className="truncate" style={{ fontFamily: FONT.display, fontSize: 11, fontWeight: 600, color: t.ink, maxWidth: 180 }}>
                {att.name}
              </span>
              <span style={{ ...LBL, fontSize: 7, color: att.scanned ? t.pass : t.warn }}>
                {att.scanned ? 'scanned' : 'not scanned'}
              </span>
            </div>
          )}

          {/* The outgoing payload stays monospace — on an attack it is evidence,
              and a proportional font hides the whitespace and homoglyph tricks
              half the library depends on. Same surface as the reply, so the two
              read as one exchange. */}
          <div className="px-4 py-3"
               style={{
                 // Tinted with `live` — the colour the CLIENT node carries in
                 // both architecture diagrams, so "this came from us" is the
                 // same blue wherever it appears. On the warm grey ground an
                 // untinted bubble washed out into the background.
                 background: t.isLight ? 'rgba(74,118,240,0.09)' : 'rgba(74,118,240,0.16)',
                 border: `1px solid ${t.isLight ? 'rgba(74,118,240,0.20)' : 'rgba(74,118,240,0.28)'}`,
                 borderRadius: 20, borderBottomRightRadius: 6,
                 fontFamily: heIn ? 'Heebo, Inter, sans-serif' : FONT.mono,
                 fontSize: heIn ? 13.5 : 12, lineHeight: 1.55, color: t.ink,
                 whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                 direction: heIn ? 'rtl' : 'ltr', textAlign: heIn ? 'right' : 'left',
               }}>
            {user?.content}
          </div>

          <span className="mt-1" style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>
            {time}{user?.attackMeta?.technique ? ` · ${user.attackMeta.technique}` : ''}
          </span>

          <AnimatePresence>
            {(hover || selected) && (
              <motion.div initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Actions
                  t={t} prompt={user?.content} response={assistant?.content}
                  onResend={onResend} onTranslate={onTranslate} translating={translating}
                  onOpenTrace={onOpenTrace} traceId={assistant?.traceId}
                  align="end"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Incoming ─────────────────────────────────────────────── */}
      {assistant && (
        <div className="flex justify-start mt-2.5">
          <div className="flex flex-col items-start w-full" style={{ maxWidth: '82%' }}>
            {v === 'blocked' ? (
              <BlockedNotice t={t} backend={ranOn} stage={stage} telemetry={assistant.telemetry} he={heIn} />
            ) : v === 'error' ? (
              <FaultNotice t={t} reason={assistant.blockReason} />
            ) : assistant.content ? (
              /* Rendered markdown, not pre-wrapped text: a tool-calling answer
                 comes back as a table and used to land as a wall of pipes. */
              <div className="px-4 py-3 w-full"
                   style={{
                     background: t.sunken, border: `1px solid ${t.hairline}`,
                     borderRadius: 20, borderBottomLeftRadius: 6,
                     fontFamily: heOut ? 'Heebo, Inter, sans-serif' : FONT.prose,
                     fontSize: heOut ? 14 : 13, lineHeight: 1.65, color: t.inkDim,
                     wordBreak: 'break-word', overflowWrap: 'anywhere',
                     direction: heOut ? 'rtl' : 'ltr', textAlign: heOut ? 'right' : 'left',
                   }}>
                <Markdown text={assistant.content} t={t} />
              </div>
            ) : null}

            {/* one-line verdict strip */}
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              {v !== 'blocked' && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                      style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}55` }}>
                  {v === 'passed' ? <ShieldCheck size={10} style={{ color: meta.color }} />
                    : <AlertTriangle size={10} style={{ color: meta.color }} />}
                  <span style={band
                    ? { fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: meta.color }
                    : { ...LBL, fontSize: 8.5, color: meta.color }}>
                    {band ? meta.label.charAt(0) + meta.label.slice(1).toLowerCase() : meta.label}
                  </span>
                </span>
              )}
              {/* Which target answered. A session can legitimately hold several
                  — comparing the same payload across backends is the point of
                  the pillar — but then each record has to say which it was. */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      fontFamily: band ? FONT.prose : FONT.mono, fontSize: band ? 11 : 9, color: t.inkDim,
                      background: t.sunken, border: `1px solid ${t.hairline}`,
                    }}>
                <Crosshair size={9} style={{ color: t.inkFaint }} />
                {BACKEND_LABEL[ranOn] ?? ranOn}
              </span>
              {assistant.tokensOut != null && (
                <span style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>
                  {assistant.tokensIn ?? '—'}/{assistant.tokensOut} tok
                </span>
              )}
            </div>

            {/* evidence, folded away. The band look drops Security analysis:
                the evidence pane beside the transcript and the telemetry drawer
                already carry all of it, so under every reply it was a third copy. */}
            <div className="w-full mt-2 flex flex-wrap items-start gap-1.5">
              {!band && assistant.telemetry?.inputScan && (
                <Reveal t={t} icon={ShieldCheck} title="Security analysis" accent={meta.color}
                        count={assistant.telemetry.inputScan.profile_name}>
                  <SecurityAnalysis t={t} telemetry={assistant.telemetry}
                                    promptText={user?.content} responseText={assistant?.content} />
                </Reveal>
              )}
              {assistant.mcp?.steps?.length > 0 && <Reasoning t={t} mcp={assistant.mcp} />}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export function RecordStream({ variant = 'classic', ...props }) {
  return (
    <StreamLook.Provider value={variant}>
      <Stream {...props} band={variant === 'band'} />
    </StreamLook.Provider>
  )
}

function Stream({ t, messages, isLoading, onSelect, selectedId, onOpenTrace, empty, onResend, onTranslate, translating, backend, band }) {
  const endRef = useRef(null)

  const records = useMemo(() => {
    const out = []
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      if (m.role !== 'user') continue
      const next = messages[i + 1]
      const assistant = next?.role === 'assistant' ? next : null
      const ranOn = recordBackend(assistant, null)
      // Mark the first record after a target switch, so a mixed transcript
      // reads as two runs rather than one confusing one.
      const prev = out.length ? out[out.length - 1].ranOn : null
      out.push({ user: m, assistant, ranOn, switched: !!(ranOn && prev && ranOn !== prev) })
    }
    return out
  }, [messages])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length, isLoading])

  if (!records.length) return <div className="flex-1 overflow-y-auto min-h-0 flex">{empty}</div>

  return (
    <div className="flex-1 overflow-y-auto min-h-0 pt-3">
      <AnimatePresence initial={false}>
        {records.map((r, i) => (
          <React.Fragment key={r.user.id}>
          {r.switched && (
            <div className="flex items-center gap-2 mx-4 my-3">
              <span className="flex-1" style={{ height: 1, background: t.hairline }} />
              <span style={{ ...LBL, fontSize: 8, color: t.inkFaint }}>
                target switched to {BACKEND_LABEL[r.ranOn] ?? r.ranOn}
              </span>
              <span className="flex-1" style={{ height: 1, background: t.hairline }} />
            </div>
          )}
          <Record t={t} user={r.user} assistant={r.assistant} index={i}
                  onSelect={onSelect} selected={selectedId && (r.assistant?.id === selectedId || r.user.id === selectedId)}
                  onOpenTrace={onOpenTrace} onResend={onResend} onTranslate={onTranslate}
                  translating={translating === r.user.content} backend={backend} />
          </React.Fragment>
        ))}
      </AnimatePresence>

      {isLoading && (
        <div className="flex items-center gap-3 mx-3 mb-3 px-4 py-3 rounded-xl"
             style={{ background: t.sunken, border: `1px solid ${t.live}3a` }}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="rounded-full" style={{ width: 7, height: 7, background: t.live, boxShadow: bloom(t.live, 0.8) }}
                         animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                         transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
          ))}
          <span style={band ? { fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.live } : { ...LBL, fontSize: 9.5, color: t.live }}>
            {band ? 'On the line…' : 'On the line'}
          </span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
