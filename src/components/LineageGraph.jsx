/**
 * LineageGraph.jsx — v11.0 (Patch 8.3.5)
 *
 * Changes vs 8.3.3:
 *  - Child nodes are always orange (#ffd27a) with ♂/♀ symbol inside
 *  - Pause/Resume button removed
 *  - Reset button resets BOTH view AND physics (all nodes back to centre)
 *  - Male click: highlights all instances of that male + orange child-node,
 *    NO panning
 *  - Female-central click: highlights her cluster, NO panning
 *  - ref links (child-node → central-female) rendered as thin dashed lines
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { buildNestGraph, buildHighlightSets, findChildNode } from '../lib/lineageNestGraph'
import styles from './LineageGraph.module.css'

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  femaleCentral: '#ff7ab6',
  maleInstance:  '#7ad1ff',
  child:         '#ffd27a',   // always orange regardless of sex
  dead:          '#5a5a6a',
  unknown:       '#8a8a9a',
  highlight:     '#ffd54a',
  link:          'rgba(255,255,255,0.20)',
  cohesion:      'rgba(180,180,180,0.08)',
  bg:            '#0b0b0d',
}

function nodeColor(n) {
  if (n.isDead)    return C.dead
  if (n.isUnknown) return C.unknown
  if (n.type === 'female-central') return C.femaleCentral
  if (n.type === 'male-instance')  return C.maleInstance
  return C.child   // all child nodes are orange
}

function nodeRadius(n) {
  if (n.type === 'female-central') return 22
  if (n.type === 'male-instance')  return 14
  return 9
}

// ── Right panel ───────────────────────────────────────────────────────────────
function DragonPanel({ node, onClose }) {
  if (!node?.dragon) return null
  const d     = node.dragon
  const name  = d.name || d.player_name || d.ownerUsername || '?'
  const owner = d.name ? (d.player_name || d.ownerUsername || '') : ''
  const grade = ['A++','A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E','F']
    .find(g => Object.values(d).includes(g))

  return (
    <div className={styles.panel}>
      <button className={styles.panelClose} onClick={onClose}>✕</button>
      <div className={styles.panelHeader}>
        <span className={styles.panelGender}
          style={{ color: d.gender === 'M' ? C.maleInstance : d.gender === 'F' ? C.femaleCentral : '#aaa' }}>
          {d.gender === 'M' ? '♂' : d.gender === 'F' ? '♀' : '?'}
        </span>
        <div>
          <div className={styles.panelName}>{name}</div>
          {owner && <div className={styles.panelOwner}>{owner}</div>}
          <div className={styles.panelMeta}>
            {d.species && <span style={{ color: C.femaleCentral }}>{d.species}</span>}
            {d.growth  && <span>{d.growth}</span>}
            {(d.is_elder === 1 || d.elder_status === 'ELDER') &&
              <span className={styles.elderBadge}>ELDER</span>}
            {d.is_dead && <span className={styles.deadBadge}>DEAD</span>}
          </div>
        </div>
        {grade && <div className={styles.gradeBadge}>{grade}</div>}
      </div>

      <div className={styles.panelBody}>
        {(d.skin_dominant || d.skin_recessive) && (
          <div className={styles.panelRow}>
            <span className={styles.panelLabel}>Skin</span>
            <span>{d.skin_dominant}{d.skin_recessive ? ` / ${d.skin_recessive}` : ''}</span>
          </div>
        )}
        {d.bloodline_quality && (
          <div className={styles.panelRow}>
            <span className={styles.panelLabel}>Bloodline</span>
            <span>{d.bloodline_quality}</span>
          </div>
        )}
        {d.ticks != null && (
          <div className={styles.panelRow}>
            <span className={styles.panelLabel}>Ticks</span>
            <span>{d.ticks}</span>
          </div>
        )}
        {d.notes && (
          <div className={styles.panelRow} style={{ flexDirection:'column', gap:4 }}>
            <span className={styles.panelLabel}>Notes</span>
            <span style={{ fontSize:12, color:'rgba(230,238,246,0.65)', lineHeight:1.5 }}>{d.notes}</span>
          </div>
        )}
        <div className={styles.panelNodeType}>
          <b>{node.type}</b>
          {node.type === 'male-instance' && node.pairedWithId &&
            <> · nested with <code>{node.pairedWithId}</code></>}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LineageGraph({ dragons = [], clanDragons = [], user, onOpenDragon }) {
  const allDragons = useMemo(() => {
    const seen = new Set()
    return [...dragons, ...clanDragons].filter(d => {
      if (seen.has(d.id)) return false
      seen.add(d.id); return true
    })
  }, [dragons, clanDragons])

  const speciesList = useMemo(() =>
    [...new Set(allDragons.map(d => d.species).filter(Boolean))].sort(),
    [allDragons])

  const [selected,  setSelected]  = useState(speciesList[0] || '')
  const [panelNode, setPanelNode] = useState(null)

  useEffect(() => {
    if (!speciesList.includes(selected) && speciesList.length)
      setSelected(speciesList[0])
  }, [speciesList])

  const speciesDragons = useMemo(() =>
    allDragons.filter(d => d.species === selected),
    [allDragons, selected])

  const { nodes, links } = useMemo(() => buildNestGraph(speciesDragons), [speciesDragons])

  const svgRef   = useRef(null)
  const simRef   = useRef(null)
  const gRef     = useRef(null)
  const zoomRef  = useRef(null)
  // Store initial positions for reset
  const initPosRef = useRef(null)

  // ── Build simulation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svg   = d3.select(svgEl)
    svg.selectAll('*').remove()

    const W = svgEl.parentElement?.clientWidth  || 900
    const H = svgEl.parentElement?.clientHeight || 600

    const g = svg.append('g').attr('class', 'zoom-group')
    gRef.current = g

    const linkLayer = g.append('g').attr('class', 'links')
    const nodeLayer = g.append('g').attr('class', 'nodes')

    const simNodes = nodes.map(n => ({ ...n }))
    const simLinks = links.map(l => ({ ...l }))

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks)
        .id(d => d.id)
        .distance(d => {
          if (d.relation === 'cluster') return 130
          if (d.relation === 'parent')  return 85
          if (d.relation === 'cohesion') return 320  // soft pull, long rest length
          return 100
        })
        .strength(d => {
          if (d.relation === 'cluster') return 0.7
          if (d.relation === 'cohesion') return 0.02  // very weak — only prevents runaway drift
          return 0.9
        }))
      .force('charge', d3.forceManyBody().strength(-560))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide()
        .radius(d => {
          if (d.type === 'female-central') return 38
          if (d.type === 'male-instance')  return 28
          return 20
        })
        .strength(0.92))

    simRef.current = sim

    // Save initial positions after first stabilisation for Reset
    let initSaved = false
    sim.on('end', () => {
      if (!initSaved) {
        initSaved = true
        initPosRef.current = simNodes.map(n => ({ id: n.id, x: n.x, y: n.y }))
      }
    })

    // ── Links ──
    const linkSel = linkLayer.selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', d => d.relation === 'cohesion' ? C.cohesion : C.link)
      .attr('stroke-width', d => d.relation === 'cohesion' ? 0.8 : 1.6)
      .attr('stroke-dasharray', d => d.relation === 'cohesion' ? '2,6' : null)
      .attr('pointer-events', 'none')

    // ── Nodes ──
    const nodeSel = nodeLayer.selectAll('g.node')
      .data(simNodes, d => d.id)
      .join('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (ev, d) => {
          if (!ev.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y })
        .on('end', (ev, d) => {
          if (!ev.active) sim.alphaTarget(0)
          d.fx = null; d.fy = null
        }))
      .on('click', (ev, d) => onNodeClick(ev, d, simNodes, simLinks, g))

    // Circle
    nodeSel.append('circle')
      .attr('r', d => nodeRadius(d))
      .attr('fill', d => nodeColor(d))
      .attr('fill-opacity', 0.92)
      .attr('stroke', d => d.type === 'female-central' ? '#fff' : '#0b1220')
      .attr('stroke-width', d => d.type === 'female-central' ? 2.5 : 1.5)

    // Sex symbol INSIDE child nodes (♂/♀)
    nodeSel.filter(d => d.type === 'child')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#0b0b0d')
      .attr('font-size', 9)
      .attr('font-weight', '700')
      .attr('pointer-events', 'none')
      .text(d => d.sex === 'M' ? '♂' : d.sex === 'F' ? '♀' : '')

    // Name label above node
    nodeSel.append('text')
      .attr('dy', d => -(nodeRadius(d) + 7))
      .attr('text-anchor', 'middle')
      .attr('fill', '#e6eef6')
      .attr('font-size', d => d.type === 'female-central' ? 12 : 10)
      .attr('font-weight', d => d.type === 'female-central' ? '700' : '400')
      .attr('pointer-events', 'none')
      .text(d => (d.isDead ? '💀 ' : '') + trunc(d.label?.name || '?', 16))

    // Owner label above name
    nodeSel.append('text')
      .attr('dy', d => -(nodeRadius(d) + 7) - 12)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(159,183,217,0.65)')
      .attr('font-size', 9)
      .attr('pointer-events', 'none')
      .text(d => trunc(d.label?.owner || '', 14))

    // Species label below female-central
    nodeSel.filter(d => d.type === 'female-central')
      .append('text')
      .attr('dy', d => nodeRadius(d) + 13)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,122,182,0.5)')
      .attr('font-size', 9)
      .attr('pointer-events', 'none')
      .text(d => d.label?.species || '')

    // ── Tick ──
    sim.on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // ── Zoom ──
    const zoom = d3.zoom()
      .scaleExtent([0.05, 5])
      .on('zoom', ev => g.attr('transform', ev.transform))
    zoomRef.current = zoom
    svg.call(zoom)
    svg.call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(0.75))

    return () => sim.stop()
  }, [nodes, links]) // eslint-disable-line

  // ── Node click ─────────────────────────────────────────────────────────────
  function onNodeClick(ev, d, simNodes, simLinks, g) {
    ev.stopPropagation()
    setPanelNode(d)

    const { highlightNodes, highlightLinks } = buildHighlightSets(d, simNodes, simLinks)
    const hasHL = highlightNodes.size > 0

    g.selectAll('.node circle')
      .attr('stroke', n =>
        highlightNodes.has(n.id) ? C.highlight
          : n.type === 'female-central' ? '#fff' : '#0b1220')
      .attr('stroke-width', n =>
        highlightNodes.has(n.id) ? 3.5
          : n.type === 'female-central' ? 2.5 : 1.5)
      .attr('fill-opacity', n =>
        !hasHL || highlightNodes.has(n.id) ? 0.92 : 0.18)

    g.selectAll('.link')
      .attr('stroke-opacity', l =>
        !hasHL || highlightLinks.has(l.id) ? 0.9 : 0.05)

    // No panning on click — nodes stay where they are
  }

  // Click background → clear
  function onBgClick() {
    setPanelNode(null)
    if (!gRef.current) return
    gRef.current.selectAll('.node circle')
      .attr('stroke', d => d.type === 'female-central' ? '#fff' : '#0b1220')
      .attr('stroke-width', d => d.type === 'female-central' ? 2.5 : 1.5)
      .attr('fill-opacity', 0.92)
    gRef.current.selectAll('.link').attr('stroke-opacity', 0.9)
  }

  // ── Reset: clear all fx/fy, restart sim from scratch, reset zoom ───────────
  function handleReset() {
    setPanelNode(null)
    onBgClick()

    // Re-run physics from zero — remove any pinned positions
    if (simRef.current) {
      simRef.current.nodes().forEach(n => {
        n.x  = (Math.random() - 0.5) * 100
        n.y  = (Math.random() - 0.5) * 100
        n.vx = 0; n.vy = 0
        n.fx = null; n.fy = null
      })
      simRef.current.alpha(1).restart()
    }

    // Reset zoom to initial transform
    if (svgRef.current && zoomRef.current) {
      const W = svgRef.current.parentElement?.clientWidth  || 900
      const H = svgRef.current.parentElement?.clientHeight || 600
      d3.select(svgRef.current)
        .transition().duration(400)
        .call(zoomRef.current.transform,
          d3.zoomIdentity.translate(W / 2, H / 2).scale(0.75))
    }
  }

  return (
    <div className={styles.page}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.logo}>⬡ Lineage</span>
          <div className={styles.speciesTabs}>
            {speciesList.map(sp => (
              <button key={sp}
                className={`${styles.speciesTab} ${selected === sp ? styles.speciesTabActive : ''}`}
                onClick={() => { setSelected(sp); setPanelNode(null) }}>
                {sp}
                <span className={styles.speciesCount}>
                  {allDragons.filter(d => d.species === sp).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.toolbarRight}>
          <button className={styles.toolBtn} onClick={handleReset} title="Reset graph">
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Main */}
      <div className={styles.main}>
        <div className={styles.graphWrap} onClick={onBgClick}>
          {nodes.length === 0 ? (
            <div className={styles.emptyState}>
              <span style={{ fontSize: 48, opacity: 0.2 }}>⬡</span>
              <p>No lineage data for <b>{selected}</b></p>
              <p style={{ fontSize: 12 }}>Set mother_id / father_id on dragons in the Registry</p>
            </div>
          ) : (
            <svg ref={svgRef}
              style={{ width: '100%', height: '100%', display: 'block', background: C.bg }} />
          )}
        </div>

        {panelNode && (
          <DragonPanel
            node={panelNode}
            onClose={() => { setPanelNode(null); onBgClick() }}
          />
        )}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot}
            style={{ background: C.femaleCentral, border: '2px solid #fff' }} />
          Female (central)
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: C.maleInstance }} />
          Male (per nest)
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot}
            style={{ background: C.child, width: 9, height: 9, fontSize: 7,
              display:'flex', alignItems:'center', justifyContent:'center', color:'#0b0b0d' }}>
            ♂♀
          </span>
          Child (orange)
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: C.dead }} />
          Dead
        </span>
        <span style={{ marginLeft:'auto', fontSize:10,
          color:'rgba(255,255,255,0.15)', fontFamily:'monospace' }}>
          {nodes.length} nodes · {links.length} edges
        </span>
      </div>
    </div>
  )
}

function trunc(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
