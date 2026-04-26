import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './DragonList.module.css'
import {
  SPECIES_CONFIG,
  SKIN_COLORS,
  getStatsColor,
  getStatsWidth,
  TRAIT_DEFS,
  TRAIT_KEYS,
} from '../lib/dragonData'

export default function DragonList({ dragons, loading, selected, onSelect, onEdit, onDelete, onKill, onChangeLocation, onToggleHungry }) {
  if (loading) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`skeleton ${styles.skeletonRow}`} style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
    )
  }

  if (!dragons.length) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>⬡</span>
        <p>No dragons found</p>
        <p className={styles.emptyHint}>Add one manually or press your capture key in-game</p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {dragons.map((d, i) => (
        <DragonCard
          key={d.id}
          dragon={d}
          selected={selected === d.id}
          onSelect={() => onSelect(d.id)}
          index={i}
          onEdit={onEdit}
          onDelete={onDelete}
          onKill={onKill}
          onChangeLocation={onChangeLocation}
          onToggleHungry={onToggleHungry}
        />
      ))}
    </div>
  )
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function ContextMenu({ x, y, dragon, onEdit, onDelete, onKill, onChangeLocation, onToggleHungry, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('contextmenu', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('contextmenu', handle)
    }
  }, [onClose])

  // Clamp to viewport
  const style = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth  - 180),
    top:  Math.min(y, window.innerHeight - 200),
    zIndex: 999,
  }

  const isDead = !!dragon.is_dead

  return (
    <div ref={ref} className={styles.ctxMenu} style={style}>
      <button className={styles.ctxItem} onClick={() => { onEdit?.(dragon); onClose() }}>
        <EditIcon /> Edit
      </button>
      <button className={styles.ctxItem} onClick={() => { onChangeLocation?.(dragon); onClose() }}>
        <PinIcon /> Change Location
      </button>
      {!isDead && (
        <button className={styles.ctxItem} onClick={() => { onToggleHungry?.(dragon); onClose() }}>
          <span style={{ fontSize: 13 }}>🍖</span> {dragon.is_hungry ? 'Mark as Fed' : 'Mark as Hungry'}
        </button>
      )}
      {!isDead && (
        <button className={`${styles.ctxItem} ${styles.ctxItemDanger}`} onClick={() => { onKill?.(dragon); onClose() }}>
          <SkullIcon /> Kill Dragon
        </button>
      )}
      <div className={styles.ctxDivider} />
      <button className={`${styles.ctxItem} ${styles.ctxItemDestructive}`} onClick={() => { onDelete?.(dragon.id); onClose() }}>
        <TrashIcon /> Delete
      </button>
    </div>
  )
}

// ─── Dragon card ──────────────────────────────────────────────────────────────

