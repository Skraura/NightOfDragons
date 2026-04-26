import { useEffect, useRef, useState } from 'react'
import f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'
import { SPECIES_CONFIG, SPECIES_FULL } from '../lib/dragonData'
import { dragonsBySpeciesGrouped } from '../lib/dragonToF3'
import { dragonCardCreator } from '../lib/dragonCardTemplate'
import useLineagePrefs from '../hooks/useLineagePrefs'
import styles from './LineageTree.module.css'

// ── Chart canvas for one lineage group ───────────────────────────────────────

function FamilyChartCanvas({ data, speciesConfig, prefs, groupIndex, totalGroups }) {
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
          .setCardXSpacing(230)
          .setCardYSpacing(110)

        chart.setCardHtml()
          .setCardInnerHtmlCreator(
            dragonCardCreator(prefs, accentColor, accentBg)
          )

        chart.updateTree({ initial: true, main_id: rootId })

        try {
          const svg = wrapper.querySelector('svg')
          if (svg) f3.zoomTo(svg, 0.9)
        } catch (_) { /* zoom best-effort */ }

        chartRef.current = chart
        setReady(true)
      } catch (err) {
        console.error('[LineageTree] init error:', err)
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
      .setCardInnerHtmlCreator(
        dragonCardCreator(prefs, accentColor, accentBg)
      )
    chart.updateTree({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, ready])

  if (!data.length) return null

  return (
    <div className={styles.canvasPage}>
      {totalGroups > 1 && (
        <div className={styles.canvasLabel}>
          <span className={styles.canvasLabelIcon}>🌿</span>
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

// ── Pagination dots ───────────────────────────────────────────────────────────

function PaginationDots({ total, active, onSelect }) {
  if (total <= 1) return null
  return (
    <div className={styles.paginationDots}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          className={`${styles.dot} ${i === active ? styles.dotActive : ''}`}
          onClick={() => onSelect(i)}
          title={`Lineage ${i + 1}`}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LineageTree({ dragons = [] }) {
  const speciesNames  = Object.values(SPECIES_FULL)
  const [selected, setSelected] = useState(speciesNames[0])
  const [activePage, setActivePage] = useState(0)
  const { prefs } = useLineagePrefs()

  const speciesConfig = SPECIES_CONFIG[selected]

  const counts = {}
  speciesNames.forEach(name => {
    const code = Object.entries(SPECIES_FULL).find(([, n]) => n === name)?.[0]
    counts[name] = dragons.filter(d => d.species === code || d.species === name).length
  })

  // Get grouped lineages — each element is an array of f3 nodes (a connected component)
  const lineageGroups = dragonsBySpeciesGrouped(dragons, selected)
  const totalPages    = lineageGroups.length

  // Reset to page 0 when species changes
  const handleSelectSpecies = (name) => {
    setSelected(name)
    setActivePage(0)
  }

  // Clamp page in case dragons change
  const safePage = Math.min(activePage, Math.max(0, totalPages - 1))

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={`cinzel ${styles.title}`}>Lineage</h2>
        <p className={styles.sub}>
          Family tree by species · Click any card to re-center · Scroll to zoom
          {totalPages > 1 && (
            <span className={styles.subPageHint}> · {totalPages} separate lineages detected</span>
          )}
        </p>
      </div>

      {/* Species selector tabs */}
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
              <span className={styles.tabIcon}>{cfg?.icon}</span>
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

      {/* Pagination tabs (only when multiple lineage groups) */}
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

      {/* Chart area — shows the active page */}
      <div className={styles.chartWrapper}>
        {totalPages === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>{speciesConfig?.icon || '⬡'}</span>
            <p className={styles.emptyText}>No dragons registered for this species yet.</p>
            <p className={styles.emptyHint}>Add dragons via the Registry tab and link their parents.</p>
          </div>
        ) : (
          <FamilyChartCanvas
            key={`${selected}-page-${safePage}`}
            data={lineageGroups[safePage] || []}
            speciesConfig={speciesConfig}
            prefs={prefs}
            groupIndex={safePage}
            totalGroups={totalPages}
          />
        )}
      </div>

      {/* Pagination dots */}
      <PaginationDots total={totalPages} active={safePage} onSelect={setActivePage} />
    </div>
  )
}
