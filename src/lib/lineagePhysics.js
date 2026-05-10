/**
 * lineagePhysics.js — v10.0 (Patch 8.2.1)
 *
 * Complete rewrite to match the Obsidian Graph View physics feel.
 *
 * ─── Why the previous engine felt wrong ────────────────────────────────────
 * The v9 engine used an "alpha" cooling schedule (borrowed from d3-force):
 *   - Forces were multiplied by alpha (starts at 1, decays to 0)
 *   - This caused a violent initial burst then the sim "froze" before settling
 *   - Nodes appeared too close because cooling cut off the repulsion early
 *
 * ─── Reference model (testgraph.html) ─────────────────────────────────────
 * The reference simulation that matches the desired feel uses:
 *
 *   REPULSION  = 5000     — applied to ALL pairs, constant, no decay
 *   SPRING     = 0.01     — very weak, bidirectional (pushes AND pulls)
 *   CENTERING  = 0.0005   — tiny constant pull toward origin
 *   DAMPING    = 0.85     — aggressive velocity decay per tick
 *   No alpha/cooling      — runs forever, settles purely via damping
 *   Integration: v += f (mass=1, force=acceleration directly)
 *   Collision: position correction, not force
 *
 * ─── Key Obsidian rules ────────────────────────────────────────────────────
 *   • Non-connected nodes have NO spring attraction to each other
 *   • Every node pair repels each other (Coulomb-like, F = k/d²)
 *   • Only connected pairs have a spring (both push and pull)
 *   • A tiny global centering prevents infinite drift
 *   • Drag releases the node WITHOUT pinning — physics immediately resumes
 *
 * ─── Our adaptations for rectangular dragon cards ──────────────────────────
 *   • Repulsion uses NODE_RADIUS = 80px (half-diagonal of the card) for
 *     the collision radius in resolveCollisions
 *   • Spring rest length is longer (120–200px) because cards are bigger
 *   • Pan is left-click drag on background (right-click used for link drawing)
 */

// ─── Tunable defaults (exposed so PhysicsPanel can edit them live) ────────────
export const DEFAULT_CONFIG = {
  repulsion:      5000,    // Coulomb strength  — reference uses 5000
  springStrength: 0.012,   // Hooke k           — reference uses 0.01
  springLength:   160,     // rest length (px)  — longer than ref because cards bigger
  centering:      0.0005,  // global centre pull — reference uses 0.0005
  damping:        0.85,    // velocity decay    — reference uses 0.85
  collisionR:     80,      // half-diagonal of NODE card (px)
}

/**
 * createSimulation(nodes, edges, userConfig)
 *
 * nodes: Array<{ id: string, dragon, childCount? }>
 * edges: Array<{ id, source: string, target: string, type, length? }>
 *
 * Returns a simulation handle.
 */
