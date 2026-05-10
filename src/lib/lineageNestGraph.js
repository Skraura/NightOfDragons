/**
 * lineageNestGraph.js — v3.0 (Patch 8.3.5)
 *
 * GRAPH MODEL
 * ───────────────────────────────────────────────────────────────────────────
 *
 *  female-central  Pink circle (r=22, white border)
 *    Every female with ≥1 child whose mother_id points to her.
 *    One node per female dragon, always. If she is also someone's child
 *    she appears as BOTH a central-female node AND her child-node connects
 *    to her central node via a parent link.
 *
 *  male-instance   Blue circle (r=14)
 *    One per (fatherId × motherId) pair. Same male nested with 3 females
 *    → 3 separate blue nodes, each connected to their female only.
 *    Connected to the female-central node via a visible 'cluster' link.
 *
 *  child           Orange circle (r=9) with ♂/♀ symbol inside
 *    Offspring. Connected ONLY to its male-instance node (never to the
 *    female-central directly). Always orange; sex shown as symbol inside.
 *    If a child female is also a central female, her child-node is a
 *    separate small orange node that links to her central-female node.
 *
 * EDGES
 * ───────────────────────────────────────────────────────────────────────────
 *  cluster  female-central → male-instance   VISIBLE, same style as parent
 *  parent   male-instance  → child / female-central-child
 *
 * UNKNOWN PLACEHOLDERS
 * ───────────────────────────────────────────────────────────────────────────
 *  Only when exactly ONE parent is known but missing from dataset:
 *    → Unknown ♀ / Unknown ♂ placeholder node created
 *  When BOTH parents blank → floating lone node, no connections
 *  When NEITHER parent exists in dataset but IDs are set → same as unknown
 *
 * DEAD DRAGONS → grey node
 *
 * CLICK RULES (enforced in LineageGraph.jsx)
 * ───────────────────────────────────────────────────────────────────────────
 *  male-instance click → highlight ALL instances of that male (all blue nodes
 *                        with same maleId) + his orange child-node if exists.
 *                        NO panning.
 *  female-central click → highlight her central node + all her males + all
 *                         children. NO panning.
 *  child click → highlight just itself + its parent male-instance.
 *                Opens right panel.
 */

function mkLabel(d) {
  if (!d) return { name: 'Unknown', owner: '', species: '' }
  const name  = d.name || d.player_name || d.ownerUsername || '?'
  const owner = d.name
    ? (d.player_name || d.ownerUsername || '')
    : (d.ownerUsername || d.player_name || '')
  return { name, owner, species: d.species || '' }
}

function isDead(d) {
  return d && (d.is_dead === 1 || d.is_dead === true || d.is_dead === '1')
}

