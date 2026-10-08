/**
 * assist-routes.js — Ask AIRS, the Prisma AIRS sidekick (/api/assist).
 *
 *   GET  /status   the docs index (airs-docs.js): collections, pages, passages
 *   GET  /search   one keyword search, no model (scripts/eval-assist.mjs uses it)
 *   POST /ask      { question } → a stream of server-sent events while Claude
 *                  researches the official docs with tools (assist-agent.js):
 *                  step… sources… answer | error
 *
 * A docs helper: nothing is scanned, nothing is stored, no question is logged.
 */
import express from 'express'
import { ensureDocs, docsStatus, search as searchDocs } from './airs-docs.js'
import { runSidekick } from './assist-agent.js'

const router = express.Router()

const HITS = new Map()
function limited(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim()
  const now = Date.now()
  const recent = (HITS.get(ip) || []).filter((t) => now - t < 10 * 60e3)
  if (recent.length >= 30) {
    res.status(429).json({ error: 'Ask AIRS is limited to 30 questions per 10 minutes. Try again shortly.' })
    return true
  }
  recent.push(now)
  HITS.set(ip, recent)
  if (HITS.size > 5000) HITS.delete(HITS.keys().next().value)
  return false
}

const PRODUCTS = { runtime: 'AI Runtime Security', gateway: 'AI Gateway', supply: 'AI Supply Chain Security', redteam: 'AI Red Teaming', agents: 'AI Agent Identity' }

router.get('/status', (_req, res) => {
  ensureDocs()
  res.json(docsStatus())
})

router.get('/search', (req, res) => {
  ensureDocs()
  const q = String(req.query.q || '').slice(0, 300)
  const hits = q.trim() ? searchDocs(q, { k: Math.max(1, Math.min(20, Number(req.query.k) || 10)), perPage: 1 }) : []
  res.json({
    status: docsStatus(),
    hits: hits.map((h, i) => ({ n: i + 1, title: h.title, heading: h.heading, section: h.section, source: h.collectionLabel, product: PRODUCTS[h.product] ?? h.product, url: h.url, snippet: h.text.replace(/\s+/g, ' ').slice(0, 260), score: h.score })),
  })
})

router.post('/ask', async (req, res) => {
  if (limited(req, res)) return
  ensureDocs()
  const question = String(req.body?.question || '').trim().slice(0, 800)
  if (!question) return res.status(400).json({ error: 'Ask a question.' })
  const status = docsStatus()
  if (status.state !== 'ready') {
    return res.status(503).json({ status, error: status.state === 'building' ? 'The docs are being indexed — about two minutes after a first start.' : 'The docs index is not available yet.' })
  }

  // Server-sent events. X-Accel-Buffering: no — nginx on EC2 must not hold the stream.
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  let open = true
  // res, not req: a request's 'close' fires once its body is read, not on disconnect.
  res.on('close', () => { open = false })
  const send = (evt) => { if (open) res.write(`data: ${JSON.stringify(evt)}\n\n`) }
  const beat = setInterval(() => { if (open) res.write(': ping\n\n') }, 10000)
  send({ type: 'status', status })
  try {
    await runSidekick(question, send)
  } catch (e) {
    send({ type: 'error', error: String(e?.message || e).slice(0, 400) })
  } finally {
    clearInterval(beat)
    send({ type: 'done' })
    res.end()
  }
})

export default router
