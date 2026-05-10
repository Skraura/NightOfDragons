/**
 * ClanLineageCanvas.jsx — v6.0
 *
 * Admin-only shared Lineage Canvas.
 * Shows every dragon from ALL member registries in one large family-chart
 * per species. Cards are annotated with the owner's username.
 *
 * Access: only rendered when user.isAdmin is true.
 */

import { useState, useEffect, useRef } from 'react'
import f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'
import { SPECIES_FULL, SPECIES_CONFIG, ALL_STAT_KEYS, GRADES } from '../lib/dragonData'
import { dragonToF3, splitIntoLineageGroups } from '../lib/dragonToF3'
import { buildSafeLineage } from '../lib/lineageEngine'
import useLineagePrefs from '../hooks/useLineagePrefs'
import styles from './ClanLineageCanvas.module.css'

// ── Card creator with owner badge ─────────────────────────────────────────────

const GRADE_STYLES = {
  'grade-axx': 'background:#ffd700;color:#000',
  'grade-ax':  'background:#c0a000;color:#fff',
  'grade-a':   'background:#8a7000;color:#fff',
  'grade-bx':  'background:#3a6e9c;color:#fff',
  'grade-b':   'background:#2a5e8c;color:#fff',
  'grade-bm':  'background:#1a4e7c;color:#fff',
  'grade-c':   'background:#5a4a2a;color:#fff',
  'grade-d':   'background:#3a2a1a;color:#aaa',
}

function getGradeClass(grade) {
  if (!grade) return ''
  const map = {
    'A++': 'grade-axx', 'A+': 'grade-ax',
    'A':   'grade-a',   'A-': 'grade-a',
    'B+':  'grade-bx',  'B':  'grade-b',  'B-': 'grade-bm',
    'C+':  'grade-c',   'C':  'grade-c',  'C-': 'grade-c',
    'D+':  'grade-d',   'D':  'grade-d',  'D-': 'grade-d',
    'E':   'grade-e',   'F':  'grade-f',
  }
  return map[grade] || 'grade-e'
}

