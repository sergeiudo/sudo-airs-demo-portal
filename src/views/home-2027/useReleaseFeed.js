import { useCallback, useEffect, useState } from 'react'
import { HOME_PILLARS } from './homeData'

/**
 * useReleaseFeed — Prisma AIRS release notes for the home page's release wire.
 *
 * Reads the same /api/release-notes the Release Notes view does (scraped from
 * docs.paloaltonetworks.com, cached a day on the server). Two browser-side
 * layers keep the wire instant, because a cold server scrape takes ~10–20s:
 *   • a module cache, so Home → pillar → Home does not refetch;
 *   • the last good payload in localStorage, painted first on a new page load
 *     and replaced when the network answers.
 *
 * Each release is mapped to the pillar that demos its product area. The map is
 * by PA's product category, not by feature — so the UI says "demo the product
 * area", never "demo this feature". Areas the portal does not show (the
 * network firewall, Core, General) stay neutral.
 *
 * "New since your last visit" compares against the keys seen on the previous
 * page load. The first visit has no baseline and flags nothing.
 *
 * `refresh()` forces the server to fetch the docs again (?force=1, ~10–20s).
 * The server answers a failed refresh with the last complete fetch plus a
 * `refreshError`, so the wire keeps its data and says why. `fetchedAt` is when
 * the SERVER last read the docs — the timestamp the wire shows.
 */

const CACHE_KEY = 'sudo-airs.home.releases'
const SEEN_KEY = 'sudo-airs.home.releasesSeen'

export const AREA_PILLAR = {
  'AI Runtime API': 'apiIntercept',
  'AI Agent Security': 'apiIntercept',
  'AI Model Security': 'modelScanning',
  'AI Red Teaming': 'redTeaming',
}
export const NEUTRAL = '#7C8494'

const readJSON = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }
const writeJSON = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* private mode / quota */ } }

// Captured once per page load, before this load writes its own keys.
let prevSeen
function previousSeen() {
  if (prevSeen === undefined) prevSeen = readJSON(SEEN_KEY)
  return prevSeen
}

function shape(data) {
  if (!data?.months?.length) return null
  const seen = previousSeen()
  const seenSet = seen ? new Set(seen) : null
  const items = data.months.flatMap((m) => m.features.map((f) => {
    const pillar = HOME_PILLARS.find((p) => p.id === AREA_PILLAR[f.category]) ?? null
    const key = `${m.slug}|${f.title}`
    return {
      key, month: m.label, slug: m.slug, monthUrl: m.url,
      title: f.title, category: f.category, summary: f.summary, paragraphs: f.paragraphs ?? [],
      tags: f.tags ?? [], url: f.url || m.url,
      releaseDate: f.releaseDate ?? null, lastUpdated: f.lastUpdated ?? null,
      pillar, tone: pillar?.accent ?? NEUTRAL,
      fresh: !!seenSet && !seenSet.has(key),
    }
  }))
  return {
    items,
    months: data.months.map((m) => ({ label: m.label, slug: m.slug, url: m.url, count: m.features.length })),
    indexUrl: data.indexUrl ?? null,
    total: items.length,
    fresh: items.filter((i) => i.fresh).length,
    latest: data.months[0].label,
    oldest: data.months[data.months.length - 1].label,
    fetchedAt: data.fetchedAt ?? null,
    failedMonths: data.failedMonths ?? [],
  }
}

let memo = null      // shaped feed from this page load's network answer
let inflight = null

function load() {
  if (!inflight) {
    inflight = fetch('/api/release-notes')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => remember(data))
      .finally(() => { inflight = null })
  }
  return inflight
}

function remember(data) {
  const feed = shape(data)
  if (feed) {
    memo = feed
    writeJSON(CACHE_KEY, data)
    writeJSON(SEEN_KEY, feed.items.map((i) => i.key))
  }
  return feed
}

export function useReleaseFeed() {
  const [feed, setFeed] = useState(() => memo ?? shape(readJSON(CACHE_KEY)))
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (memo) return undefined
    let live = true
    // A failure keeps whatever the cache painted; with no cache, the wire
    // simply does not render (the release notes page shows loadError).
    load().then((f) => { if (live && f) setFeed(f) }).catch((e) => { if (live) setLoadError(e.message) })
    return () => { live = false }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const r = await fetch('/api/release-notes?force=1')
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
      const f = remember(data)
      if (f) setFeed(f)
      if (data.refreshError) throw new Error(data.refreshError)
      return true
    } catch (e) {
      setRefreshError(e.message)
      return false
    } finally {
      setRefreshing(false)
    }
  }, [])

  return { feed, refresh, refreshing, refreshError, loadError }
}
