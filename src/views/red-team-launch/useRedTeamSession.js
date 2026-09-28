import { useCallback, useEffect, useRef, useState } from 'react'
import { TERMINAL, DEFAULT_SELECTION, campaignName, apiMessage } from './redTeamModel'

/**
 * useRedTeamSession — the Red Teaming launch console's behaviour.
 *
 * Same API calls and cadence as the Classic view (RedTeamingView, left as it
 * is): targets from /api/redteam/targets, the same POST body for a campaign,
 * status polled every 8s and attacks every 10s (first at 5s) until the job is
 * terminal, 50 landed + 50 resisted attacks per poll.
 *
 * Added for the launch console:
 *   • the current campaign, the chosen target and the builder live at module
 *     scope, so a trip to Home keeps them — and a campaign still running
 *     resumes polling when the pillar opens again;
 *   • any past campaign can be opened from History (GET /api/redteam/scan,
 *     paged), which is how a demo shows a finished report: a new campaign
 *     takes minutes to hours;
 *   • failures are kept and shown, where Classic logged them to the console.
 */

const store = {
  campaignId: null,
  targetId: null,
  jobType: 'STATIC',
  categories: DEFAULT_SELECTION,
  railTab: 'build',
}

async function getJSON(url, init) {
  const r = await fetch(url, init)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(apiMessage(d) || `HTTP ${r.status}`), { status: r.status, body: d })
  return d
}

function useStored(key) {
  const [v, setV] = useState(store[key])
  const set = useCallback((next) => {
    setV((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      store[key] = value
      return value
    })
  }, [key])
  return [v, set]
}

