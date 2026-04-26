import { useState, useMemo } from 'react'
import { ELDER_DATA, calcElderProgress } from '../lib/nestingEngine'
import { getGradeClass } from '../lib/dragonData'
import styles from './ElderTracker.module.css'

export default function ElderTracker({ dragons = [] }) {
  const [filter, setFilter] = useState('all')   // all | in-progress | elder | no-data

  // Only dragons with species data that we have elder info for
  const tracked = useMemo(() => {
    return dragons
      .filter(d => d.species && ELDER_DATA[d.species])
      .map(d => ({
        dragon: d,
        progress: calcElderProgress(d.species, d.ticks ?? 0),
      }))
      .sort((a, b) => (b.progress?.pct ?? 0) - (a.progress?.pct ?? 0))
  }, [dragons])

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
            <ElderCard key={d.id} dragon={d} progress={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function ElderCard({ dragon: d, progress: p }) {
  if (!p) return null

  const pctDisplay  = (p.pct * 100).toFixed(1)
  const isElder     = p.isElder

  return (
    <div className={`${styles.card} ${isElder ? styles.cardElder : ''} fade-in`}>
      {/* Left: identity */}
      <div className={styles.cardLeft}>
        <div className={styles.cardSpecies}>
          <span className={`cinzel ${styles.cardSpeciesCode}`}>{d.species}</span>
          <span className={styles.cardMass}>Class {p.class} · {p.mass}</span>
        </div>
        <div className={styles.cardName}>
          {d.name || <em className={styles.unnamed}>Unnamed</em>}
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
              <span className={`cinzel ${styles.ticksVal}`}>{p.ticks.toFixed(2)}</span>
              <span className={styles.ticksOf}>/ {p.elderTicks}</span>
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