export function createSimulation(nodes, edges, userConfig = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...userConfig }

  // ── Internal node state ──
  // Keyed by node.id → { x, y, vx, vy, pinned, manuallyMoved, mass }
  const state = new Map()

  function initNodes(ns) {
    ns.forEach((n, i) => {
      if (state.has(n.id)) return
      // Golden-angle spiral placement — avoids initial cluster
      const angle  = i * 2.399963
      const radius = 80 + Math.sqrt(i) * 90
      state.set(n.id, {
        id:            n.id,
        x:             Math.cos(angle) * radius,
        y:             Math.sin(angle) * radius,
        vx:            0,
        vy:            0,
        pinned:        false,
        manuallyMoved: false,
        mass:          1,      // mass = 1 for all nodes (like the reference)
      })
    })
    // Remove stale nodes
    for (const id of state.keys()) {
      if (!ns.find(n => n.id === id)) state.delete(id)
    }
  }

  initNodes(nodes)

  // Build an edge lookup set for O(1) "are these two nodes connected?" checks
  // Used to decide whether to apply spring forces
  let edgeSet = buildEdgeSet(edges)
  let _edges  = edges

  function buildEdgeSet(es) {
    const s = new Set()
    for (const e of es) {
      const key = [e.source, e.target].sort().join('|')
      s.add(key)
    }
    return s
  }

  function isConnected(idA, idB) {
    return edgeSet.has([idA, idB].sort().join('|'))
  }

  // ── Simulation loop ──
  let rafId   = null
  let running = false
  let tickCbs = []

  function tick() {
    const nodeArr = [...state.values()]
    const N = nodeArr.length

    // 1. Clear forces
    for (const n of nodeArr) { n.fx = 0; n.fy = 0 }

    // 2. Repulsion — every pair, constant strength (no alpha)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = nodeArr[i]
        const b = nodeArr[j]

        const dx    = b.x - a.x
        const dy    = b.y - a.y
        const distSq = dx * dx + dy * dy + 0.01
        const dist   = Math.sqrt(distSq)
        const force  = cfg.repulsion / distSq

        const nx = dx / dist
        const ny = dy / dist
        const fx = nx * force
        const fy = ny * force

        // Repulsion pushes a away from b and b away from a
        a.fx -= fx
        a.fy -= fy
        b.fx += fx
        b.fy += fy
      }
    }

    // 3. Spring attraction — ONLY between connected pairs
    //    Bidirectional: spring pushes apart if too close, pulls if too far
    //    (exactly like the reference — force = strength * (dist - restLen))
    for (const e of _edges) {
      const a = state.get(e.source)
      const b = state.get(e.target)
      if (!a || !b) continue

      const dx   = b.x - a.x
      const dy   = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.0001

      const restLen = e.length || cfg.springLength
      const force   = cfg.springStrength * (dist - restLen)

      const nx = dx / dist
      const ny = dy / dist
      const fx = nx * force
      const fy = ny * force

      // For manually-moved nodes reduce inward pull so placement is respected
      const aFactor = a.manuallyMoved ? 0.25 : 1
      const bFactor = b.manuallyMoved ? 0.25 : 1

      a.fx += fx * aFactor
      a.fy += fy * aFactor
      b.fx -= fx * bFactor
      b.fy -= fy * bFactor
    }

    // 4. Global centering — tiny constant pull toward origin (prevents drift)
    for (const n of nodeArr) {
      n.fx += -n.x * cfg.centering
      n.fy += -n.y * cfg.centering
    }

    // 5. Integrate — velocity += force, then damp, then move
    //    (same as reference: v += f, v *= damping, x += v)
    for (const n of nodeArr) {
      if (n.pinned) continue

      n.vx = (n.vx + n.fx) * cfg.damping
      n.vy = (n.vy + n.fy) * cfg.damping

      // Safety clamp — prevents explosion on first frame
      const speed = Math.hypot(n.vx, n.vy)
      if (speed > 30) {
        n.vx = (n.vx / speed) * 30
        n.vy = (n.vy / speed) * 30
      }

      n.x += n.vx
      n.y += n.vy
    }

    // 6. Collision resolution — position correction (not force-based)
    //    Prevents cards overlapping. Uses cfg.collisionR as the minimum
    //    half-separation between node centres.
    const minSep = cfg.collisionR * 2
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = nodeArr[i]
        const b = nodeArr[j]
        if (a.pinned && b.pinned) continue

        const dx   = b.x - a.x
        const dy   = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.0001

        if (dist < minSep) {
          const overlap = minSep - dist
          const nx = dx / dist
          const ny = dy / dist
          const push = overlap * 0.5

          if (!a.pinned) { a.x -= nx * push; a.y -= ny * push }
          if (!b.pinned) { b.x += nx * push; b.y += ny * push }
        }
      }
    }

    tickCbs.forEach(cb => cb(getPositions()))
  }

  function loop() {
    if (!running) return
    tick()
    rafId = requestAnimationFrame(loop)
  }

  function getPositions() {
    const out = {}
    for (const [id, n] of state) {
      out[id] = { x: n.x, y: n.y, pinned: n.pinned, manuallyMoved: n.manuallyMoved }
    }
    return out
  }

  return {
    start() {
      if (running) return
      running = true
      loop()
    },

    stop() {
      running = false
      if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    },

    tick,

    /** Reheat is a no-op in this model — forces are constant.
     *  Kept for API compatibility with callers in LineageGraph.jsx */
    reheat() {},

    setConfig(updates) {
      Object.assign(cfg, updates)
      // Rebuild edge set in case edges changed
      edgeSet = buildEdgeSet(_edges)
    },

    updateGraph(newNodes, newEdges) {
      initNodes(newNodes)
      _edges  = newEdges
      edgeSet = buildEdgeSet(newEdges)
    },

    /** Hard-pin: node follows cursor exactly, no physics */
    pinNode(id, x, y) {
      const n = state.get(id)
      if (!n) return
      n.pinned = true
      if (x !== undefined) n.x = x
      if (y !== undefined) n.y = y
      n.vx = 0; n.vy = 0
    },

    /** Release pin — physics resumes immediately (Obsidian style: no lock) */
    unpinNode(id) {
      const n = state.get(id)
      if (n) { n.pinned = false; n.manuallyMoved = false }
    },

    /** Mark as manually moved — physics still runs but spring pull is reduced */
    markManuallMoved(id, x, y) {
      const n = state.get(id)
      if (!n) return
      n.manuallyMoved = true
      n.pinned = false
      if (x !== undefined) n.x = x
      if (y !== undefined) n.y = y
      n.vx = 0; n.vy = 0
    },

    setPosition(id, x, y) {
      const n = state.get(id)
      if (!n) return
      n.x = x; n.y = y
      n.vx = 0; n.vy = 0
    },

    /** Add a new node at a given world position (drag from sidebar) */
    addNode(node, x, y) {
      state.set(node.id, {
        id:            node.id,
        x:             x ?? 0,
        y:             y ?? 0,
        vx:            0,
        vy:            0,
        pinned:        false,
        manuallyMoved: true,
        mass:          1,
      })
    },

    getPositions,
    getNode(id) { return state.get(id) },
    onTick(cb)  { tickCbs.push(cb) },
    offTick(cb) { tickCbs = tickCbs.filter(f => f !== cb) },
    destroy()   { this.stop(); tickCbs = [] },

    get isRunning() { return running },
    // alpha getter kept for API compat — always 1 (no cooling)
    get alpha()     { return 1 },
  }
}