export function useRedTeamSession() {
  // ── targets ──
  const [targets, setTargets] = useState({ list: [], loading: true, error: null })
  const [targetId, setTargetId] = useStored('targetId')
  const [jobType, setJobType] = useStored('jobType')
  const [categories, setCategories] = useStored('categories')
  const [railTab, setRailTab] = useStored('railTab')

  const loadTargets = useCallback(() => {
    setTargets((s) => ({ ...s, loading: true, error: null }))
    getJSON('/api/redteam/targets')
      .then((d) => {
        const list = d.data ?? []
        setTargets({ list, loading: false, error: null })
        setTargetId((id) => (id && list.some((x) => x.uuid === id) ? id : list[0]?.uuid ?? null))
      })
      .catch((e) => setTargets({ list: [], loading: false, error: e.message }))
  }, [setTargetId])
  useEffect(() => { loadTargets() }, [loadTargets])

  const target = targets.list.find((x) => x.uuid === targetId) ?? null

  const addTarget = useCallback((created) => {
    setTargets((s) => ({ ...s, list: [created, ...s.list.filter((x) => x.uuid !== created.uuid)] }))
    setTargetId(created.uuid)
  }, [setTargetId])

  // ── the campaign on screen ──
  const [campaignId, setCampaignId] = useStored('campaignId')
  const [job, setJob] = useState(null)
  const [jobError, setJobError] = useState(null)
  const [attacks, setAttacks] = useState({ landed: [], resisted: [], totals: null, loaded: false })
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState(null)
  const [aborting, setAborting] = useState(false)
  const [finishedKey, setFinishedKey] = useState(0)
  const timers = useRef([])
  const [history, setHistory] = useState({ list: [], total: null, loading: false, error: null, loaded: false })
  const [historyKey, setHistoryKey] = useState(0)

  const stop = useCallback(() => {
    timers.current.forEach((x) => { clearInterval(x); clearTimeout(x) })
    timers.current = []
  }, [])

  const pollAttacks = useCallback(async (id) => {
    try {
      const [landed, resisted] = await Promise.all([
        getJSON(`/api/redteam/scan/${id}/attacks?limit=50&threat=true`),
        getJSON(`/api/redteam/scan/${id}/attacks?limit=50&threat=false`),
      ])
      if (store.campaignId !== id) return
      setAttacks({
        landed: landed.data ?? [], resisted: resisted.data ?? [], loaded: true,
        totals: { landed: landed.pagination?.total_items ?? null, resisted: resisted.pagination?.total_items ?? null },
      })
    } catch {
      if (store.campaignId === id) setAttacks((a) => ({ ...a, loaded: true }))
    }
  }, [])

  const pollStatus = useCallback(async (id) => {
    try {
      const d = await getJSON(`/api/redteam/scan/${id}`)
      if (store.campaignId !== id) return null
      setJob(d)
      setJobError(null)
      if (TERMINAL.has(d.status)) {
        stop()
        pollAttacks(id)
        setFinishedKey((k) => k + 1)
      }
      return d
    } catch (e) {
      if (store.campaignId === id) setJobError(e.message)
      return null
    }
  }, [stop, pollAttacks])

  // Open (or resume) whatever campaign is current.
  useEffect(() => {
    stop()
    setJob(null)
    setJobError(null)
    setAttacks({ landed: [], resisted: [], totals: null, loaded: false })
    if (!campaignId) return undefined
    let live = true
    pollStatus(campaignId).then((d) => {
      if (!live || !d) return
      if (TERMINAL.has(d.status)) return
      timers.current.push(setInterval(() => pollStatus(campaignId), 8000))
      timers.current.push(setInterval(() => pollAttacks(campaignId), 10000))
      timers.current.push(setTimeout(() => pollAttacks(campaignId), 5000))
    })
    return () => { live = false; stop() }
  }, [campaignId, pollStatus, pollAttacks, stop])

  const launch = useCallback(async () => {
    if (!target) return
    setLaunching(true)
    setLaunchError(null)
    try {
      const body = {
        name: campaignName(target),
        target: { uuid: target.uuid },
        job_type: jobType,
        job_metadata: jobType === 'STATIC'
          ? { categories, rate_limit_enabled: false, content_filter_enabled: false }
          : { rate_limit_enabled: false, content_filter_enabled: false },
      }
      const d = await getJSON('/api/redteam/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!d.uuid) throw new Error('The campaign was not created — no id came back')
      setCampaignId(d.uuid)
      setJob(d)
      setHistoryKey((k) => k + 1)
    } catch (e) {
      setLaunchError(e.message)
    } finally {
      setLaunching(false)
    }
  }, [target, jobType, categories, setCampaignId])

  const abort = useCallback(async () => {
    if (!campaignId) return
    setAborting(true)
    try {
      await getJSON(`/api/redteam/scan/${campaignId}/abort`, { method: 'POST' })
      await pollStatus(campaignId)
    } catch (e) {
      setJobError(`Abort failed: ${e.message}`)
    } finally {
      setAborting(false)
    }
  }, [campaignId, pollStatus])

  const openCampaign = useCallback((id) => { setLaunchError(null); setCampaignId(id) }, [setCampaignId])
  const newCampaign = useCallback(() => { setLaunchError(null); setCampaignId(null); setRailTab('build') }, [setCampaignId, setRailTab])

  // ── history ──
  const loadHistory = useCallback((skip = 0) => {
    setHistory((h) => ({ ...h, loading: true, error: null }))
    getJSON(`/api/redteam/scan?limit=25&skip=${skip}`)
      .then((d) => setHistory((h) => ({
        list: skip ? [...h.list, ...(d.data ?? [])] : d.data ?? [],
        total: d.pagination?.total_items ?? null, loading: false, error: null, loaded: true,
      })))
      .catch((e) => setHistory((h) => ({ ...h, loading: false, error: e.message, loaded: true })))
  }, [])
  useEffect(() => { if (railTab === 'history' || historyKey) loadHistory(0) }, [railTab, historyKey, finishedKey, loadHistory])

  const running = !!job && !TERMINAL.has(job.status)

  return {
    targets, target, targetId, setTargetId, addTarget, reloadTargets: loadTargets,
    jobType, setJobType, categories, setCategories, railTab, setRailTab,
    campaignId, job, jobError, attacks, running, finishedKey,
    launch, launching, launchError, abort, aborting, openCampaign, newCampaign,
    history: { ...history, more: history.total != null && history.list.length < history.total ? () => loadHistory(history.list.length) : null, reload: () => loadHistory(0) },
  }
}
