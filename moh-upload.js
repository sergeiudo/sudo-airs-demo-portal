/**
 * moh-upload.js — text extraction for citizen file uploads.
 *
 * A citizen attaching a referral letter, a lab result or a discharge summary is
 * the most realistic indirect-injection vector this pillar has: the document is
 * untrusted input written by somebody else, the citizen has usually not read
 * every line of it, and its text goes to the model verbatim. So the file gets
 * scanned by AIRS before it is allowed anywhere near the chat.
 *
 * Extraction is server-side on purpose. Doing PDF in the browser means shipping
 * ~1MB of pdfjs to every visitor of every pillar; here it costs two Node deps
 * and keeps the client a plain FileReader.
 *
 * Libraries chosen for ESM: `unpdf` (pdfjs under the hood, ESM-native) and
 * `mammoth`. NOT `pdf-parse` — it is CJS and reads a bundled test fixture at
 * import time when `module.parent` is unset, which throws in an ESM project.
 */

// Both extraction libraries are imported LAZILY, inside extractText.
//
// mammoth used to be a top-level import here, and moh-routes.js imports this
// module at load time — so a dependency that failed to resolve on a host took
// the whole Express server down and every pillar with it, surfacing as an
// nginx 502 rather than as "uploads are broken". A file-upload dependency must
// never be able to stop the portal from booting. Now a missing or broken
// library degrades to one failing upload with a readable message.

// Anything larger is refused rather than silently truncated — a citizen
// uploading a 300-page PDF is not a demo case, and express.json is capped at
// 10mb anyway (base64 inflates by ~33%).
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024

// How much extracted text is scanned. Documents beyond this are truncated and
// the response says so, because silently scanning 20% of a file and reporting
// "clean" is worse than admitting the limit.
export const MAX_SCAN_CHARS = 40000

// One AIRS scan per chunk. Detection is measurably more reliable on focused
// text than on one enormous blob, and a per-chunk verdict lets the UI point at
// the part of the document that tripped rather than the file as a whole.
export const CHUNK_CHARS = 4000

const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'log', 'rtf', 'xml', 'yaml', 'yml'])

