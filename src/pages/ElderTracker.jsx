import { useState, useMemo, useRef, useEffect } from 'react'
import { ELDER_DATA, calcElderProgress } from '../lib/nestingEngine'
import { isAdmin } from '../lib/roleUtils'
import styles from './ElderTracker.module.css'

export default function ElderTracker({ user, dragons = [], myDragons = [], onTick }) {
  const userIsAdmin = isAdmin(user)
  const [viewMode, setViewMode] = useState('mine')   // 'mine' | 'all'
  const [filter, setFilter] = useState('all')   // all | in-progress | elder | no-data

  // Pool: my dragons only or all clan dragons
  const pool = (userIsAdmin && viewMode === 'all') ? dragons : myDragons

  // Only dragons with species data that we have elder info for
  // ⚠ depends on `pool` (which changes with viewMode) — NOT on `dragons` directly
  const tracked = useMemo(() => {
    return pool
      .filter(d => d.species && ELDER_DATA[d.species])
      .map(d => ({
        dragon: d,
        progress: calcElderProgress(d.species, d.ticks ?? 0),
      }))
      .sort((a, b) => (b.progress?.pct ?? 0) - (a.progress?.pct ?? 0))
  }, [pool])   // ← was [dragons], which never reflected viewMode changes

  const filtered = useMemo(() => {
    switch (filter) {
      case 'elder':       return tracked.filter(t => t.progress?.isElder)
      case 'in-progress': return tracked.filter(t => !t.progress?.isElder && (t.dragon.ticks ?? 0) > 0)
      case 'no-data':     return tracked.filter(t => !t.dragon.ticks || t.dragon.ticks === 0)
      default:            return tracked
    }
  }, [tracked, filter])

  const elderCount      = tracked.filter(t => t.progress?.isElder).length
  const inProgressCount = tracked.filter(t => !t.progress?.isElder && (t.dragon.ticks ?? 0) > 0).length
  const noDataCount     = tracked.filter(t => !t.dragon.ticks || t.dragon.ticks === 0).length

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={`cinzel ${styles.title}`}>Elder Tracker</h2>
          <p className={styles.sub}>Track tick progression and time to elder for each dragon</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {userIsAdmin && (
            <div style={{ display: 'flex', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--bg-border)', overflow: 'hidden' }}>
              {[['mine', 'My Dragons'], ['all', 'All Members']].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: viewMode === mode ? 'var(--accent)' : 'transparent',
                    color: viewMode === mode ? '#fff' : 'var(--text-muted)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >{label}</button>
              ))}
            </div>
          )}
          <div className={styles.headerStats}>
            <div className={styles.hStat}>
              <span className={`cinzel ${styles.hStatNum}`} style={{ color: 'var(--elder)' }}>{elderCount}</span>
              <span className={styles.hStatLabel}>Elders</span>
            </div>
            <div className={styles.hStat}>
              <span className={`cinzel ${styles.hStatNum}`} style={{ color: 'var(--accent)' }}>{inProgressCount}</span>
              <span className={styles.hStatLabel}>In Progress</span>
            </div>
            <div className={styles.hStat}>
              <span className={`cinzel ${styles.hStatNum}`} style={{ color: 'var(--text-muted)' }}>{noDataCount}</span>
              <span className={styles.hStatLabel}>No Ticks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.filterRow}>
        {[
          ['all', `All (${tracked.length})`],
          ['in-progress', `In Progress (${inProgressCount})`],
          ['elder', `Elders (${elderCount})`],
          ['no-data', `No Data (${noDataCount})`],
        ].map(([id, lbl]) => (
          <button
            key={id}
            className={`${styles.filterBtn} ${filter === id ? styles.filterActive : ''}`}
            onClick={() => setFilter(id)}
          >{lbl}</button>
        ))}
      </div>

      {/* Species reference panel */}
      <div className={styles.refGrid}>
        {Object.entries(ELDER_DATA).map(([species, data]) => (
          <div key={species} className={styles.refCard}>
            <span className={`cinzel ${styles.refSpecies}`}>{species}</span>
            <div className={styles.refStats}>
              <span className={styles.refStat}><b>{data.elderTicks}</b> ticks</span>
              <span className={styles.refStat}><b>{data.ticksPerDay}</b>/day</span>
              <span className={styles.refStat}><b>{data.daysToElder}</b> days</span>
              <span className={styles.refStat}>Class <b>{data.class}</b></span>
            </div>
          </div>
        ))}
      </div>

      {/* Dragon list */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>⬡</span>
          <p>No dragons found for this filter.</p>
          <p className={styles.emptySub}>Add ticks to your dragons via Edit, or use F8 capture.</p>
        </div>
      ) : (
        <div className={styles.dragonList}>
          {filtered.map(({ dragon: d, progress: p }) => (
            <ElderCard key={d.id} dragon={d} progress={p} onTick={onTick} />
          ))}
        </div>
      )}
    </div>
  )
}