function gradeStyle(grade) {
  if (!grade) return ''
  return GRADE_STYLES[getGradeClass(grade)] || 'background:rgba(255,255,255,0.12);color:#ccc'
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Stable color from string (for owner badge)
function ownerColor(username) {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h},55%,52%)`
}

function clanCardCreator(prefs, accentColor, accentBg) {
  return function cardInnerHtmlCreator(d) {
    const node   = d.data.data
    const isMain = !!d.data.main

    const border = isMain
      ? `3px solid ${accentColor}`
      : node.isElder && prefs.showElder
        ? '2px solid #d4a017'
        : '1px solid rgba(255,255,255,0.1)'

    const bg = isMain ? accentBg : 'rgba(255,255,255,0.04)'

    const genderHtml = prefs.showGender
      ? node.gender === 'M'
        ? '<span style="color:#7cb9cc;font-size:12px">♂</span>'
        : '<span style="color:#e05a5a;font-size:12px">♀</span>'
      : ''

    const skinHtml = prefs.showSkin && node.skin
      ? `<span style="color:rgba(255,255,255,0.55);font-size:10px">${escHtml(node.skin)}</span>`
      : ''

    const growthHtml = prefs.showGrowth && node.growth
      ? `<span style="color:rgba(255,255,255,0.35);font-size:10px">· ${escHtml(node.growth)}</span>`
      : ''

    const metaRow = (prefs.showGender || (prefs.showSkin && node.skin) || (prefs.showGrowth && node.growth))
      ? `<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:2px">
           ${genderHtml}${skinHtml}${growthHtml}
         </div>`
      : ''

    const elderHtml = prefs.showElder && node.isElder
      ? `<div style="font-size:9px;color:#d4a017;letter-spacing:.5px;margin-top:1px">⬡ ELDER</div>`
      : ''

    const bqHtml = prefs.showBloodlineQuality && node.bloodlineQuality
      ? `<div style="margin-top:2px;display:flex;align-items:center;gap:4px">
           <span style="font-size:9px;color:rgba(255,255,255,0.4)">BQ</span>
           <span style="padding:1px 6px;border-radius:4px;font-weight:600;font-size:10px;${gradeStyle(node.bloodlineQuality)}">${escHtml(node.bloodlineQuality)}</span>
         </div>`
      : ''

    // Owner badge — always shown in clan canvas
    const ownerCol = ownerColor(node.ownerUsername || '?')
    const ownerHtml = node.ownerUsername
      ? `<div style="margin-top:3px;display:flex;align-items:center;gap:4px">
           <span style="width:6px;height:6px;border-radius:50%;background:${ownerCol};flex-shrink:0;display:inline-block"></span>
           <span style="font-size:9px;color:${ownerCol};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${escHtml(node.ownerUsername)}</span>
         </div>`
      : ''

    return `<div style="
        width:220px;
        background:${bg};
        border:${border};
        border-radius:9px;
        padding:8px 11px;
        display:flex;
        flex-direction:column;
        justify-content:center;
        position:relative;
        overflow:hidden;
        box-sizing:border-box;
        transition:border 0.2s;
      ">
      <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3">
        ${escHtml(node.name)}
      </div>
      ${metaRow}
      ${elderHtml}
      ${bqHtml}
      ${ownerHtml}
    </div>`
  }
}

// ── Chart canvas component ────────────────────────────────────────────────────

function ClanChartCanvas({ data, speciesConfig, prefs, groupIndex, totalGroups }) {
  const wrapperRef = useRef(null)
  const chartRef   = useRef(null)
  const [ready, setReady] = useState(false)

  const accentColor = speciesConfig?.color || '#7c5cbf'
  const accentBg    = speciesConfig?.bg    || 'rgba(124,92,191,0.12)'

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || !data.length) return

    wrapper.innerHTML = ''
    chartRef.current = null
    setReady(false)

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0]?.contentRect || {}
      if (!width || !height) return
      observer.disconnect()

      const rootId = (() => {
        const elders = data.filter(d => d.data.isElder)
        if (elders.length) return elders[0].id
        const parents = data.filter(d => d.rels.children.length > 0)
        if (parents.length) return parents[0].id
        return data[0].id
      })()

      try {
        const chart = f3.createChart(wrapper, data)
          .setTransitionTime(400)
          .setCardXSpacing(250)
          .setCardYSpacing(120)

        chart.setCardHtml()
          .setCardInnerHtmlCreator(clanCardCreator(prefs, accentColor, accentBg))

        chart.updateTree({ initial: true, main_id: rootId })

        try {
          const svg = wrapper.querySelector('svg')
          if (svg) f3.zoomTo(svg, 0.8)
        } catch (_) {}

        chartRef.current = chart
        setReady(true)
      } catch (err) {
        console.error('[ClanCanvas] init error:', err)
      }
    })

    observer.observe(wrapper)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ready) return
    chart.setCardHtml()
      .setCardInnerHtmlCreator(clanCardCreator(prefs, accentColor, accentBg))
    chart.updateTree({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, ready])

  if (!data.length) return null

  return (
    <div className={styles.canvasPage}>
      {totalGroups > 1 && (
        <div className={styles.canvasLabel}>
          <span>🌿</span>
          Lineage {groupIndex + 1} of {totalGroups}
          <span className={styles.canvasDragonCount}>· {data.length} dragon{data.length !== 1 ? 's' : ''}</span>
        </div>
      )}
      {!ready && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
        </div>
      )}
      <div
        ref={wrapperRef}
        className={styles.f3Wrapper}
        style={{ '--f3-accent': accentColor }}
      />
    </div>
  )
}

// ── Stats bar — diversity overview ────────────────────────────────────────────

function DiversityBar({ dragons, speciesName, speciesCode }) {
  const filtered = dragons.filter(d => d.species === speciesCode || d.species === speciesName)
  if (!filtered.length) return null

  const owners = [...new Set(filtered.map(d => d.ownerUsername).filter(Boolean))]
  const elders = filtered.filter(d => d.is_elder === 1 || d.elder_status === 'ELDER').length
  const breeders = filtered.filter(d => d.clan_role === 'Breeder').length

  // Grade distribution for top stat
  const gradeCounts = {}
  filtered.forEach(d => {
    ALL_STAT_KEYS.forEach(k => {
      const g = d[k]
      if (g) gradeCounts[g] = (gradeCounts[g] || 0) + 1
    })
  })
  const topGrades = Object.entries(gradeCounts)
    .sort((a, b) => GRADES.indexOf(a[0]) - GRADES.indexOf(b[0]))
    .slice(0, 4)

  return (
    <div className={styles.diversityBar}>
      <div className={styles.divStat}>
        <span className={styles.divVal}>{filtered.length}</span>
        <span className={styles.divLabel}>Total</span>
      </div>
      <div className={styles.divStat}>
        <span className={styles.divVal}>{owners.length}</span>
        <span className={styles.divLabel}>Keepers</span>
      </div>
      <div className={styles.divStat}>
        <span className={styles.divVal} style={{ color: '#d4a017' }}>{elders}</span>
        <span className={styles.divLabel}>Elders</span>
      </div>
      <div className={styles.divStat}>
        <span className={styles.divVal} style={{ color: '#4da6ff' }}>{breeders}</span>
        <span className={styles.divLabel}>Breeders</span>
      </div>
      <div className={styles.divSeparator} />
      <div className={styles.divGrades}>
        <span className={styles.divLabel}>Top grades</span>
        <div className={styles.divGradeRow}>
          {topGrades.map(([g, count]) => (
            <span key={g} className={styles.divGradePill} style={{ ...gradeStyleObj(g) }}>
              {g} <span className={styles.divGradeCount}>×{count}</span>
            </span>
          ))}
        </div>
      </div>
      <div className={styles.divSeparator} />
      <div className={styles.divOwners}>
        <span className={styles.divLabel}>Keepers</span>
        <div className={styles.divOwnerRow}>
          {owners.slice(0, 6).map(u => (
            <span
              key={u}
              className={styles.divOwnerChip}
              style={{ borderColor: ownerColor(u), color: ownerColor(u) }}
            >
              {u}
            </span>
          ))}
          {owners.length > 6 && (
            <span className={styles.divOwnerMore}>+{owners.length - 6}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function gradeStyleObj(grade) {
  const css = gradeStyle(grade)
  if (!css) return {}
  const parts = {}
  css.split(';').forEach(p => {
    const [k, v] = p.split(':')
    if (k && v) parts[k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v.trim()
  })
  return parts
}

// ── Main ClanLineageCanvas ────────────────────────────────────────────────────

export default function ClanLineageCanvas() {
  const speciesNames  = Object.values(SPECIES_FULL)
  const [selected, setSelected] = useState(speciesNames[0])
  const [activePage, setActivePage] = useState(0)
  const [allDragons, setAllDragons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { prefs } = useLineagePrefs()

  const speciesConfig = SPECIES_CONFIG[selected]
  const speciesCode   = Object.entries(SPECIES_FULL).find(([, n]) => n === selected)?.[0]

  // Load ALL dragons from ALL registries
  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api?.dragon.getAllClan()
      .then(res => {
        if (res.ok) {
          setAllDragons(res.dragons || [])
        } else {
          setError(res.error || 'Failed to load clan dragons')
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Refresh when dragons change (e.g. someone adds a dragon)
  useEffect(() => {
    const handler = () => {
      window.api?.dragon.getAllClan().then(res => {
        if (res.ok) setAllDragons(res.dragons || [])
      }).catch(() => {})
    }
    window.addEventListener('dragon:refresh', handler)
    return () => window.removeEventListener('dragon:refresh', handler)
  }, [])

  const counts = {}
  speciesNames.forEach(name => {
    const code = Object.entries(SPECIES_FULL).find(([, n]) => n === name)?.[0]
    counts[name] = allDragons.filter(d => d.species === code || d.species === name).length
  })

  // Build lineage groups for selected species
  const filtered = allDragons.filter(d => d.species === speciesCode || d.species === selected)

  // Run safety engine first — detect cycles, invalid edges, renesting
  const { nodes: safeFiltered, warnings: lineageWarnings } = (() => {
    if (!filtered.length) return { nodes: [], warnings: [] }
    try {
      return buildSafeLineage(filtered)
    } catch (e) {
      console.error('[Lineage] Safety engine failed:', e)
      return { nodes: filtered, warnings: [{ message: 'Lineage safety check failed — displaying raw data.' }] }
    }
  })()

  // Convert to f3 nodes — we need to preserve ownerUsername in node.data
  const f3Nodes = (() => {
    if (!safeFiltered.length) return []
    const nodes = dragonToF3(safeFiltered)
    // Inject ownerUsername into each node's data
    const ownerMap = {}
    safeFiltered.forEach(d => { ownerMap[String(d.id)] = d.ownerUsername })
    nodes.forEach(n => { n.data.ownerUsername = ownerMap[n.id] || '' })
    return nodes
  })()

  const lineageGroups = splitIntoLineageGroups(f3Nodes)
  const totalPages    = lineageGroups.length

  const handleSelectSpecies = (name) => {
    setSelected(name)
    setActivePage(0)
  }

  const safePage = Math.min(activePage, Math.max(0, totalPages - 1))

  // Build mate pairs for selected species
  const matePairs = (() => {
    const seen = new Set()
    const pairs = []
    filtered.forEach(d => {
      if (!d.mate_id) return
      const pairKey = [d.id, d.mate_id].sort().join('_')
      if (seen.has(pairKey)) return
      seen.add(pairKey)
      const mate = filtered.find(m => m.id === d.mate_id) || allDragons.find(m => m.id === d.mate_id)
      if (mate) pairs.push({ a: d, b: mate })
    })
    return pairs
  })()

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingFull}>
          <div className={styles.spinner} />
          <p>Loading clan registry…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorFull}>
          <span className={styles.errorIcon}>⚠</span>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.adminBadge}>★ ADMIN</span>
          <div>
            <h2 className={`cinzel ${styles.title}`}>Clan Lineage Canvas</h2>
            <p className={styles.sub}>
              All dragons from all member registries · {allDragons.length} total across {Object.keys(SPECIES_FULL).length} species
            </p>
          </div>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={() => {
            setLoading(true)
            window.api?.dragon.getAllClan()
              .then(res => { if (res.ok) setAllDragons(res.dragons || []) })
              .catch(() => {})
              .finally(() => setLoading(false))
          }}
          title="Refresh all registries"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Diversity bar */}
      <DiversityBar
        dragons={allDragons}
        speciesName={selected}
        speciesCode={speciesCode}
      />

      {/* Species tabs */}
      <div className={styles.tabs}>
        {speciesNames.map(name => {
          const cfg      = SPECIES_CONFIG[name]
          const count    = counts[name] || 0
          const isActive = selected === name
          return (
            <button
              key={name}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              style={isActive ? {
                borderColor: cfg?.color,
                background:  cfg?.bg,
                color:       cfg?.color,
              } : {}}
              onClick={() => handleSelectSpecies(name)}
            >
              <span>{cfg?.icon}</span>
              <span className={styles.tabName}>{name}</span>
              <span
                className={styles.tabBadge}
                style={isActive ? { background: cfg?.color, color: '#fff' } : {}}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Multi-lineage tabs */}
      {totalPages > 1 && (
        <div className={styles.lineageTabs}>
          {lineageGroups.map((group, i) => (
            <button
              key={i}
              className={`${styles.lineageTab} ${i === safePage ? styles.lineageTabActive : ''}`}
              style={i === safePage ? { borderColor: speciesConfig?.color, color: speciesConfig?.color } : {}}
              onClick={() => setActivePage(i)}
            >
              🌿 Lineage {i + 1}
              <span className={styles.lineageTabCount}>{group.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className={styles.chartWrapper}>
        {totalPages === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>{speciesConfig?.icon || '⬡'}</span>
            <p className={styles.emptyText}>No dragons registered for this species yet.</p>
            <p className={styles.emptyHint}>Members can add dragons via the Registry tab.</p>
          </div>
        ) : (
          <>
            {lineageWarnings.length > 0 && (
              <div className={styles.lineageWarnings}>
                <span className={styles.lineageWarningIcon}>⚠</span>
                <div>
                  <strong>Lineage issues detected — some edges removed to prevent crash:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    {lineageWarnings.map((w, i) => <li key={i} style={{ fontSize: 11 }}>{w.message}</li>)}
                  </ul>
                </div>
              </div>
            )}
            <ClanChartCanvas
              key={`${selected}-page-${safePage}`}
              data={lineageGroups[safePage] || []}
              speciesConfig={speciesConfig}
              prefs={prefs}
              groupIndex={safePage}
              totalGroups={totalPages}
            />
          </>
        )}
      </div>

      {/* Pagination dots */}
      {totalPages > 1 && (
        <div className={styles.paginationDots}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === safePage ? styles.dotActive : ''}`}
              style={i === safePage ? { background: speciesConfig?.color } : {}}
              onClick={() => setActivePage(i)}
              title={`Lineage ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Mate Pairs panel */}
      {matePairs.length > 0 && (
        <div className={styles.matePairsPanel}>
          <h3 className={`cinzel ${styles.matePairsTitle}`} style={{ color: speciesConfig?.color }}>
            💕 Mate Pairs — {selected}
            <span style={{ fontSize:11, fontWeight:400, color:'var(--muted)', marginLeft:8 }}>
              {matePairs.length} pair{matePairs.length !== 1 ? 's' : ''}
            </span>
          </h3>
          <p className={styles.matePairsHint}>
            Primary mates for this species. Click a dragon card in the registry to see their full harem list.
          </p>
          <div className={styles.matePairsGrid}>
            {matePairs.map(({ a, b }) => {
              const speciesMismatch = a.species !== b.species
              const haremA = Array.isArray(a.harem) ? a.harem.length : 0
              const haremB = Array.isArray(b.harem) ? b.harem.length : 0
              return (
                <div key={`${a.id}_${b.id}`} className={styles.matePairCard}
                     style={{ borderColor: speciesMismatch ? '#e05a5a' : `${speciesConfig?.color}40` }}>
                  {speciesMismatch && (
                    <div style={{ gridColumn:'1/-1', fontSize:10, color:'#e05a5a', marginBottom:4 }}>
                      ⚠ Inter-species pair — {a.species} × {b.species}
                    </div>
                  )}
                  <MateCard dragon={a} accentColor={speciesConfig?.color} haremCount={haremA} />
                  <div className={styles.mateHeart}>💕</div>
                  <MateCard dragon={b} accentColor={speciesConfig?.color} haremCount={haremB} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function MateCard({ dragon: d, accentColor, haremCount = 0 }) {
  const name = d.name || d.ownerUsername || d.player_name || '?'
  const glyph = d.gender === 'M' ? '♂' : d.gender === 'F' ? '♀' : '?'
  return (
    <div className={styles.mateCardInner}>
      <span className={styles.mateCardName}>{name}</span>
      {d.name && <span className={styles.mateCardOwner}>{d.ownerUsername || d.player_name}</span>}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
        <span className={styles.mateCardGender} style={{ color: d.gender === 'M' ? '#4da6ff' : '#e05a5a' }}>{glyph}</span>
        {d.skin_dominant && <span className={styles.mateCardSkin}>{d.skin_dominant}</span>}
        {haremCount > 0 && (
          <span style={{ fontSize:9, background:'rgba(92,114,245,0.2)', color:'var(--accent)', padding:'1px 5px', borderRadius:4 }}>
            +{haremCount} harem
          </span>
        )}
      </div>
    </div>
  )
}
