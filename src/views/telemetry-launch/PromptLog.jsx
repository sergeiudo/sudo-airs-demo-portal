import React, { useState } from 'react'
import { Search, X, Trash2, Loader2, ListFilter } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { bandBg } from '../home-2027/band'
import { TraceRow, useNow } from './LiveWire'
import { FAMILY_SHORT, targetMeta, inkOn } from './telemetryModel'

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

/**
 * The prompt log: every trace in the store, newest first, scoped by the
 * console's target and filtered here by outcome, detector family and text.
 * Not windowed — the overview is the windowed view; this is the record.
 */
export function PromptLog({ t, log, filter, setFilter, target, onOpen, openId, onDelete, onClearAll }) {
  const now = useNow()
  const [confirm, setConfirm] = useState(false)
  const OUTCOMES = [
    { id: '', label: 'Everything', tone: t.live },
    { id: 'stopped', label: 'Stopped', tone: t.block },
    { id: 'cleared', label: 'Cleared', tone: t.pass },
    { id: 'unscanned', label: 'Not inspected', tone: t.warn },
  ]
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div role="radiogroup" aria-label="Outcome" className="flex items-center gap-1.5 flex-wrap">
          {OUTCOMES.map((o) => {
            const on = (filter.outcome || '') === o.id
            return (
              <button key={o.id || 'all'} type="button" role="radio" aria-checked={on} onClick={() => setFilter((f) => ({ ...f, outcome: o.id }))}
                      className={`rounded-full px-3.5 ${focusCls}`}
                      style={{
                        height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500,
                        color: on ? '#fff' : t.inkDim, background: on ? bandBg(o.tone) : t.panel,
                        border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${o.tone}40` : 'none',
                      }}>
                {o.label}
              </button>
            )
          })}
        </div>
        {filter.family && (
          <button type="button" onClick={() => setFilter((f) => ({ ...f, family: '' }))}
                  className={`inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-2 ${focusCls}`} title="Remove the detector filter"
                  style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: inkOn(t, t.block, 0.3), background: `${t.block}12`, border: `1px solid ${t.block}40` }}>
            <ListFilter size={12} aria-hidden="true" /> Detector · {FAMILY_SHORT[filter.family] ?? filter.family} <X size={12} aria-hidden="true" />
          </button>
        )}
        <label className="flex items-center gap-2 rounded-full px-3.5 flex-1" style={{ height: 34, minWidth: 200, background: t.panel, border: `1px solid ${t.hairline}` }}>
          <Search size={13} style={{ color: t.inkDim, flexShrink: 0 }} aria-hidden="true" />
          <input value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
                 placeholder="Search prompts, models, attack names, detectors…" aria-label="Search the prompt log"
                 ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
                 className="flex-1 min-w-0 outline-none" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, border: 'none' }} />
          {filter.q && (
            <button type="button" onClick={() => setFilter((f) => ({ ...f, q: '' }))} aria-label="Clear the search" className={`rounded-full ${focusCls}`}>
              <X size={13} style={{ color: t.inkDim }} aria-hidden="true" />
            </button>
          )}
        </label>
        {confirm ? (
          <span className="inline-flex items-center gap-1.5">
            <button type="button" onClick={async () => { setConfirm(false); await onClearAll() }}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                    style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: 700, color: '#fff', background: bandBg(t.block) }}>
              <Trash2 size={12} aria-hidden="true" /> Delete every trace
            </button>
            <button type="button" onClick={() => setConfirm(false)} className={`rounded-full px-3 ${focusCls}`}
                    style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.inkDim, background: t.sunken }}>
              Keep them
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} title="Delete every trace in the store — this cannot be undone"
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                  style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = t.block }} onMouseLeave={(e) => { e.currentTarget.style.color = t.inkDim }}>
            <Trash2 size={12} aria-hidden="true" /> Clear log
          </button>
        )}
      </div>

      <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
        Every trace in the store, newest first{target ? ` · ${targetMeta(target).label} only` : ''}
        {log.searching ? ' · search results do not update live' : ' · new traces appear as they land'}. Open one for its full telemetry.
      </p>

      <div className="rounded-[22px] overflow-hidden px-1.5 py-1.5" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadow }}>
        {log.error ? (
          <p className="px-3 py-4" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: inkOn(t, t.warn, 0.4) }}>Could not load traces: {log.error}</p>
        ) : !log.items.length && log.loading ? (
          <div className="flex items-center gap-2 px-3 py-4" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>
            <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : !log.items.length ? (
          <p className="px-3 py-6 text-center" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>No traces match these filters.</p>
        ) : (
          <div className="space-y-0.5">
            {log.items.map((s) => (
              <TraceRow key={s.id} t={t} s={s} onOpen={onOpen} onDelete={onDelete} now={now} selected={openId === s.id} />
            ))}
          </div>
        )}
        {log.more && (
          <div className="flex justify-center py-2">
            <button type="button" onClick={log.loadMore} disabled={log.loading}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 disabled:opacity-60 ${focusCls}`}
                    style={{ height: 32, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: inkOn(t, t.live, 0.25), background: `${t.live}12`, border: `1px solid ${t.live}40` }}>
              {log.loading && <Loader2 size={12} className="animate-spin" aria-hidden="true" />} Load 60 more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