export function buildNestGraph(dragons) {
  const byId  = new Map(dragons.map(d => [String(d.id), d]))
  const nodes = []
  const links = []
  const nMap  = new Map()   // nodeId → node
  let   unkN  = 0

  function upsert(id, props) {
    if (nMap.has(id)) {
      const ex = nMap.get(id)
      // Allow upgrade child → female-central
      if (props.type === 'female-central' && ex.type === 'child') {
        Object.assign(ex, props, { id })
      }
      return ex
    }
    const n = { id, ...props }
    nMap.set(id, n)
    nodes.push(n)
    return n
  }

  function addLink(id, source, target, relation) {
    if (!links.some(l => l.id === id))
      links.push({ id, source, target, relation })
  }

  // ── Pass 1: group children by mother, then by father ──────────────────────
  // nestsByMother: motherKey → Map(fatherKey → [children])
  const nestsByMother = new Map()

  dragons.forEach(child => {
    const mid = child.mother_id ? String(child.mother_id) : null
    const fid = child.father_id ? String(child.father_id) : null

    // Both blank → floating, skip clustering
    if (!mid && !fid) return

    // Use a unique per-child key for unknown mothers so each child
    // with no mother gets its own Unknown ♀ node
    const motherKey = mid ?? `__unkMom_${String(child.id)}`
    const fatherKey = fid ?? `__unkDad_${motherKey}_${String(child.id)}`

    if (!nestsByMother.has(motherKey)) nestsByMother.set(motherKey, new Map())
    const byFather = nestsByMother.get(motherKey)
    if (!byFather.has(fatherKey)) byFather.set(fatherKey, [])
    byFather.get(fatherKey).push(child)
  })

  // ── Pass 2: build central-female nodes first (so child→central links work) ──
  for (const [motherKey] of nestsByMother) {
    const isReal = !motherKey.startsWith('__unkMom')
    const dragon = isReal ? byId.get(motherKey) : null
    const nodeId = isReal ? motherKey : `unkF_${++unkN}`

    upsert(nodeId, {
      type:      'female-central',
      dragonId:  isReal ? motherKey : null,
      sex:       'F',
      label:     isReal ? mkLabel(dragon) : { name: 'Unknown ♀', owner: '', species: '' },
      dragon:    dragon ?? null,
      isDead:    isDead(dragon),
      isUnknown: !isReal,
      _motherKey: motherKey,   // internal: links motherKey → nodeId
    })
  }

  // Build motherKey → centralNodeId lookup
  const centralIdByMother = new Map()
  for (const n of nodes) {
    if (n.type === 'female-central' && n._motherKey)
      centralIdByMother.set(n._motherKey, n.id)
  }

  // ── Pass 3: for each mother cluster, add males + children ─────────────────
  for (const [motherKey, byFather] of nestsByMother) {
    const centralId = centralIdByMother.get(motherKey)

    for (const [fatherKey, children] of byFather) {
      const isRealDad = !fatherKey.startsWith('__unkDad')
      const dadDragon = isRealDad ? byId.get(fatherKey) : null

      // One male-instance per (father × mother) pair
      const maleInstId = isRealDad
        ? `male::${fatherKey}::with::${centralId}`
        : `male::unk_${++unkN}::with::${centralId}`

      upsert(maleInstId, {
        type:         'male-instance',
        dragonId:     isRealDad ? fatherKey : null,
        maleId:       isRealDad ? fatherKey : null,
        pairedWithId: centralId,
        sex:          'M',
        label:        isRealDad ? mkLabel(dadDragon) : { name: 'Unknown ♂', owner: '', species: '' },
        dragon:       dadDragon ?? null,
        isDead:       isDead(dadDragon),
        isUnknown:    !isRealDad,
      })

      // Visible cluster link: female-central → male-instance
      addLink(`cluster::${centralId}::${maleInstId}`, centralId, maleInstId, 'cluster')

      // Children
      children.forEach(child => {
        const cid = String(child.id)

        // Is this child also a central female?
        const childCentralId = centralIdByMother.get(cid)

        if (childCentralId) {
          // Child is a central female — create a small orange child-node that
          // links DOWN to her central node. This keeps the orange node separate
          // from the central node and shows both "who she is as a child" and
          // "her own family cluster".
          const childNodeId = `child_node::${cid}::under::${maleInstId}`
          upsert(childNodeId, {
            type:       'child',
            dragonId:   cid,
            sex:        child.gender || 'F',
            label:      mkLabel(child),
            dragon:     child,
            isDead:     isDead(child),
            isUnknown:  false,
            isCentralRef: true,   // this child-node IS the central female
          })
          // male-instance → orange child-node
          addLink(`parent::${maleInstId}::${childNodeId}`, maleInstId, childNodeId, 'parent')
          // (no ref link — child-node and central-node are visually distinct)
        } else {
          // Regular child node
          upsert(cid, {
            type:      'child',
            dragonId:  cid,
            sex:       child.gender || null,
            label:     mkLabel(child),
            dragon:    child,
            isDead:    isDead(child),
            isUnknown: false,
          })
          addLink(`parent::${maleInstId}::${cid}`, maleInstId, cid, 'parent')
        }
      })
    }
  }

  // ── Pass 4: floating nodes (both parents blank) ───────────────────────────
  dragons.forEach(d => {
    const sid = String(d.id)
    if (nMap.has(sid)) return
    const mid = d.mother_id ? String(d.mother_id) : null
    const fid = d.father_id ? String(d.father_id) : null
    if (mid || fid) return   // has lineage data → should be connected already
    // Truly isolated — no parents, no children: floating node
    upsert(sid, {
      type:     'child',
      dragonId: sid,
      sex:      d.gender || null,
      label:    mkLabel(d),
      dragon:   d,
      isDead:   isDead(d),
      isUnknown: false,
      floating:  true,
    })
  })

  // ── Cohesion links: connect every central-female to every other ──────────
  // These are very weak 'cohesion' links that prevent clusters from flying
  // too far apart due to charge repulsion. They are rendered as faint grey
  // lines so the user can see the gentle pull between clusters.
  const centralFemales = nodes.filter(n => n.type === 'female-central')
  for (let i = 0; i < centralFemales.length; i++) {
    for (let j = i + 1; j < centralFemales.length; j++) {
      const a = centralFemales[i]
      const b = centralFemales[j]
      addLink(`cohesion::${a.id}::${b.id}`, a.id, b.id, 'cohesion')
    }
  }

  return { nodes, links }
}

// ── Highlight sets ─────────────────────────────────────────────────────────────

export function buildHighlightSets(clickedNode, nodes, links) {
  const hNodes = new Set()
  const hLinks = new Set()

  if (!clickedNode) return { highlightNodes: hNodes, highlightLinks: hLinks }

  const sid = l => (typeof l.source === 'object' ? l.source.id : l.source)
  const tid = l => (typeof l.target === 'object' ? l.target.id : l.target)

  function neighbours(nodeId) {
    hNodes.add(nodeId)
    links.forEach(l => {
      if (sid(l) === nodeId || tid(l) === nodeId) {
        hLinks.add(l.id)
        hNodes.add(sid(l))
        hNodes.add(tid(l))
      }
    })
  }

  if (clickedNode.type === 'female-central') {
    // Highlight her + all males + all children (2 levels)
    neighbours(clickedNode.id)
    const lvl1 = new Set(hNodes)
    lvl1.forEach(id => neighbours(id))

  } else if (clickedNode.type === 'male-instance') {
    // All instances of this male across all females + his own orange child-node
    const maleId = clickedNode.maleId
    nodes.forEach(n => {
      if (n.type === 'male-instance' && n.maleId === maleId) {
        neighbours(n.id)
      }
    })
    // Also highlight any child-node whose dragonId === maleId
    nodes.forEach(n => {
      if (n.type === 'child' && n.dragonId === maleId) hNodes.add(n.id)
    })

  } else {
    // child — itself + parent male-instance
    neighbours(clickedNode.id)
  }

  return { highlightNodes: hNodes, highlightLinks: hLinks }
}

export function findChildNode(dragonId, nodes) {
  if (!dragonId) return null
  return nodes.find(n => n.dragonId === dragonId && n.type === 'child') || null
}