function DragonCard({ dragon: d, selected, onSelect, index, onEdit, onDelete, onKill, onChangeLocation, onToggleHungry }) {
  const [ctx, setCtx] = useState(null) // { x, y }
  const isElder = d.growth === 'Elder' || d.is_elder === 1
  const isDead  = !!d.is_dead

  const species = SPECIES_CONFIG[d.species]
    || SPECIES_CONFIG[Object.keys(SPECIES_CONFIG).find(k => SPECIES_CONFIG[k].code === d.species)]
    || { color: '#5c72f5', bg: 'rgba(92,114,245,0.12)', icon: '🐉' }

  const skinColor   = SKIN_COLORS[d.skin_dominant] || '#888'
  const genderGlyph = d.gender === 'M' ? '♂' : '♀'
  const genderClass = d.gender === 'M' ? styles.genderM : styles.genderF
  const genderColor = d.gender === 'M' ? '#4da6ff' : '#e05a5a'

  const bq      = d.bloodline_quality || null
  const bqColor = bq ? getStatsColor(bq) : null
  const bqWidth = bq ? getStatsWidth(bq) : 0

  // Highest trait (no emojis) - find the one with most points
  const highestTrait = TRAIT_KEYS
    .map(k => ({ key: k, pts: parseInt(d[`trait_${k}`]) || 0 }))
    .filter(t => t.pts > 0)
    .sort((a, b) => b.pts - a.pts)[0] || null

  // Dragon display name = account label (ownerUsername) or player_name fallback
  const dragonDisplayName = d.ownerUsername || d.player_name || 'Unknown'
  // Main account = user-level displayName
  const ownerDisplay = d.ownerDisplayName || d.ownerUsername || d.player_name || 'Unknown'

  const roleDisplay = d.clan_role || '—'

  function handleContextMenu(e) {
    e.preventDefault()
    e.stopPropagation()
    setCtx({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        className={`${styles.card} ${selected ? styles.selected : ''} ${isDead ? styles.cardDead : ''} fade-in`}
        style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
      >
        <div className={styles.topBar} style={{ background: isDead ? '#555' : skinColor }} />

        <div className={styles.inner}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.titleRow}>
                <span className={styles.speciesIcon}>{isDead ? '💀' : species.icon}</span>
                <span className={`${styles.name} ${isDead ? styles.nameDead : ''}`}>
                  {dragonDisplayName} · {d.species}
                </span>
                <span className={genderClass} style={{ fontSize: '15px', fontWeight: '700' }}>{genderGlyph}</span>
                {isElder && !isDead && <span className={styles.elderBadge}>ELDER</span>}
                {isDead  && <span className={styles.deadBadge}>DEAD</span>}
                {d.is_hungry && !isDead && <span title="Hungry" style={{ fontSize: 14 }}>🍖</span>}
              </div>
              <div className={styles.owner}>Owner: <b>{ownerDisplay}</b></div>
            </div>
          </div>

          <div className={styles.meta}>
            <span className={styles.badge} style={{ color: species.color, borderColor: `${species.color}30`, background: species.bg }}>
              {species.icon} {d.species}
            </span>
            <span className={styles.badge} style={{ color: genderColor, borderColor: `${genderColor}30`, background: `${genderColor}15` }}>
              {genderGlyph} {d.gender === 'M' ? 'Male' : 'Female'}
            </span>
            {d.growth && (
              <span className={styles.badge} style={{ color: isElder ? '#7ecfcf' : 'var(--muted)', borderColor: isElder ? 'rgba(126,207,207,0.3)' : 'var(--border)', background: isElder ? 'rgba(126,207,207,0.1)' : 'var(--surface2)' }}>
                {d.growth}
              </span>
            )}
            {d.location?.label && (
              <span className={styles.badge} style={{ color: 'var(--muted)', borderColor: 'var(--border)', background: 'var(--surface2)' }}>
                📍 {d.location.label}
              </span>
            )}
          </div>

          <div className={styles.stats}>
            <div className={styles.statCell}>
              <div className={styles.statLabel}>Skin</div>
              <div className={styles.statValue} style={{ color: isDead ? 'var(--hint)' : skinColor }}>
                {d.skin_dominant || '—'}
              </div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statLabel}>Role</div>
              <div className={styles.statValue} style={{ color: d.clan_role ? 'var(--accent)' : 'var(--hint)' }}>
                {roleDisplay}
              </div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statLabel}>Trait</div>
              <div className={styles.statValue}>
                {highestTrait
                  ? <span className={styles.traitPip} title={`${TRAIT_DEFS[highestTrait.key].label}: ${highestTrait.pts} pt`}>
                      {TRAIT_DEFS[highestTrait.key].label} {highestTrait.pts}
                    </span>
                  : <span style={{ color: 'var(--hint)' }}>—</span>
                }
              </div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statLabel}>Bloodline</div>
              <div className={styles.statBarWrap}>
                <span className={styles.statValue} style={{ color: bqColor || 'var(--hint)', minWidth: '28px' }}>
                  {bq || '—'}
                </span>
                {bq && (
                  <div className={styles.statBarBg}>
                    <div className={styles.statBarFill} style={{ width: `${bqWidth}%`, background: bqColor }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>{/* end styles.inner */}
      </div>{/* end styles.card */}

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          dragon={d}
          onEdit={onEdit}
          onDelete={onDelete}
          onKill={onKill}
          onChangeLocation={onChangeLocation}
          onToggleHungry={onToggleHungry}
          onClose={() => setCtx(null)}
        />
      )}
    </>
  )
}

// ─── Context menu icons ───────────────────────────────────────────────────────
function EditIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function PinIcon()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function SkullIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a9 9 0 0 1 9 9c0 5-4 9-9 9H9v-2.5a2.5 2.5 0 0 0-2.5-2.5H4v-1A9 9 0 0 1 12 2z"/><line x1="8" y1="16" x2="8" y2="18"/><line x1="16" y1="16" x2="16" y2="18"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/></svg> }
function TrashIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> }