/** Convert DoD dragons into simulation nodes + edges */
export function buildGraph(dragons) {
  const idSet = new Set(dragons.map(d => String(d.id)))

  const childCount = {}
  dragons.forEach(d => {
    if (d.father_id && idSet.has(String(d.father_id)))
      childCount[d.father_id] = (childCount[d.father_id] || 0) + 1
    if (d.mother_id && idSet.has(String(d.mother_id)))
      childCount[d.mother_id] = (childCount[d.mother_id] || 0) + 1
  })

  const nodes = dragons.map(d => ({
    id:         String(d.id),
    dragon:     d,
    childCount: childCount[d.id] || 0,
  }))

  const edges = []
  const seenMate = new Set()

  dragons.forEach(d => {
    const sid = String(d.id)

    if (d.father_id && idSet.has(String(d.father_id)))
      edges.push({ id: `${d.father_id}->${sid}`, source: String(d.father_id), target: sid, type: 'parent', length: 160 })

    if (d.mother_id && idSet.has(String(d.mother_id)))
      edges.push({ id: `${d.mother_id}->${sid}`, source: String(d.mother_id), target: sid, type: 'parent', length: 160 })

    if (d.mate_id && idSet.has(String(d.mate_id))) {
      const key = [sid, String(d.mate_id)].sort().join('_')
      if (!seenMate.has(key)) {
        seenMate.add(key)
        edges.push({ id: `mate_${key}`, source: sid, target: String(d.mate_id), type: 'mate', length: 120 })
      }
    }
  })

  return { nodes, edges }
}