export function extOf(name = '') {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

export function isSupported(name) {
  const e = extOf(name)
  return e === 'pdf' || e === 'docx' || TEXT_EXTS.has(e)
}

export function supportedList() {
  return ['pdf', 'docx', ...TEXT_EXTS]
}

/**
 * PDF text extraction that survives Hebrew.
 *
 * pdfjs emits text items in ascending x order — visual order. For an RTL line
 * that is exactly backwards, so the naive `extractText(pdf, {mergePages:true})`
 * returns Hebrew with the WORD ORDER REVERSED (letters within each word are
 * fine). Measured: the phrase "קופת חולים כללית" does not survive extraction,
 * while an LTR member number in the same document does.
 *
 * That is not cosmetic. The identical Hebrew prompt injection blocks as a .txt
 * (`agent,injection`) and is ALLOWED as a .pdf, because the scrambled word
 * order defeats the semantic detectors. AIRS is fine — the extraction was
 * destroying the payload before AIRS ever saw it. A Hebrew document could be
 * marked clean and forwarded to the model.
 *
 * Fix: rebuild lines from item positions. Group by y, then order each line by
 * x — descending when the line is RTL, ascending otherwise. pdfjs already
 * tags each item with `dir`, so the classification does not need guessing.
 *
 * This is not a full Unicode Bidi Algorithm implementation and does not claim
 * to be; it is the correct inverse of the visual-order emission for lines with
 * a single dominant direction, which is what real documents contain. Numbers
 * and Latin runs stay intact because each is its own item.
 */
const RTL_CHARS = /[֐-׿؀-ۿ܀-ݏ]/

async function extractPdfTextRtlAware(pdf) {
  const out = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()

    // Does this PAGE read right-to-left? A row of an RTL table can contain no
    // Hebrew at all — "TSH | 2.1 | 0.4–4.0 | mIU/L" is still laid out
    // right-to-left — so a per-line script test alone leaves those rows
    // reversed. Page dominance is the missing signal.
    const pageRtl = tc.items.some((i) => i.dir === 'rtl' || (typeof i.str === 'string' && RTL_CHARS.test(i.str)))

    // Group items into lines by their baseline y. Rounding absorbs the
    // sub-pixel jitter that would otherwise split one line into several.
    const lines = new Map()
    for (const it of tc.items) {
      if (typeof it.str !== 'string') continue
      const y = Math.round((it.transform?.[5] ?? 0) * 2) / 2
      if (!lines.has(y)) lines.set(y, [])
      lines.get(y).push({ x: it.transform?.[4] ?? 0, w: it.width ?? 0, str: it.str, dir: it.dir })
    }

    // Pages read top-down: descending y.
    const ys = [...lines.keys()].sort((a, b) => b - a)
    for (const y of ys) {
      const items = lines.get(y).sort((a, b) => a.x - b.x) // visual order

      // Table cells arrive as separate items with a horizontal gap and no
      // space between them. Without this, "המוגלובין | 14.2 | 13.5–17.5" comes
      // out as "המוגלובין14.217.5–13.5" and the model reads the columns as one
      // number — which produced a confidently wrong reading of a lab report.
      const toks = []
      for (let i = 0; i < items.length; i++) {
        const cur = items[i]
        toks.push(cur)
        const next = items[i + 1]
        if (!next) continue
        const gap = next.x - (cur.x + (cur.w || 0))
        const alreadySpaced = /\s$/.test(cur.str) || /^\s/.test(next.str)
        if (gap > 1.5 && !alreadySpaced) toks.push({ x: cur.x, str: ' ', dir: 'ltr', sep: true })
      }

      // A line is RTL if any item carries Hebrew/Arabic script — whitespace and
      // punctuation items are tagged 'ltr' by pdfjs and would otherwise win a
      // naive majority vote on a Hebrew line.
      // Gap-separated cells on an RTL page are a table row and follow the
      // page direction even when every cell is Latin. Ordinary prose has real
      // space characters rather than positional gaps, so it is unaffected.
      const hasCells = toks.some((tk) => tk.sep)
      const rtl = items.some((i) => i.dir === 'rtl' || RTL_CHARS.test(i.str)) || (pageRtl && hasCells)

      let ordered = toks
      if (rtl) {
        // Reverse the line, then un-reverse each contiguous LTR run. Numbers,
        // Latin words and ranges are laid out left-to-right *inside* an RTL
        // line, so a blanket reversal turns "13.5–17.5" into "17.5–13.5" — a
        // reference range silently inverted, which is worse than useless in a
        // clinical document. This is the reordering rule the Bidi algorithm
        // applies to a single embedding level.
        ordered = [...toks].reverse()
        for (let i = 0; i < ordered.length; i++) {
          if (RTL_CHARS.test(ordered[i].str) || ordered[i].sep) continue
          let j = i
          while (j < ordered.length && !RTL_CHARS.test(ordered[j].str) && !ordered[j].sep) j++
          if (j - i > 1) {
            const run = ordered.slice(i, j).reverse()
            ordered.splice(i, j - i, ...run)
          }
          i = j
        }
      }

      let line = ordered.map((i) => i.str).join('').replace(/[ \t]{2,}/g, ' ').trim()

      // Numeric ranges inside an RTL line come out swapped, and no amount of
      // item reordering fixes it: the producer bidi-reorders at layout time, so
      // the glyph run stored in the PDF is literally "17.5–13.5". Measured on a
      // Chrome-produced lab report, where it made the model read a haemoglobin
      // of 14.2 as ABOVE a "13.5 maximum" and call a normal result abnormal.
      //
      // Heuristic, stated plainly: for a bare number–number pair on an RTL
      // line, restore ascending order. Reference ranges are conventionally
      // low–high, so this is right for clinical documents; a genuinely
      // descending range would be "corrected" wrongly. It only ever touches
      // pairs of plain numbers, never text, and never affects the security
      // scan — identifiers are single tokens and are untouched either way.
      if (rtl) {
        line = line.replace(/(\d+(?:\.\d+)?)\s*([–—-])\s*(\d+(?:\.\d+)?)/g, (m, a, dash, b) =>
          Number(a) > Number(b) ? `${b}${dash}${a}` : m
        )
      }

      if (line) out.push(line)
    }
    out.push('')
  }
  return out.join('\n')
}

/**
 * Extract plain text from an uploaded buffer.
 * @returns {{ text: string, kind: string, pages: number|null, truncated: boolean, totalChars: number }}
 */
export async function extractText(buffer, name) {
  const ext = extOf(name)
  let text = ''
  let pages = null
  let kind = ext

  if (ext === 'pdf') {
    // Imported lazily so a portal that never uploads a PDF does not pay the
    // pdfjs startup cost, and so a broken install degrades to one failing
    // upload instead of a server that will not boot.
    const { getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    pages = pdf.numPages
    text = await extractPdfTextRtlAware(pdf)
    kind = 'pdf'
  } else if (ext === 'docx') {
    const { default: mammoth } = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer })
    text = value || ''
    kind = 'docx'
  } else if (TEXT_EXTS.has(ext)) {
    text = buffer.toString('utf8')
    kind = TEXT_EXTS.has(ext) ? ext : 'text'
  } else {
    const err = new Error(`Unsupported file type '.${ext}'. Supported: ${supportedList().join(', ')}`)
    err.status = 415
    throw err
  }

  // Normalise the whitespace PDFs are full of, so chunk boundaries fall in
  // sensible places and the preview is readable.
  text = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()

  const totalChars = text.length
  const truncated = totalChars > MAX_SCAN_CHARS
  if (truncated) text = text.slice(0, MAX_SCAN_CHARS)

  return { text, kind, pages, truncated, totalChars }
}

/**
 * Split text for scanning, preferring paragraph then sentence boundaries so an
 * injected instruction is less likely to be cut in half across two chunks.
 */
export function chunkText(text, size = CHUNK_CHARS) {
  const chunks = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + size, text.length)
    if (end < text.length) {
      const window = text.slice(i, end)
      const br = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf('. '))
      // Only honour a boundary in the last third, or a long paragraph would
      // collapse into a stream of tiny chunks.
      if (br > size * 0.66) end = i + br + 1
    }
    chunks.push({ index: chunks.length, start: i, text: text.slice(i, end) })
    i = end
  }
  return chunks
}