function ElderCard({ dragon: d, progress: p, onTick }) {
  if (!p) return null
  const [ctx, setCtx] = useState(null)

  const pctDisplay = (p.pct * 100).toFixed(1)
  const isElder    = p.isElder

  function handleContextMenu(e) {
    e.preventDefault()
    e.stopPropagation()
    setCtx({ x: e.clientX, y: e.clientY })
  }

  return (
    // position:relative so the ctx menu portal can escape; cursor hints right-click
    <div
      className={`${styles.card} ${isElder ? styles.cardElder : ''} fade-in`}
      onContextMenu={handleContextMenu}
      style={{ position: 'relative', cursor: 'context-menu', userSelect: 'none' }}
    >
      {ctx && (
        <ElderCtxMenu
          x={ctx.x} y={ctx.y}
          dragon={d} isElder={isElder}
          onTick={() => { onTick?.(d); setCtx(null) }}
          onClose={() => setCtx(null)}
        />
      )}
      {/* Left: identity */}
      <div className={styles.cardLeft}>
        <div className={styles.cardSpecies}>
          <span className={`cinzel ${styles.cardSpeciesCode}`}>{d.species}</span>
          <span className={styles.cardMass}>Class {p.class} · {p.mass}</span>
        </div>
        <div className={styles.cardName}>
          {d.name || d.player_name || <em className={styles.unnamed}>Unnamed</em>}
        </div>
        {(d.skin_dominant || d.gender) && (
          <div className={styles.cardMeta}>
            {d.gender && <span>{d.gender === 'M' ? '♂' : '♀'}</span>}
            {d.skin_dominant && <span>{d.skin_dominant}</span>}
          </div>
        )}
      </div>

      {/* Center: progress */}
      <div className={styles.cardCenter}>
        {isElder ? (
          <div className={styles.elderBadge}>
            <span className={styles.elderIcon}>⬡</span>
            <span className={`cinzel ${styles.elderText}`}>ELDER</span>
          </div>
        ) : (
          <>
            <div className={styles.ticksRow}>
              <span className={`cinzel ${styles.ticksVal}`}>{Math.round(p.pct * 100)}%</span>
              <span className={styles.ticksOf}>elder progress</span>
              <span className={styles.ticksPct}>{pctDisplay}%</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(p.pct * 100, 100)}%` }}
              />
              {/* Mutation point markers */}
              {p.mutationPoints.map((mp, i) => {
                const markerPct = (mp.ticks / p.elderTicks) * 100
                const passed = p.ticks >= mp.ticks
                return (
                  <div
                    key={i}
                    className={`${styles.mutMarker} ${passed ? styles.mutMarkerPassed : ''}`}
                    style={{ left: `${markerPct}%` }}
                    title={`Mutation point ${i + 1}: ${mp.ticks} ticks (${mp.pct ? (mp.pct * 100).toFixed(1) + '%' : ''})`}
                  />
                )
              })}
            </div>
            <div className={styles.mutRow}>
              {p.mutationPoints.map((mp, i) => {
                const passed = p.ticks >= mp.ticks
                return (
                  <span
                    key={i}
                    className={`${styles.mutPt} ${passed ? styles.mutPtPassed : ''}`}
                  >
                    {passed ? '✓' : '○'} {mp.ticks}t
                  </span>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Right: time estimates */}
      <div className={styles.cardRight}>
        {!isElder && (
          <>
            <div className={styles.timeBlock}>
              <span className={`cinzel ${styles.timeVal}`}>{p.daysRemaining ?? '?'}</span>
              <span className={styles.timeLabel}>days to elder</span>
            </div>
            <div className={styles.timeBlock}>
              <span className={`cinzel ${styles.timeVal}`}>{p.ticksRemaining.toFixed(0)}</span>
              <span className={styles.timeLabel}>ticks remaining</span>
            </div>
            {p.daysToNextMut !== null && (
              <div className={styles.timeBlock}>
                <span className={`cinzel ${styles.timeVal}`} style={{ color: 'var(--accent)' }}>
                  {p.daysToNextMut}
                </span>
                <span className={styles.timeLabel}>days to next mut pt</span>
              </div>
            )}
            {p.nextMutPt === null && (
              <div className={styles.timeBlock}>
                <span className={styles.allMutPassed}>All mut. points passed</span>
              </div>
            )}
          </>
        )}
        {isElder && (
          <div className={styles.timeBlock}>
            <span className={`cinzel ${styles.timeVal}`} style={{ color: 'var(--elder)' }}>
              {p.ticks.toFixed(2)}
            </span>
            <span className={styles.timeLabel}>total ticks</span>
          </div>
        )}
        <div className={styles.tickRateBlock}>
          <span className={styles.tickRate}>{p.ticksPerDay}×</span>
          <span className={styles.tickRateLabel}>ticks/day</span>
        </div>
      </div>
    </div>
  )
}

// ─── Elder tab right-click menu ───────────────────────────────────────────────
function ElderCtxMenu({ x, y, dragon, isElder, onTick, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    // Close on any click or right-click outside
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    // Use capture phase so we catch events before children suppress them
    document.addEventListener('mousedown', handle, true)
    document.addEventListener('contextmenu', handle, true)
    return () => {
      document.removeEventListener('mousedown', handle, true)
      document.removeEventListener('contextmenu', handle, true)
    }
  }, [onClose])

  const menuStyle = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth  - 190),
    top:  Math.min(y, window.innerHeight - 130),
    zIndex: 99999,
    background: 'var(--bg-surface)',
    border: '1px solid var(--bg-border)',
    borderRadius: 10,
    padding: '6px 0',
    minWidth: 170,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    pointerEvents: 'all',
  }

  const itemBase = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 16px', fontSize: 13, color: 'var(--text-primary)',
    background: 'transparent', border: 'none', width: '100%',
    textAlign: 'left', cursor: 'pointer', transition: 'background 0.1s',
  }

  return (
    <div ref={ref} style={menuStyle} onClick={e => e.stopPropagation()}>
      {!isElder && (
        <button
          style={itemBase}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          onClick={e => { e.stopPropagation(); onTick() }}
        >
          ✓ Add 1 Tick
        </button>
      )}
      <button
        style={{ ...itemBase, color: 'var(--text-muted)', fontSize: 12 }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        onClick={e => { e.stopPropagation(); onClose() }}
      >
        Cancel
      </button>
    </div>
  )
}
