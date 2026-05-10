/**
 * dragonToF3.js — v5.1
 * Converts dod-tracker dragon DB rows into the family-chart data format.
 * v5.1: Added connected-component clustering for multi-lineage support.
 */

import { SPECIES_FULL, ALL_STAT_KEYS, GRADES } from './dragonData'
import { buildSafeLineage } from './lineageEngine'

const GRADES_ORDER = [...GRADES]

/** Best stat grade across all 22 stats */
export function getBestGrade(dragon) {
  const grades = ALL_STAT_KEYS.map(k => dragon[k]).filter(Boolean)
  if (!grades.length) return null
  return grades.sort((a, b) => GRADES_ORDER.indexOf(a) - GRADES_ORDER.indexOf(b))[0]
}

export function dragonToF3(dragons) {
  if (!dragons || !dragons.length) return []

  const idSet = new Set(dragons.map(d => String(d.id)))

  const nodes = dragons.map(d => {
    const sid = String(d.id)

    const parentIds = []
    if (d.father_id && idSet.has(String(d.father_id))) parentIds.push(String(d.father_id))
    if (d.mother_id && idSet.has(String(d.mother_id))) parentIds.push(String(d.mother_id))

    const childIds = dragons
      .filter(c => String(c.father_id) === sid || String(c.mother_id) === sid)
      .map(c => String(c.id))

    const spouseSet = new Set()
    dragons.forEach(other => {
      const oid = String(other.id)
      if (oid === sid) return
      const shared = dragons.some(c =>
        (String(c.father_id) === sid && String(c.mother_id) === oid) ||
        (String(c.mother_id) === sid && String(c.father_id) === oid)
      )
      if (shared) spouseSet.add(oid)
    })

    const stats = {}
    for (const key of ALL_STAT_KEYS) {
      stats[key] = d[key] || ''
    }

    return {
      id: sid,
      data: {
        gender:           d.gender === 'M' ? 'M' : d.gender === 'F' ? 'F' : 'M',
        name:             d.ownerUsername || d.player_name || `${d.species || '?'} ${d.gender === 'M' ? '♂' : '♀'}`,
        skin:             d.skin_dominant || '',
        skinRec:          d.skin_recessive || '',
        growth:           d.growth    || '',
        clanRole:         d.clan_role || '',
        isElder:          d.is_elder === 1 || d.elder_status === 'ELDER',
        isDead:           !!d.is_dead,
        ticks:            typeof d.ticks === 'number' ? d.ticks : 0,
        bloodlineQuality: d.bloodline_quality || null,
        stats,
      },
      rels: {
        parents:  parentIds,
        spouses:  [...spouseSet],
        children: childIds,
      }
    }
  })

  const nodeMap = {}
  nodes.forEach(n => { nodeMap[n.id] = n })
  nodes.forEach(n => {
    n.rels.parents.forEach(pid  => { if (!nodeMap[pid]) console.warn(`[dragonToF3] parent ${pid} of ${n.id} not found`) })
    n.rels.children.forEach(cid => { if (!nodeMap[cid]) console.warn(`[dragonToF3] child ${cid} of ${n.id} not found`) })
  })

  return nodes
}

/**
 * Split f3 nodes into connected components (separate family trees).
 * Two nodes are connected if they share a parent, child, or spouse link.
 */
export function splitIntoLineageGroups(nodes) {
  if (!nodes.length) return []

  const adjacency = {}
  nodes.forEach(n => { adjacency[n.id] = new Set() })

  nodes.forEach(n => {
    ;[...n.rels.parents, ...n.rels.children, ...n.rels.spouses].forEach(otherId => {
      if (adjacency[n.id]) adjacency[n.id].add(otherId)
      if (adjacency[otherId]) adjacency[otherId].add(n.id)
    })
  })

  const visited = new Set()
  const groups = []

  nodes.forEach(startNode => {
    if (visited.has(startNode.id)) return
    // BFS
    const group = []
    const queue = [startNode.id]
    while (queue.length) {
      const id = queue.shift()
      if (visited.has(id)) continue
      visited.add(id)
      const node = nodes.find(n => n.id === id)
      if (node) {
        group.push(node)
        adjacency[id].forEach(neighborId => {
          if (!visited.has(neighborId)) queue.push(neighborId)
        })
      }
    }
    groups.push(group)
  })

  return groups
}

export function dragonsBySpeciesToF3(allDragons, speciesName) {
  const code     = Object.entries(SPECIES_FULL).find(([, name]) => name === speciesName)?.[0]
  const filtered = allDragons.filter(d => d.species === code || d.species === speciesName)
  // Run safe lineage engine — strips cycles and invalid edges before converting
  const { nodes: safeNodes, warnings } = buildSafeLineage(filtered)
  if (warnings.length) console.warn('[Lineage]', warnings.map(w => w.message).join(' | '))
  return dragonToF3(safeNodes)
}

/** Returns an array of f3-node groups, each group being a connected lineage. */
export function dragonsBySpeciesGrouped(allDragons, speciesName) {
  const code     = Object.entries(SPECIES_FULL).find(([, name]) => name === speciesName)?.[0]
  const filtered = allDragons.filter(d => d.species === code || d.species === speciesName)
  // Safe preprocessing
  const { nodes: safeNodes, warnings } = buildSafeLineage(filtered)
  if (warnings.length) console.warn('[Lineage]', warnings.map(w => w.message).join(' | '))
  const f3nodes = dragonToF3(safeNodes)
  return splitIntoLineageGroups(f3nodes)
}
