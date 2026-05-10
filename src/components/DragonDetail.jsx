import styles from './DragonDetail.module.css'
import {
  SPECIES_CONFIG,
  SKIN_COLORS,
  getStatsColor,
  getStatsWidth,
  getGradeClass,
  STAT_GROUPS,
} from '../lib/dragonData'

export default function DragonDetail({ dragon, allDragons, onEdit, onDelete }) {
  if (!dragon) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>⬡</span>
        <p>Select a dragon to view details</p>
      </div>
    )
  }

  const isElder  = dragon.is_elder === 1 || dragon.elder_status === 'ELDER'
  const father   = dragon.father_id ? allDragons.find(d => d.id === dragon.father_id) : null
  const mother   = dragon.mother_id ? allDragons.find(d => d.id === dragon.mother_id) : null
  const mate     = dragon.mate_id   ? allDragons.find(d => d.id === dragon.mate_id)   : null
  const haremDragons = Array.isArray(dragon.harem)
    ? dragon.harem.map(id => allDragons.find(d => d.id === id)).filter(Boolean)
    : []

  const species  = SPECIES_CONFIG[dragon.species]
    || SPECIES_CONFIG[Object.keys(SPECIES_CONFIG).find(k => SPECIES_CONFIG[k].code === dragon.species)]
    || { color: '#5c72f5', bg: 'rgba(92,114,245,0.12)', icon: '🐉' }
  const skinColor = SKIN_COLORS[dragon.skin_dominant] || '#888'

  const hasLineageNames =
    dragon.father_name || dragon.mother_name ||
    dragon.grandfather1_name || dragon.grandfather2_name ||
    dragon.grandmother1_name || dragon.grandmother2_name

  function handleDelete() {
    if (window.confirm(`Remove ${dragon.ownerUsername || dragon.species || 'this dragon'}?`)) onDelete(dragon.id)
  }

  return (
    <div className={`${styles.panel} ${isElder ? styles.isElder : ''} fade-in`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.speciesBadge} style={{ color: species.color, borderColor: `${species.color}30`, background: species.bg }}>
            {species.icon} {dragon.species}
          </div>
          <h2 className={`cinzel ${styles.name}`}>
            {dragon.name || dragon.ownerUsername || dragon.player_name || dragon.species}
          </h2>
          {dragon.name && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {dragon.ownerUsername || dragon.player_name}
            </div>
          )}
          <div className={styles.badges}>
            {dragon.gender && (
              <span className={styles.badge} style={{ color: dragon.gender === 'M' ? '#4da6ff' : '#e05a5a' }}>
                {dragon.gender === 'M' ? '♂ Male' : '♀ Female'}
              </span>
            )}
            {dragon.growth && <span className={styles.badge}>{dragon.growth}</span>}
            {dragon.purity && <span className={styles.badge} style={{color:'#a78bfa'}}>Skin Purity: {dragon.purity}</span>}
            {dragon.clan_role && <span className={styles.badge} style={{opacity:0.7}}>{dragon.clan_role}</span>}
            {isElder && <span className={`${styles.badge} ${styles.elderBadge}`}>⬡ ELDER</span>}
            {dragon.is_hungry && <span className={styles.badge} title="Hungry">🍖 Hungry</span>}
            {dragon.bloodline_quality && (
              <span className={`grade-badge ${getGradeClass(dragon.bloodline_quality)} ${styles.bqBadge}`}>
                BQ {dragon.bloodline_quality}
              </span>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(dragon)}>Edit</button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red, #c44a4a)' }} onClick={handleDelete}>Remove</button>
        </div>
      </div>

      <div className={styles.body}>
        {/* ── Skins ── */}
        <Section title="Skin & Appearance">
          <div className={styles.skinRow}>
            <SkinCard label="Dominant Skin"  value={dragon.skin_dominant}  color={skinColor} />
            <SkinCard label="Recessive Skin" value={dragon.skin_recessive} color={SKIN_COLORS[dragon.skin_recessive]} />
            <SkinCard label="Skin Purity"    value={dragon.purity}         color={dragon.purity ? '#a78bfa' : null} />
          </div>
        </Section>

        {/* ── Stats (grouped) ── */}
        {Object.entries(STAT_GROUPS).map(([groupKey, group]) => {
          const hasAny = group.stats.some(s => dragon[s.key])
          return (
            <Section key={groupKey} title={group.label}>
              <div className={styles.statGrid}>
                {group.stats.map(s => (
                  <StatCell key={s.key} label={s.label} value={dragon[s.key]} />
                ))}
              </div>
            </Section>
          )
        })}

        {/* ── Progression ── */}
        <Section title="Growth Progression">
          <div className={styles.progressRow}>
            <div className={styles.tickBlock}>
              <span className={styles.tickValue}>
                {dragon.ticks != null ? Math.round(dragon.ticks * 100) : '—'}%
              </span>
              <span className={styles.tickLabel}>Elder Progress</span>
            </div>
            <TickBar ticks={dragon.ticks} />
            <div className={styles.elderStatus}>
              <span className={`${styles.elderText} ${isElder ? styles.elderActive : ''}`}>
                {dragon.elder_status || 'NO'}
              </span>
              <span className={styles.tickLabel}>Elder</span>
            </div>
          </div>
        </Section>

        {/* ── Mate & Harem ── */}
        {(mate || haremDragons.length > 0) && (
          <Section title="Mate & Harem">
            {mate && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Primary Mate</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 20 }}>💕</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{mate.name || mate.ownerUsername || mate.player_name}</div>
                    {mate.name && <div style={{ color: 'var(--muted)', fontSize: 11 }}>{mate.ownerUsername || mate.player_name}</div>}
                    <div style={{ display:'flex', gap:8, marginTop:2 }}>
                      <span style={{ color: 'var(--accent)', fontSize: 11 }}>{mate.species}</span>
                      <span style={{ color: mate.gender === 'M' ? '#4da6ff' : '#e05a5a', fontSize: 11, fontWeight:700 }}>
                        {mate.gender === 'M' ? '♂' : mate.gender === 'F' ? '♀' : '?'}
                      </span>
                      {mate.species !== dragon.species && (
                        <span style={{ fontSize:10, color:'#e05a5a' }}>⚠ different species</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {haremDragons.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Harem — {haremDragons.length} approved partner{haremDragons.length !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', flexWrap:'wrap', gap: 6, marginTop: 6 }}>
                  {haremDragons.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, border:'1px solid var(--border)' }}>
                      <span style={{ color: h.gender === 'M' ? '#4da6ff' : '#e05a5a', fontWeight:700 }}>
                        {h.gender === 'M' ? '♂' : h.gender === 'F' ? '♀' : '?'}
                      </span>
                      <span style={{ fontWeight: 600 }}>{h.name || h.ownerUsername || h.player_name}</span>
                      {h.name && <span style={{ color: 'var(--muted)', fontSize: 10 }}>{h.ownerUsername || h.player_name}</span>}
                      <span style={{ color: 'var(--accent)', fontSize:10 }}>{h.species}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Lineage (DB links) ── */}
        {(father || mother) && (
          <Section title="Genetic Lineage">
            <div className={styles.lineageRow}>
              <LineageCard label="Sire (Father)" dragon={father} fallbackName={dragon.father_name} />
              <LineageCard label="Dam (Mother)"  dragon={mother} fallbackName={dragon.mother_name} />
            </div>
          </Section>
        )}

        {/* ── Family Tree Names (OCR) ── */}
        {hasLineageNames && (
          <Section title="Family Tree (OCR)">
            <div className={styles.nameGrid}>
              <NameRow label="Father"               value={dragon.father_name} />
              <NameRow label="Mother"               value={dragon.mother_name} />
              <NameRow label="Grandfather (pat.)"   value={dragon.grandfather1_name} />
              <NameRow label="Grandfather (mat.)"   value={dragon.grandfather2_name} />
              <NameRow label="Grandmother (pat.)"   value={dragon.grandmother1_name} />
              <NameRow label="Grandmother (mat.)"   value={dragon.grandmother2_name} />
            </div>
          </Section>
        )}

        {/* ── Notes ── */}
        {dragon.notes && (
          <Section title="Notes">
            <p className={styles.notes}>{dragon.notes}</p>
          </Section>
        )}

        {/* ── Meta ── */}
        <div className={styles.meta}>
          <span>Added {formatDate(dragon.created_at)}</span>
          {dragon.capture_source === 'f8' && <span className={styles.captureBadge}>📸 Auto-captured</span>}
          {dragon.player_name && <span className={styles.playerBadge}>👤 {dragon.player_name}</span>}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className={styles.section}>
      <h3 className={`cinzel ${styles.sectionTitle}`}>{title}</h3>
      {children}
    </div>
  )
}

function SkinCard({ label, value, color }) {
  return (
    <div className={styles.skinCard}>
      <span className={styles.skinLabel}>{label}</span>
      <span className={styles.skinValue} style={color ? { color } : {}}>{value || '—'}</span>
    </div>
  )
}

function StatCell({ label, value }) {
  const color = getStatsColor(value)
  const width = getStatsWidth(value)
  return (
    <div className={styles.statCell}>
      <div className={styles.statHeader}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue} style={{ color }}>{value || '—'}</span>
      </div>
      {value && (
        <div className={styles.statBarWrap}>
          <div className={styles.statBarBg}>
            <div className={styles.statBarFill} style={{ width: `${width}%`, background: color }} />
          </div>
        </div>
      )}
    </div>
  )
}

function TickBar({ ticks }) {
  const pct = Math.min((ticks || 0) * 100, 100)
  return (
    <div className={styles.tickBarWrap}>
      <div className={styles.tickBar}>
        <div className={styles.tickFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.tickPct}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function LineageCard({ label, dragon, fallbackName }) {
  const name    = dragon?.ownerUsername || dragon?.player_name || dragon?.name || fallbackName || '—'
  const species = dragon?.species || ''
  return (
    <div className={styles.lineageCard}>
      <span className={styles.lineageLabel}>{label}</span>
      <span className={styles.lineageName}>{name}</span>
      {species && <span className={`cinzel ${styles.lineageSpecies}`}>{species}</span>}
    </div>
  )
}

function NameRow({ label, value }) {
  if (!value) return null
  return (
    <div className={styles.nameRow}>
      <span className={styles.nameRowLabel}>{label}</span>
      <span className={styles.nameRowValue}>{value}</span>
    </div>
  )
}

function formatDate(ts) {
  if (!ts) return '?'
  return new Date(ts * 1000).toLocaleDateString()
}
