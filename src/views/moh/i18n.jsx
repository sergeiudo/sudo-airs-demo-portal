/**
 * i18n.js — Hebrew/English strings for the Ministry of Health pillar.
 *
 * Deliberately not a library. The portal has no i18n infrastructure and no
 * router; adding react-intl for one pillar would be more moving parts than the
 * whole feature. This is a nested string map plus a context that also carries
 * `dir`, which is the part that actually matters — setting dir="rtl" on the
 * pillar root mirrors flex/grid layout for free without touching the other
 * nine pillars.
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'

const STORAGE_KEY = 'moh-lang'

export const STRINGS = {
  he: {
    app: {
      name: 'בריאות.AI',
      tagline: 'עוזר הבריאות הדיגיטלי',
      ministry: 'משרד הבריאות',
      demoBadge: 'סביבת הדגמה',
      launch: 'פתיחת אפליקציית האזרח',
      launchHint: 'נפתח בחלון חדש, ללא ממשק הפורטל — למסך המוקרן',
    },
    protection: {
      on: 'מוגן על ידי Prisma AIRS',
      off: 'ללא הגנה — התנועה אינה נסרקת',
      toggleOn: 'הפעלת הגנה',
      toggleOff: 'כיבוי הגנה',
      label: 'הגנת Prisma AIRS',
      workspaceEnforced: 'נאכף ברמת סביבת העבודה',
      workspaceHint: 'הגרדריל של Prisma AIRS מוחל על כל בקשה בסביבת העבודה, ולכן לא ניתן לכבות אותו לתנועת צ׳אט. המתג בלשונית הסוכן שולט בסריקות tool_event הישירות.',
      toolScanLabel: 'סריקת AIRS לכלים (tool_event)',
    },
    tenant: {
      label: 'יומני SCM',
      note: 'כל הסריקות בפילר הזה נרשמות בטננט SUDO-Personal (TSG 1698236796) — ולא בטננט הצוותי שמשמש את שאר הפילרים בפורטל.',
    },
    chat: {
      greeting: 'שלום! אני בריאות.AI, העוזר הדיגיטלי של משרד הבריאות. איך אוכל לעזור?',
      placeholder: 'כתבו כאן שאלה בנושא בריאות…',
      send: 'שליחה',
      clear: 'ניקוי שיחה',
      thinking: 'חושב…',
      you: 'אתם',
      assistant: 'בריאות.AI',
      disclaimer: 'המידע כללי בלבד ואינו מהווה ייעוץ רפואי, אבחון או מרשם. במקרה חירום חייגו 101.',
      chips: [
        'זימון תור לרופא משפחה',
        'אילו חיסונים צריך ילד בן שנתיים?',
        'מהו המינון של אקמול לילד במשקל 12 ק"ג?',
        'מהן זכויותיי בקופת החולים?',
      ],
    },
    upload: {
      attach: 'צירוף מסמך — ייסרק על ידי Prisma AIRS לפני השליחה',
      scanning: 'נסרק…',
      clean: 'נקי — אפשר לשלוח',
      blocked: 'נחסם — לא יישלח למודל',
      failed: 'קריאת הקובץ נכשלה',
      remove: 'הסרה',
      truncated: 'נסרקו {n} התווים הראשונים בלבד',
      incomplete: 'חלק מהמסמך לא נסרק — אין להתייחס לתוצאה כ"נקי"',
      viewInScm: 'צפייה ביומן SCM',
      unscanned: 'לא נסרק — הגנת AIRS כבויה',
      dropTitle: 'צירוף מסמך',
      dropSubtitle: 'המסמך נסרק לפני שתו אחד ממנו מגיע למודל.',
      drop: 'גררו קובץ לכאן',
      or: 'או',
      browse: 'בחרו קובץ מהמחשב',
      dropNow: 'שחררו כדי לצרף',
      formats: 'סוגי קבצים נתמכים',
      maxSize: 'גודל מרבי',
      scannedLabel: 'נסרק',
      scannedValue: '{n} התווים הראשונים',
      protectedNote: 'Prisma AIRS סורק את המסמך לאיתור הזרקות פרומפט ומידע רגיש לפני השליחה. קובץ שנחסם אינו מגיע למודל.',
      unprotectedNote: 'הגנת AIRS כבויה — הקובץ הזה לא ייסרק לפני שיגיע למודל.',
      retention: 'הקובץ אינו נשמר בדיסק. ביומן נרשמים רק שם הקובץ ומספר התווים.',
      reading: 'קורא את הקובץ…',
    },
    blocked: {
      title: 'הבקשה נחסמה על ידי Prisma AIRS',
      body: 'זוהתה פנייה שעלולה לסכן מידע רפואי או לפגוע בבטיחות המטופל. הפנייה לא הועברה למודל.',
      bodyOutput: 'תשובת המודל נחסמה לפני שהוצגה, לאחר שזוהה בה תוכן אסור.',
      category: 'קטגוריה',
      scanId: 'מזהה סריקה',
      showDetails: 'הצגת פרטים',
      hideDetails: 'הסתרת פרטים',
      stage: 'שלב חסימה',
      // Which of the enforcement points actually stopped it. Without this the
      // audience cannot tell a prompt block from a tool block.
      points: {
        prompt: 'שער ה-AI · הפרומפט',
        params: 'AIRS ישיר · פרמטרי הכלי',
        output: 'AIRS ישיר · פלט הכלי',
        answer: 'שער ה-AI · התשובה',
      },
    },
    console: {
      title: 'קונסולת אבטחה',
      open: 'פתיחת קונסולת אבטחה — הכרעת AIRS, שלבי הסריקה והמטענים הגולמיים',
      short: 'אבטחה',
      close: 'סגירה',
      verdict: 'הכרעה',
      allowed: 'אושר',
      blockedShort: 'נחסם',
      direct: 'ללא סריקה',
      latency: 'זמן תגובה',
      model: 'מודל',
      profile: 'פרופיל AIRS',
      threats: 'איומים שזוהו',
      none: 'לא זוהו איומים',
      stage1: 'שלב 1 — סריקת קלט (טרם המודל)',
      stage2: 'שלב 2 — סריקת פלט (לאחר המודל)',
      toolStage1: 'שלב 1 — פרמטרים של הכלי',
      toolStage2: 'שלב 2 — פלט הכלי',
      gatewayScan: 'סריקת שער ה-AI',
      directScan: 'סריקת AIRS ישירה (tool_event)',
      payloads: 'מטעני API של AIRS',
      viewInScm: 'צפייה בקונסולת SCM',
      replayed: 'שוחזר מהמטמון',
      noRun: 'הריצו תרחיש כדי לראות נתוני אבטחה.',
    },
    demo: {
      title: 'לוח בקרה להדגמה',
      open: 'לוח בקרה להדגמה — ספריית התקיפות, מתג ההגנה ואיפוס מצב',
      short: 'הדגמה',
      attacks: 'ספריית תקיפות',
      language: 'שפה',
      model: 'מודל',
      run: 'הרצה',
      running: 'רץ…',
      reset: 'איפוס מצב הדגמה',
      expected: 'זיהוי צפוי',
      why: 'למה זה חשוב למשרד הבריאות',
      severity: { critical: 'קריטי', high: 'גבוה', medium: 'בינוני', none: 'ללא' },
      legendVerified: 'נבדק ועובד',
      verifiedHint: 'נמדד — נחסם בהרצות חוזרות',
      legendLeaky: 'דולף בכוונה — להדגמה ללא הגנה',
      legendIntermittent: 'לא יציב',
      legendUnavailable: 'חסום',
    },
    families: {
      runtime: 'תקיפות זמן ריצה',
      rag: 'הרעלת מסמכים (RAG)',
      agent: 'סוכנים וכלים',
      governance: 'ממשל, DLP ופרטיות',
    },
    tabs: {
      overview: 'סקירה',
      chat: 'צ׳אט חי',
      rag: 'מסמכים קליניים',
      agent: 'סוכן ושירותים',
      mcp: 'שרשרת אספקת כלים',
      matrix: 'מטריצת זיהוי',
      governance: 'ממשל ופרטיות',
    },
    mcp: {
      title: 'שרשרת אספקת כלים (MCP)',
      subtitle: 'העוזר אינו מפעיל רק את השירותים של המשרד. הוא מתחבר לשרתי MCP שגורמים אחרים מפעילים — וכל רשימת כלים שהם מחזירים היא קלט לא מהימן שהמודל קורא והאזרח לעולם לא רואה.',
      servers: 'שרתים מחוברים',
      firstParty: 'שרת המשרד',
      thirdParty: 'ספק חיצוני',
      tools: 'כלים',
      scenarios: 'תרחישי הדגמה',
      run: 'הפעלת tools/list',
      running: 'סורק…',
      manifest: 'רשימת הכלים שהוחזרה',
      manifestBlocked: 'הרשימה נחסמה — הכלים לא הועברו למודל',
      verdict: 'פסיקת AIRS',
      description: 'תיאור הכלי (נקרא על ידי המודל)',
      payloadHint: 'הטקסט הזה לא מוצג לאזרח לעולם',
      measured: 'נמדד בפרופיל הזה',
      knownGap: 'פער ידוע — לא מזוהה בשתי השפות',
      langGap: 'מזוהה באנגלית, לא בעברית',
      reset: 'איפוס מצב',
      listCount: 'קריאות tools/list',
      step1: 'רשימה ראשונה — נקייה',
      step2: 'רשימה שנייה — מורעלת',
      invoke: 'הפעלת הכלי',
      noRun: 'בחר תרחיש והפעל tools/list כדי לראות מה AIRS עושה עם רשימת הכלים.',
    },
    rag: {
      retrieved: 'מסמכים שאוחזרו',
      poisoned: 'מסמך מורעל',
      clean: 'מסמך תקין',
      answer: 'תשובת המערכת',
      sources: 'מקורות',
      augmented: 'הפרומפט המורחב',
      risk: {
        benign: 'תקין',
        phi: 'מידע רפואי מזוהה',
        injection: 'הזרקת הוראות',
        malicious_url: 'כתובת זדונית',
        dosage_poison: 'מינון שגוי',
        authority_spoof: 'התחזות לרשות',
      },
    },
    agent: {
      tool: 'כלי',
      params: 'פרמטרים',
      result: 'תוצאה',
      memory: 'זיכרון הסוכן',
      suppressed: 'הפלט נחסם ולא הוחזר למודל',
      invoke: 'הפעלת כלי',
    },
    matrix: {
      title: 'זיהוי בעברית מול אנגלית',
      subtitle: 'אותו מטען, שתי שפות, אותו פרופיל AIRS.',
      run: 'הרצת המטריצה',
      running: 'סורק…',
      expect: 'צפוי',
      gapsTitle: 'פערים בעברית',
      gapsBody: 'מטענים שנחסמו באנגלית אך אושרו בעברית.',
      noGaps: 'אין פערים — זיהוי בעברית זהה לאנגלית במדגם זה.',
      detected: 'זוהו',
      falsePositives: 'התרעות שווא',
    },
    arch: {
      title: 'ארכיטקטורה — שתי נקודות אכיפה, מדיניות אחת',
      caption: 'כל פנייה למודל נבדקת על ידי גרדריל AIRS בשער ה-AI של SCM. כל קריאה לכלי נסרקת בנוסף ישירות מול AIRS כאירוע tool_event — שלב 1 על הפרמטרים לפני שמשהו מתבצע, שלב 2 על הפלט לפני שהמודל רואה אותו. שתי נקודות אכיפה, פרופיל AIRS אחד.',
    },
    corpus: {
      tabScenarios: 'תרחישים',
      tabDocs: 'מאגר המסמכים',
      pickDoc: 'בחרו מסמך כדי לקרוא אותו במלואו.',
      providerFiltered: 'התשובה סוננה על ידי מסנן התוכן של ספק המודל (Bedrock) — לא על ידי AIRS. סינון זה אינו בשליטתכם ואינו מייצר תיעוד או התראה.',
      revealHidden: 'חשיפת תווים נסתרים',
      hideHidden: 'הסתרת תווים נסתרים',
      hiddenFound: 'נמצאו {n} תווים בלתי נראים (Unicode Tags) — ההוראה הזדונית מוסתרת בהם ואינה נראית כלל בעת הצגת המסמך.',
      compare: 'השוואה לגרסה התקינה',
      cleanVersion: 'הגרסה התקינה',
      poisonedVersion: 'הגרסה המורעלת',
      findings: 'ממצאים',
      disclaimer: 'כל המסמכים סינתטיים ונוצרו לצורך ההדגמה בלבד. התוכן הרפואי בגרסאות המורעלות שגוי במכוון ואין להסתמך עליו.',
    },
    banner: {
      workspaceMode: 'כל בקשה בסביבת עבודה זו נסרקת על ידי Prisma AIRS — תוכן זדוני נחסם, תנועה תקינה עוברת.',
      flaggedNote: 'Prisma AIRS סימן את הפנייה, אך התשובה הוחזרה בכל זאת — כדאי לבדוק את פרטי הסריקה בקונסולת האבטחה.',
    },
    common: {
      on: 'פעיל',
      off: 'כבוי',
      loading: 'טוען…',
      error: 'שגיאה',
      retry: 'ניסיון חוזר',
      copy: 'העתקה',
      copied: 'הועתק',
      close: 'סגירה',
      ms: 'מ״ש',
      notConfigured: 'לא מוגדר',
      setupNeeded: 'נדרשת הגדרה',
    },
  },

  en: {
    app: {
      name: 'Briut.AI',
      tagline: 'Digital health assistant',
      ministry: 'Ministry of Health',
      demoBadge: 'Demo environment',
      launch: 'Launch citizen app',
      launchHint: 'Opens in a new window with no portal chrome — for the projector',
    },
    protection: {
      on: 'Protected by Prisma AIRS',
      off: 'Unprotected — traffic is not scanned',
      toggleOn: 'Turn protection on',
      toggleOff: 'Turn protection off',
      label: 'Prisma AIRS protection',
      workspaceEnforced: 'enforced at workspace level',
      workspaceHint: 'The Prisma AIRS guardrail applies to every request in this workspace, so it cannot be switched off for chat traffic. The toggle on the Agent tab controls the direct tool_event scans.',
      toolScanLabel: 'AIRS tool scanning (tool_event)',
    },
    tenant: {
      label: 'SCM logs',
      note: 'Every scan in this pillar is logged to the SUDO-Personal tenant (TSG 1698236796) — not the team tenant the other portal pillars use.',
    },
    chat: {
      greeting: "Hello! I'm Briut.AI, the Ministry of Health digital assistant. How can I help?",
      placeholder: 'Ask a health question…',
      send: 'Send',
      clear: 'Clear conversation',
      thinking: 'Thinking…',
      you: 'You',
      assistant: 'Briut.AI',
      disclaimer: 'General information only — not medical advice, diagnosis or a prescription. In an emergency call 101.',
      chips: [
        'Book an appointment with a family doctor',
        'Which vaccinations does a two-year-old need?',
        'What is the Acamol dose for a 12kg child?',
        'What are my health-fund member rights?',
      ],
    },
    upload: {
      attach: 'Attach a document — scanned by Prisma AIRS before it is sent',
      scanning: 'scanning…',
      clean: 'clean — ready to send',
      blocked: 'blocked — will not reach the model',
      failed: 'could not read this file',
      remove: 'Remove',
      truncated: 'only the first {n} characters were scanned',
      incomplete: 'part of the document was not scanned — do not read this as clean',
      viewInScm: 'View in SCM',
      unscanned: 'NOT SCANNED — AIRS is off',
      dropTitle: 'Attach a document',
      dropSubtitle: 'It is scanned before a single character reaches the model.',
      drop: 'Drop a file here',
      or: 'or',
      browse: 'browse your computer',
      dropNow: 'Release to attach',
      formats: 'Supported formats',
      maxSize: 'Maximum size',
      scannedLabel: 'Scanned',
      scannedValue: 'first {n} characters',
      protectedNote: 'Prisma AIRS scans the document for prompt injection and sensitive data before it is sent. A blocked file never reaches the model.',
      unprotectedNote: 'AIRS is OFF — this file will NOT be scanned before it reaches the model.',
      retention: 'The file is never written to disk. Only its name and character count are recorded in the trace.',
      reading: 'Reading file…',
    },
    blocked: {
      title: 'Request blocked by Prisma AIRS',
      body: 'A request was detected that could expose medical data or harm patient safety. It never reached the model.',
      bodyOutput: 'The model response was blocked before it was shown, after prohibited content was detected in it.',
      category: 'Category',
      scanId: 'Scan ID',
      showDetails: 'Show details',
      hideDetails: 'Hide details',
      stage: 'Blocked at',
      points: {
        prompt: 'AI Gateway · prompt',
        params: 'Direct AIRS · tool parameters',
        output: 'Direct AIRS · tool output',
        answer: 'AI Gateway · answer',
      },
    },
    console: {
      title: 'Security console',
      open: 'Open the security console — AIRS verdict, scan stages and raw payloads',
      short: 'Security',
      close: 'Close',
      verdict: 'Verdict',
      allowed: 'ALLOWED',
      blockedShort: 'BLOCKED',
      direct: 'NOT SCANNED',
      latency: 'Latency',
      model: 'Model',
      profile: 'AIRS profile',
      threats: 'Threats detected',
      none: 'No threats detected',
      stage1: 'Stage 1 — input scan (pre-model)',
      stage2: 'Stage 2 — output scan (post-model)',
      toolStage1: 'Stage 1 — tool parameters',
      toolStage2: 'Stage 2 — tool output',
      gatewayScan: 'AI Gateway guardrail scan',
      directScan: 'Direct AIRS scan (tool_event)',
      payloads: 'AIRS API payloads',
      viewInScm: 'View in SCM Console',
      replayed: 'Replayed from cache',
      noRun: 'Run a scenario to see security telemetry.',
    },
    demo: {
      title: 'Demo control panel',
      open: 'Demo control panel — attack library, protection switch and reset',
      short: 'Demo',
      attacks: 'Attack library',
      language: 'Language',
      model: 'Model',
      run: 'Run',
      running: 'Running…',
      reset: 'Reset demo state',
      expected: 'Expected detection',
      why: 'Why this matters to the Ministry',
      severity: { critical: 'Critical', high: 'High', medium: 'Medium', none: 'None' },
      legendVerified: 'verified',
      verifiedHint: 'Measured — blocks on repeated runs',
      legendLeaky: 'leaks — for the unprotected demo',
      legendIntermittent: 'unstable',
      legendUnavailable: 'blocked',
    },
    families: {
      runtime: 'Runtime attacks',
      rag: 'Document poisoning (RAG)',
      agent: 'Agents & tools',
      governance: 'Governance, DLP & privacy',
    },
    tabs: {
      overview: 'Overview',
      chat: 'Live chat',
      rag: 'Clinical documents',
      agent: 'Agent & services',
      mcp: 'Tool supply chain',
      matrix: 'Detection matrix',
      governance: 'Governance & privacy',
    },
    mcp: {
      title: 'Tool supply chain (MCP)',
      subtitle: 'The assistant does not only call the ministry’s own services. It connects to MCP servers other people operate — and every tool listing they return is untrusted input that the model reads and the citizen never sees.',
      servers: 'Connected servers',
      firstParty: 'Ministry server',
      thirdParty: 'Third-party vendor',
      tools: 'tools',
      scenarios: 'Demo scenarios',
      run: 'Run tools/list',
      running: 'Scanning…',
      manifest: 'Returned tool listing',
      manifestBlocked: 'Listing blocked — the tools never reached the model',
      verdict: 'AIRS verdict',
      description: 'Tool description (read by the model)',
      payloadHint: 'this text is never shown to the citizen',
      measured: 'Measured on this profile',
      knownGap: 'Known gap — missed in both languages',
      langGap: 'Detected in English, missed in Hebrew',
      reset: 'Reset state',
      listCount: 'tools/list calls',
      step1: 'First listing — clean',
      step2: 'Second listing — poisoned',
      invoke: 'Call the tool',
      noRun: 'Pick a scenario and run tools/list to see what AIRS does with the manifest.',
    },
    rag: {
      retrieved: 'Retrieved documents',
      poisoned: 'Poisoned document',
      clean: 'Clean document',
      answer: 'Assistant answer',
      sources: 'Sources',
      augmented: 'Augmented prompt',
      risk: {
        benign: 'Clean',
        phi: 'PHI exposure',
        injection: 'Prompt injection',
        malicious_url: 'Malicious URL',
        dosage_poison: 'Wrong dosage',
        authority_spoof: 'Authority spoofing',
      },
    },
    agent: {
      tool: 'Tool',
      params: 'Parameters',
      result: 'Result',
      memory: 'Agent memory',
      suppressed: 'Output blocked — never returned to the model',
      invoke: 'Invoke tool',
    },
    matrix: {
      title: 'Hebrew vs English detection',
      subtitle: 'Same payload, two languages, one AIRS profile.',
      run: 'Run the matrix',
      running: 'Scanning…',
      expect: 'Expected',
      gapsTitle: 'Hebrew gaps',
      gapsBody: 'Payloads blocked in English but allowed in Hebrew.',
      noGaps: 'No gaps — Hebrew detection matches English on this set.',
      detected: 'detected',
      falsePositives: 'false positives',
    },
    arch: {
      title: 'Architecture — two enforcement points, one policy',
      caption: 'Every model turn is inspected by the AIRS guardrail on the SCM AI Gateway. Every tool call is additionally scanned directly by AIRS as a tool_event — stage 1 on the parameters before anything executes, stage 2 on the output before the model ever sees it. Two enforcement points, one AIRS profile.',
    },
    corpus: {
      tabScenarios: 'Scenarios',
      tabDocs: 'Document corpus',
      pickDoc: 'Pick a document to read it in full.',
      providerFiltered: 'The response was filtered by the model provider (Bedrock), not by AIRS. That filter is not one you configure, and it produces no log or alert of its own.',
      revealHidden: 'Reveal hidden characters',
      hideHidden: 'Hide hidden characters',
      hiddenFound: '{n} invisible characters (Unicode Tags block) — the malicious instruction is encoded in them and renders as nothing at all.',
      compare: 'Compare with clean version',
      cleanVersion: 'Clean version',
      poisonedVersion: 'Poisoned version',
      findings: 'findings',
      disclaimer: 'All documents are synthetic and exist only for this demo. The clinical content in the poisoned variants is deliberately wrong and must not be relied on.',
    },
    banner: {
      workspaceMode: 'Every request in this workspace is scanned by Prisma AIRS — malicious content is blocked, benign traffic passes through.',
      flaggedNote: 'Prisma AIRS flagged this request, but a response was still returned — check the scan detail in the security console.',
    },
    common: {
      on: 'On',
      off: 'Off',
      loading: 'Loading…',
      error: 'Error',
      retry: 'Retry',
      copy: 'Copy',
      copied: 'Copied',
      close: 'Close',
      ms: 'ms',
      notConfigured: 'Not configured',
      setupNeeded: 'Setup needed',
    },
  },
}

/** Resolve a dot path, falling back to English, then to the path itself. */
function resolve(lang, path) {
  const walk = (obj) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
  const hit = walk(STRINGS[lang])
  if (hit !== undefined) return hit
  const fallback = walk(STRINGS.en)
  return fallback !== undefined ? fallback : path
}

