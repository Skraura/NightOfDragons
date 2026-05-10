/**
 * lineageEngine.js — v7.5.0
 *
 * Safe lineage processing for DoD Tracker.
 * Handles:
 *  - Cycle / loop detection (prevents canvas crash)
 *  - Renesting rules (male can be own father → auto-kill prev dragon)
 *  - Female cannot be own mother
 *  - After 1 generation: males can be own grandfather(s), females own grandmother(s)
 *  - Line merging: two parents merge into one connector before reaching child
 *
 * Usage:
 *   import { buildSafeLineage, detectLineageIssues } from '../lib/lineageEngine'
 */

/**
 * detectLineageIssues(dragons)
 * Returns an array of warning objects for the UI, does NOT throw.
 * Never crashes — all errors are caught and surfaced as warnings.
 */
export function detectLineageIssues(dragons) {
  const issues = []
  if (!dragons?.length) return issues

  const byId = new Map(dragons.map(d => [String(d.id), d]))

  dragons.forEach(d => {
    const id = String(d.id)

    // Female cannot be her own mother
    if (d.gender === 'F' && d.mother_id && String(d.mother_id) === id) {
      issues.push({ type: 'self_mother', dragonId: id, message: `${_name(d)} is set as her own mother — females cannot be their own mother.` })
    }

    // Detect direct cycles (A → parent → A)
    const cycle = _findCycle(id, byId)
    if (cycle) {
      issues.push({ type: 'cycle', dragonId: id, path: cycle, message: `Circular lineage detected: ${cycle.join(' → ')}` })
    }
  })

  return issues
}

/**
 * buildSafeLineage(dragons)
 * Returns a clean set of dragons safe to render in the lineage canvas.
 * - Strips edges that cause direct cycles
 * - Strips self-mother edges
 * - Leaves self-father edges (renesting) intact — they are valid
 * - Annotates dragons that should be auto-killed due to renesting
 */
export function buildSafeLineage(dragons) {
  if (!dragons?.length) return { nodes: [], warnings: [], autoKillIds: new Set() }

  const warnings = []
  const autoKillIds = new Set()

  // Work on copies so we don't mutate the originals
  const nodes = dragons.map(d => ({ ...d }))
  const byId = new Map(nodes.map(d => [String(d.id), d]))

  nodes.forEach(d => {
    const id = String(d.id)

    // Rule: female cannot be own mother → strip the edge
    if (d.gender === 'F' && d.mother_id && String(d.mother_id) === id) {
      warnings.push({ type: 'self_mother', dragonId: id, message: `${_name(d)} cannot be her own mother — lineage edge removed.` })
      d.mother_id = null
    }

    // Rule: renesting — male is own father. Mark the previous instance for auto-kill.
    if (d.gender === 'M' && d.father_id && String(d.father_id) === id) {
      warnings.push({ type: 'renesting', dragonId: id, message: `${_name(d)} is renested (own father). Previous instance marked for auto-kill.` })
      autoKillIds.add(id)
    }

    // Cycle detection — strip any father_id or mother_id that creates a cycle
    if (d.father_id && _wouldCycle(String(d.father_id), id, byId)) {
      warnings.push({ type: 'cycle_stripped', dragonId: id, message: `Removed circular father link on ${_name(d)} to prevent canvas crash.` })
      d.father_id = null
    }
    if (d.mother_id && _wouldCycle(String(d.mother_id), id, byId)) {
      warnings.push({ type: 'cycle_stripped', dragonId: id, message: `Removed circular mother link on ${_name(d)} to prevent canvas crash.` })
      d.mother_id = null
    }
  })

  return { nodes, warnings, autoKillIds }
}

/**
 * splitIntoSafeGroups(nodes)
 * Splits a flat list of safe nodes into connected components for multi-chart rendering.
 * Each group is a self-contained lineage tree.
 */
export function splitIntoSafeGroups(nodes) {
  if (!nodes?.length) return []

  const idSet = new Set(nodes.map(d => String(d.id)))
  const adj = new Map()

  nodes.forEach(d => {
    const id = String(d.id)
    if (!adj.has(id)) adj.set(id, new Set())

    if (d.father_id && idSet.has(String(d.father_id))) {
      adj.get(id).add(String(d.father_id))
      if (!adj.has(String(d.father_id))) adj.set(String(d.father_id), new Set())
      adj.get(String(d.father_id)).add(id)
    }
    if (d.mother_id && idSet.has(String(d.mother_id))) {
      adj.get(id).add(String(d.mother_id))
      if (!adj.has(String(d.mother_id))) adj.set(String(d.mother_id), new Set())
      adj.get(String(d.mother_id)).add(id)
    }
  })

  const visited = new Set()
  const groups = []
  const byId = new Map(nodes.map(d => [String(d.id), d]))

  nodes.forEach(d => {
    const id = String(d.id)
    if (visited.has(id)) return
    // BFS
    const component = []
    const queue = [id]
    while (queue.length) {
      const cur = queue.shift()
      if (visited.has(cur)) continue
      visited.add(cur)
      if (byId.has(cur)) component.push(byId.get(cur))
      ;(adj.get(cur) || new Set()).forEach(n => { if (!visited.has(n)) queue.push(n) })
    }
    if (component.length) groups.push(component)
  })

  // Sort groups: largest first
  return groups.sort((a, b) => b.length - a.length)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _name(d) {
  return d.name || d.ownerUsername || d.player_name || d.species || d.id
}

/**
 * Would adding an edge (childId → ancestorId) create a cycle?
 * Uses DFS from ancestorId to see if childId is reachable through parents.
 */
function _wouldCycle(ancestorId, childId, byId, visited = new Set()) {
  if (ancestorId === childId) return true
  if (visited.has(ancestorId)) return false
  visited.add(ancestorId)

  const node = byId.get(ancestorId)
  if (!node) return false

  if (node.father_id && _wouldCycle(String(node.father_id), childId, byId, visited)) return true
  if (node.mother_id && _wouldCycle(String(node.mother_id), childId, byId, visited)) return true

  return false
}

/**
 * Find a cycle starting from nodeId, returns the cycle path or null.
 */
function _findCycle(nodeId, byId) {
  const path = []
  const visited = new Set()

  function dfs(id) {
    if (visited.has(id)) {
      const cycleStart = path.indexOf(id)
      if (cycleStart !== -1) return [...path.slice(cycleStart), id]
      return null
    }
    visited.add(id)
    path.push(id)
    const node = byId.get(id)
    if (node) {
      if (node.father_id) {
        const r = dfs(String(node.father_id))
        if (r) return r
      }
      if (node.mother_id) {
        const r = dfs(String(node.mother_id))
        if (r) return r
      }
    }
    path.pop()
    return null
  }

  return dfs(nodeId)
}
