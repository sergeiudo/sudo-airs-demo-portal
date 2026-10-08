/**
 * airs-text.js — turning documentation pages into plain text, shared by the
 * docs index worker (airs-docs-worker.js) and Ask AIRS's live fetch tool
 * (assist-agent.js). No HTML is ever rendered from this — it only feeds a
 * keyword index and a model.
 */

export const decode = (s) => String(s)
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))

/** A docs page → markdown-ish text: headings kept, lists dashed, tables piped, chrome dropped. */
export function htmlToMd(html) {
  const body = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    ?? html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    ?? html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?? html
  return decode(body
    .replace(/<(script|style|svg|button|nav|header|footer|noscript|form)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(Number(n))} ${t.replace(/<[^>]+>/g, '').replace(/​/g, '').trim()}\n\n`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|pre|table|ul|ol|section|details|summary|dd|dt)>/gi, '\n')
    .replace(/<t[dh][^>]*>/gi, ' | ')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${c.replace(/<[^>]+>/g, '')}\``)
    .replace(/<[^>]+>/g, ''))
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim()
}

export const titleOf = (html) => decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '') ?? html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '')
  .replace(/\s*\|\s*Develop with Palo Alto Networks.*$/i, '').replace(/\p{Extended_Pictographic}️?/gu, '').trim()