const MohLangContext = createContext(null)

export function MohLangProvider({ children, initialLang }) {
  const [lang, setLangState] = useState(() => {
    if (initialLang) return initialLang
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'he' || stored === 'en') return stored
    } catch {}
    return 'he'
  })

  const setLang = useCallback((next) => {
    setLangState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }, [])

  const value = useMemo(() => {
    const t = (path) => resolve(lang, path)
    return {
      lang,
      setLang,
      toggleLang: () => setLang(lang === 'he' ? 'en' : 'he'),
      dir: lang === 'he' ? 'rtl' : 'ltr',
      isRtl: lang === 'he',
      t,
      /** Pick the matching side of a { he, en } object. */
      pick: (obj) => (obj == null ? '' : typeof obj === 'string' ? obj : obj[lang] ?? obj.en ?? obj.he ?? ''),
    }
  }, [lang, setLang])

  return <MohLangContext.Provider value={value}>{children}</MohLangContext.Provider>
}

export function useMohLang() {
  const ctx = useContext(MohLangContext)
  if (!ctx) throw new Error('useMohLang must be used inside <MohLangProvider>')
  return ctx
}

/** Hebrew glyph detection — used to font/direction-switch model output per message. */
export function isHebrewText(str) {
  return /[\u0590-\u05FF]/.test(String(str || ''))
}

/** Direction for a specific piece of content, independent of UI language. */
export function contentDir(str) {
  return isHebrewText(str) ? 'rtl' : 'ltr'
}
