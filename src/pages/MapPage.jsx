import { isAdmin } from '../lib/roleUtils'
/**
 * MapPage.jsx — v6.1
 *
 * Interactive world map.
 * - Mouse wheel → zoom toward cursor
 * - Drag background → pan
 * - Click dragon pin → jump to registry
 * - Hold (400ms) + drag dragon pin → live reposition, release saves
 * - Filters: species, growth stage (member view) / + user (admin view)
 * - Admin tab shows ALL clan dragons
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../App'
import {
  SPECIES_CONFIG, SPECIES_LIST, GROWTH_STAGES, MAP_LOCATIONS,
} from '../lib/dragonData'
import styles from './MapPage.module.css'

const MAP_SRC = new URL('../../assets/map.webp', import.meta.url).href

// ─── Helpers ──────────────────────────────────────────────────────────────────

function speciesEmoji(species) {
  const cfg = SPECIES_CONFIG[species]
    || Object.values(SPECIES_CONFIG).find(c => c.code === species)
  return cfg?.icon || '🐉'
}

function speciesColor(species) {
  const cfg = SPECIES_CONFIG[species]
    || Object.values(SPECIES_CONFIG).find(c => c.code === species)
  return cfg?.color || '#5c72f5'
}

// ─── Location picker modal ────────────────────────────────────────────────────

// ── Coord helpers: frac (0-1) ↔ N/S E/W ──────────────────────────────────────
// x frac: 0 = far west, 0.5 = center (0), 1 = far east
// y frac: 0 = far north, 0.5 = center (0), 1 = far south
// Map coordinate space: 800N/S, 800E/W (1600×1600 total)
const MAP_RANGE = 800

function fracToNSEW(x, y) {
  const ewAbs = Math.round(Math.abs((x - 0.5) * MAP_RANGE * 2))
  const nsAbs = Math.round(Math.abs((0.5 - y) * MAP_RANGE * 2))
  const ewDir = x >= 0.5 ? 'E' : 'W'
  const nsDir = y <= 0.5 ? 'N' : 'S'
  return { nsAbs, ewAbs, nsDir, ewDir }
}

function nsewToFrac(nsAbs, nsDir, ewAbs, ewDir) {
  const ns = nsDir === 'N' ? nsAbs : -nsAbs
  const ew = ewDir === 'E' ? ewAbs : -ewAbs
  return {
    x: Math.max(0, Math.min(1, ew / (MAP_RANGE * 2) + 0.5)),
    y: Math.max(0, Math.min(1, 0.5 - ns / (MAP_RANGE * 2))),
  }
}

function coordLabel(nsAbs, nsDir, ewAbs, ewDir) {
  return `${nsAbs}${nsDir} ${ewAbs}${ewDir}`
}

function LocationPicker({ dragon, onSave, onClose, nestingSpots = [], userIsAdmin = false }) {
  const [locId, setLocId] = useState(dragon.location?.id || '')

  // Decompose existing coords into abs + direction
  const initCoords = dragon.location?.x != null
    ? fracToNSEW(dragon.location.x, dragon.location.y)
    : { nsAbs: 0, ewAbs: 0, nsDir: 'N', ewDir: 'E' }

  const [nsAbs, setNsAbs] = useState(String(initCoords.nsAbs ?? 0))
  const [nsDir, setNsDir] = useState(initCoords.nsDir ?? 'N')
  const [ewAbs, setEwAbs] = useState(String(initCoords.ewAbs ?? 0))
  const [ewDir, setEwDir] = useState(initCoords.ewDir ?? 'E')
  const [isNest, setIsNest] = useState(dragon.location?.isNest || false)
  const [spotName, setSpotName] = useState(dragon.location?.spotName || '')

  const isCustom = locId === 'custom'

  function handleSave() {
    if (!locId) { onSave(null); return }
    if (locId.startsWith('nest-')) {
      const spotId = locId.replace('nest-', '')
      const spot = nestingSpots.find(s => s.id === spotId)
      if (spot) onSave({ id: 'custom', label: spot.name, x: spot.x, y: spot.y, isNest: true, spotName: spot.name })
      return
    }
    if (isCustom) {
      const na = parseInt(nsAbs) || 0
      const ea = parseInt(ewAbs) || 0
      const { x, y } = nsewToFrac(na, nsDir, ea, ewDir)
      const label = spotName.trim() || coordLabel(na, nsDir, ea, ewDir)
      onSave({ id: 'custom', label, x, y, isNest, spotName: spotName.trim() })
    } else {
      const loc = MAP_LOCATIONS.find(l => l.id === locId)
      if (loc?.x != null) onSave({ id: loc.id, label: loc.label, x: loc.x, y: loc.y })
    }
  }

  return (
    <div className={styles.pickerOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.pickerModal}>
        <div className={styles.pickerHeader}>
          <span className={styles.pickerTitle}>
            Set Location — {dragon.species} {dragon.gender === 'M' ? '♂' : '♀'}
          </span>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className={styles.pickerBody}>
          <div className="form-group">
            <label>Known location</label>
            <select value={locId} onChange={e => setLocId(e.target.value)} className={styles.pickerSelect}>
              <option value="">— No location —</option>
              <option value="custom">📍 Custom coordinates (N/S E/W)</option>
              {userIsAdmin && nestingSpots.length > 0 && (
                <optgroup label="🥚 Shared Nesting Spots">
                  {nestingSpots.map(s => (
                    <option key={`nest-${s.id}`} value={`nest-${s.id}`}>{s.name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Map Locations">
                {MAP_LOCATIONS.map(l => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          {isCustom && (
            <>
              <p style={{ fontSize: 11, color: 'var(--hint)', margin: '4px 0 10px' }}>
                Center of map = 0. Choose direction then enter distance.
              </p>

              {/* North/South row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Distance N/S</label>
                  <input
                    type="number" min="0" max="800" step="1"
                    value={nsAbs}
                    onChange={e => setNsAbs(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ width: 80 }}>
                  <label>Direction</label>
                  <select value={nsDir} onChange={e => setNsDir(e.target.value)}>
                    <option value="N">N</option>
                    <option value="S">S</option>
                  </select>
                </div>
              </div>

              {/* East/West row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Distance E/W</label>
                  <input
                    type="number" min="0" max="800" step="1"
                    value={ewAbs}
                    onChange={e => setEwAbs(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ width: 80 }}>
                  <label>Direction</label>
                  <select value={ewDir} onChange={e => setEwDir(e.target.value)}>
                    <option value="E">E</option>
                    <option value="W">W</option>
                  </select>
                </div>
              </div>

              {/* Live preview */}
              <p style={{ fontSize: 12, color: 'var(--accent)', margin: '0 0 10px', fontWeight: 600 }}>
                📍 {coordLabel(parseInt(nsAbs)||0, nsDir, parseInt(ewAbs)||0, ewDir)}
              </p>

              {/* Nesting spot — always rendered for admins inside custom */}
              {userIsAdmin && (
                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label>Spot name <span style={{ color: 'var(--hint)', fontSize: 11 }}>(required to share as nesting spot)</span></label>
                    <input
                      value={spotName}
                      onChange={e => setSpotName(e.target.value)}
                      placeholder="e.g. Brood Nest"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      id="isNestChk"
                      checked={isNest}
                      onChange={e => setIsNest(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="isNestChk" style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                      🥚 Save as shared nesting spot (visible to all admins)
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className={styles.pickerFooter}>
          <button className="btn btn-ghost" onClick={() => onSave(null)}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

// ─── Map canvas ───────────────────────────────────────────────────────────────

function MapCanvas({ dragons, filterSpecies, filterGrowth, filterUser, userIsAdmin, onPinClick, onPinMove }) {
  const containerRef   = useRef(null)
  const [zoom,  setZoom]  = useState(1)
  const [pan,   setPan]   = useState({ x: 0, y: 0 })
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })

  // Drag-to-pan state
  const panDrag = useRef(null)   // { startMouseX, startMouseY, startPanX, startPanY, moved }

  // Pin-hold-drag state
  const pinHold  = useRef(null)  // setTimeout handle
  const pinDrag  = useRef(null)  // { dragonId, onMove }
  const [activeDragId, setActiveDragId] = useState(null)
  const [dragPos,      setDragPos]      = useState(null) // { x, y } screen coords while dragging
  const [stackPopup,   setStackPopup]   = useState(null) // { x, y, group[] }

  // Load natural image size
  useEffect(() => {
    const img = new Image()
    img.onload = () => setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src    = MAP_SRC
  }, [])

  const dispW = imgNatural.w * zoom
  const dispH = imgNatural.h * zoom

  function clampPan(p, z) {
    const el = containerRef.current
    if (!el || !imgNatural.w) return p
    const cW = el.clientWidth,  cH = el.clientHeight
    const mW = imgNatural.w * z, mH = imgNatural.h * z
    return {
      x: Math.max(Math.min(0, cW - mW), Math.min(0, p.x)),
      y: Math.max(Math.min(0, cH - mH), Math.min(0, p.y)),
    }
  }

  // ── Zoom ──
  function onWheel(e) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.12 : 0.88
    const newZ   = Math.max(0.25, Math.min(8, zoom * factor))
    const rect   = containerRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const newPan = {
      x: mx - (mx - pan.x) * (newZ / zoom),
      y: my - (my - pan.y) * (newZ / zoom),
    }
    setZoom(newZ)
    setPan(clampPan(newPan, newZ))
  }

  // ── Pan mouse events (on container) ──
  function onContainerDown(e) {
    if (e.button !== 0) return
    panDrag.current = {
      startMouseX: e.clientX, startMouseY: e.clientY,
      startPanX: pan.x, startPanY: pan.y,
      moved: false,
    }
  }

  // Keep latest pan/zoom in refs so global handlers always read fresh values
  const panRef  = useRef(pan)
  const zoomRef = useRef(zoom)
  const dispRef = useRef({ w: dispW, h: dispH })
  useEffect(() => { panRef.current  = pan  }, [pan])
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { dispRef.current = { w: dispW, h: dispH } }, [dispW, dispH])

  // ── Global mouse move (handles both pan + pin drag) ──
  useEffect(() => {
    function onMove(e) {
      // Pin drag takes priority — just track screen position in a ref, no setState
      if (pinDrag.current) {
        pinDrag.current.lastX = e.clientX
        pinDrag.current.lastY = e.clientY
        setDragPos({ x: e.clientX, y: e.clientY })
        return
      }
      // Pan
      if (!panDrag.current) return
      const dx = e.clientX - panDrag.current.startMouseX
      const dy = e.clientY - panDrag.current.startMouseY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panDrag.current.moved = true
      if (panDrag.current.moved) {
        setPan(prev => {
          const el = containerRef.current
          if (!el || !imgNatural.w) return prev
          const cW = el.clientWidth, cH = el.clientHeight
          const mW = imgNatural.w * zoomRef.current, mH = imgNatural.h * zoomRef.current
          const p = {
            x: panDrag.current.startPanX + dx,
            y: panDrag.current.startPanY + dy,
          }
          return {
            x: Math.max(Math.min(0, cW - mW), Math.min(0, p.x)),
            y: Math.max(Math.min(0, cH - mH), Math.min(0, p.y)),
          }
        })
      }
    }

    function onUp(e) {
      // Finish pin drag — read latest coords from ref, not stale closure
      if (pinDrag.current) {
        const rect = containerRef.current?.getBoundingClientRect()
        const { onMove: cb, lastX, lastY } = pinDrag.current

        // Immediately clear ALL drag state so pin stops following cursor
        pinDrag.current = null
        setActiveDragId(null)
        setDragPos(null)

        // Now compute final position and fire callback
        if (rect && cb) {
          const p = panRef.current
          const { w, h } = dispRef.current
          const clientX = lastX ?? e.clientX
          const clientY = lastY ?? e.clientY
          const frac = {
            x: Math.max(0, Math.min(1, (clientX - rect.left - p.x) / w)),
            y: Math.max(0, Math.min(1, (clientY - rect.top  - p.y) / h)),
          }
          cb(frac)
        }
      }
      panDrag.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  // Register once only — all live values read via refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Pin interaction ──
  function onPinDown(e, dragon) {
    e.stopPropagation()
    e.preventDefault()
    clearTimeout(pinHold.current)
    pinHold.current = setTimeout(() => {
      // Start drag mode
      pinDrag.current = {
        dragonId: dragon.id,
        onMove:   (frac) => onPinMove(dragon, frac),
      }
      setActiveDragId(dragon.id)
      setDragPos({ x: e.clientX, y: e.clientY })
    }, 380)
  }

  function onPinUp(e, dragon) {
    // DO NOT stopPropagation here — the global mouseup handler must fire to clear pinDrag
    clearTimeout(pinHold.current)
    const wasDragging = !!pinDrag.current
    if (!wasDragging) {
      e.stopPropagation() // short click: stop propagation only, so container doesn't pan
      onPinClick(dragon)
    }
    // If dragging: let the global onUp handler do cleanup + save
  }

  // ── Filtered dragons ──
  const visible = dragons.filter(d => {
    if (d.is_dead) return false  // dead dragons not shown on map
    if (!d.location || d.location.x == null) return false
    if (filterSpecies && d.species   !== filterSpecies) return false
    if (filterGrowth  && d.growth    !== filterGrowth)  return false
    if (filterUser    && d.user_id   !== filterUser)     return false
    return true
  })

  return (
    <div
      ref={containerRef}
      className={styles.mapContainer}
      onWheel={onWheel}
      onMouseDown={onContainerDown}
      onClick={() => setStackPopup(null)}
      style={{ cursor: panDrag.current?.moved ? 'grabbing' : 'grab' }}
    >
      {/* Map image + pins */}
      <div
        className={styles.mapInner}
        style={{ transform: `translate(${pan.x}px,${pan.y}px)`, width: dispW, height: dispH }}
      >
        {imgNatural.w > 0 && (
          <img
            src={MAP_SRC}
            className={styles.mapImage}
            draggable={false}
            style={{ width: dispW, height: dispH }}
            alt="World map"
          />
        )}

        {/* Pins — improved stacking: same-species stacks, different-species spread side-by-side */}
        {imgNatural.w > 0 && (() => {
          const SNAP = 0.015  // tighter snap = more accurate grouping
          const groups = {}
          visible.forEach(d => {
            const gx = Math.round(d.location.x / SNAP)
            const gy = Math.round(d.location.y / SNAP)
            const key = `${gx}_${gy}`
            if (!groups[key]) groups[key] = []
            groups[key].push(d)
          })

          return visible.map(d => {
            const isDraggingThis = activeDragId === d.id
            const gx = Math.round(d.location.x / SNAP)
            const gy = Math.round(d.location.y / SNAP)
            const key = `${gx}_${gy}`
            const group = groups[key]
            const groupIdx = group.indexOf(d)
            const groupSize = group.length

            let pinX = d.location.x * dispW
            let pinY = d.location.y * dispH

            if (groupSize > 1 && !isDraggingThis) {
              // Get unique species in this group for side-by-side spread
              const uniqueSpecies = [...new Set(group.map(g => g.species))]
              const mySpeciesIdx = uniqueSpecies.indexOf(d.species)
              const speciesGroup = group.filter(g => g.species === d.species)
              const myIdxInSpecies = speciesGroup.indexOf(d)

              // Different species: spread horizontally (side-by-side)
              const baseSpreadX = Math.min(24 * zoom, 36)
              pinX += (mySpeciesIdx - (uniqueSpecies.length - 1) / 2) * baseSpreadX

              // Same species stacked: small vertical arc, zoom-aware
              if (speciesGroup.length > 1) {
                const stackSpread = Math.min(10 + zoom * 3, 20)
                pinY += (myIdxInSpecies - (speciesGroup.length - 1) / 2) * stackSpread
              }
            }

            if (isDraggingThis && dragPos) {
              const rect = containerRef.current?.getBoundingClientRect()
              if (rect) {
                pinX = dragPos.x - rect.left - pan.x
                pinY = dragPos.y - rect.top  - pan.y
              }
            }

            const dead = !!d.is_dead
            const isGroupLeader = groupSize > 1 && groupIdx === 0
            const dragonName = d.name ? `${d.name} (${d.ownerUsername || d.player_name || ''})` : (d.ownerUsername || d.player_name || '')

            return (
              <div
                key={d.id}
                className={`${styles.pin} ${dead ? styles.pinDead : ''} ${isDraggingThis ? styles.pinDragging : ''}`}
                style={{
                  left:  pinX,
                  top:   pinY,
                  color: speciesColor(d.species),
                  pointerEvents: activeDragId && activeDragId !== d.id ? 'none' : 'auto',
                }}
                onMouseDown={e => onPinDown(e, d)}
                onMouseUp={e => {
                  // Short click on group leader = open stack popup
                  if (!isDraggingThis && groupSize > 1 && e.button === 0) {
                    e.stopPropagation()
                    setStackPopup({ x: pinX + pan.x, y: pinY + pan.y, group })
                    return
                  }
                  onPinUp(e, d)
                }}
                title={`${dragonName} · ${d.species} ${d.gender === 'M' ? '♂' : '♀'}${dead ? ' · DEAD' : ''}${groupSize > 1 ? ` (${groupSize} here)` : ''}`}
              >
                <span className={styles.pinIcon}>{dead ? '💀' : speciesEmoji(d.species)}</span>
                {d.growth && <span className={styles.pinGrowth}>{d.growth[0]}</span>}
                {isGroupLeader && (
                  <span className={styles.pinStackBadge}>{groupSize}</span>
                )}
                {isDraggingThis && <span className={styles.pinDragHint}>Drop to move</span>}
              </div>
            )
          })
        })()}

        {/* Stack popup — mini list when clicking a stacked group */}
        {stackPopup && (
          <div
            className={styles.stackPopup}
            style={{ left: stackPopup.x + 24, top: stackPopup.y - 8 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.stackPopupHeader}>
              {stackPopup.group.length} dragons here
              <button className={styles.stackPopupClose} onClick={() => setStackPopup(null)}>✕</button>
            </div>
            {stackPopup.group.map(d => (
              <div
                key={d.id}
                className={styles.stackPopupRow}
                onClick={() => { onPinClick(d); setStackPopup(null) }}
              >
                <span style={{ color: speciesColor(d.species) }}>{speciesEmoji(d.species)}</span>
                <span className={styles.stackPopupName}>
                  {d.name || d.ownerUsername || d.player_name || '?'}
                </span>
                <span className={styles.stackPopupSpecies}>{d.species}</span>
                <span style={{ color: d.gender === 'M' ? '#4da6ff' : '#e05a5a', fontSize: 11 }}>
                  {d.gender === 'M' ? '♂' : d.gender === 'F' ? '♀' : '?'}
                </span>
                {d.is_dead && <span className={styles.stackPopupDead}>💀</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div className={styles.zoomControls}>
        <button className={styles.zoomBtn} onClick={() => { const z = Math.min(8, zoom*1.3); setZoom(z); setPan(p => clampPan(p,z)) }}>＋</button>
        <span   className={styles.zoomLevel}>{Math.round(zoom*100)}%</span>
        <button className={styles.zoomBtn} onClick={() => { const z = Math.max(0.25, zoom*0.77); setZoom(z); setPan(p => clampPan(p,z)) }}>－</button>
        <button className={styles.zoomBtn} onClick={() => { setZoom(1); setPan({x:0,y:0}) }} title="Reset view">⌂</button>
      </div>

      {/* Empty hint */}
      {visible.length === 0 && imgNatural.w > 0 && (
        <div className={styles.mapEmpty}>
          No dragons placed on the map yet.
          <br /><span>Open a dragon's context menu and choose "Change Location".</span>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MapPage({ myDragons = [], onSelectDragon, onDragonMoved, clanMapMode = false }) {
  const { user, addToast } = useApp()

  const [tab,           setTab]           = useState(clanMapMode ? 'clan' : 'mine')
  const [filterSpecies, setFilterSpecies] = useState('')
  const [filterGrowth,  setFilterGrowth]  = useState('')
  const [filterUser,    setFilterUser]    = useState('')
  const [clanDragons,   setClanDragons]   = useState([])
  const [allUsers,      setAllUsers]      = useState([])
  const [loadingClan,   setLoadingClan]   = useState(false)
  const [locationTarget, setLocationTarget] = useState(null)
  const [nestingSpots,  setNestingSpots]  = useState([]) // shared nesting spots for admins

  const userIsAdmin = isAdmin(user)
  const showClanTab = false  // Clan map is now its own admin sidebar entry (★ Clan Map)

  // Load shared nesting spots (admins only — but all admins see them)
  useEffect(() => {
    if (userIsAdmin) {
      window.api.nestingSpot?.getAll()
        .then(spots => setNestingSpots(spots || []))
        .catch(() => {})
    }
  }, [userIsAdmin])

  // Load clan data when admin is on clan tab (or in clanMapMode)
  useEffect(() => {
    if ((tab === 'clan' || clanMapMode) && !clanDragons.length) {
      setLoadingClan(true)
      Promise.all([
        window.api.dragon.getAllClan(),
        window.api.auth.listUsers(),
      ]).then(([clanRes, users]) => {
        if (clanRes?.ok) setClanDragons(clanRes.dragons || [])
        setAllUsers(users || [])
      }).catch(() => addToast('Failed to load clan data', 'error'))
        .finally(() => setLoadingClan(false))
    }
  }, [tab, clanMapMode])

  const activeDragons   = (tab === 'clan' || clanMapMode) ? clanDragons : myDragons
  const placedCount     = activeDragons.filter(d => !d.is_dead && d.location?.x != null).length

  async function handlePinMove(dragon, frac) {
    const location = {
      id:    'custom',
      label: 'Custom',
      x:     Math.round(frac.x * 10000) / 10000,
      y:     Math.round(frac.y * 10000) / 10000,
    }
    try {
      await window.api.dragon.setLocation({ userId: user.id, id: dragon.id, location })
      onDragonMoved?.()
    } catch (err) {
      addToast('Failed to move pin: ' + err.message, 'error')
    }
  }

  async function handleLocationSave(dragon, location) {
    setLocationTarget(null)
    try {
      await window.api.dragon.setLocation({ userId: user.id, id: dragon.id, location })
      onDragonMoved?.()
      addToast(location ? `Location set to "${location.label}"` : 'Location cleared', 'success')

      // If admin saved a nesting spot, persist it to Firestore for all admins
      if (userIsAdmin && location?.isNest && location?.spotName) {
        try {
          await window.api.nestingSpot.save({
            name: location.spotName,
            x: location.x,
            y: location.y,
          })
          // Refresh nesting spots list
          const spots = await window.api.nestingSpot.getAll()
          setNestingSpots(spots || [])
          addToast(`Nesting spot "${location.spotName}" shared with all admins`, 'success')
        } catch {}
      }
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={`cinzel ${styles.title}`}>{clanMapMode ? '★ Clan Map' : 'World Map'}</h2>
          <p className={styles.sub}>
            {placedCount} dragon{placedCount !== 1 ? 's' : ''} placed
            {(tab === 'clan' || clanMapMode) ? ' · Clan view (admin)' : ''}
          </p>
        </div>
        <div className={styles.headerRight}>
          {showClanTab && (
            <div className={styles.tabRow}>
              <button className={`${styles.tabBtn} ${tab==='mine' ? styles.tabBtnActive : ''}`} onClick={() => setTab('mine')}>
                My Dragons
              </button>
              <button className={`${styles.tabBtn} ${tab==='clan' ? styles.tabBtnActive : ''}`} onClick={() => setTab('clan')}>
                ★ Clan
              </button>
            </div>
          )}
          <div className={styles.filters}>
            <select value={filterSpecies} onChange={e => setFilterSpecies(e.target.value)} className={styles.filterSelect}>
              <option value="">All species</option>
              {SPECIES_LIST.map(s => (
                <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
              ))}
            </select>
            <select value={filterGrowth} onChange={e => setFilterGrowth(e.target.value)} className={styles.filterSelect}>
              <option value="">All growth</option>
              {GROWTH_STAGES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {(tab === 'clan' || clanMapMode) && allUsers.length > 0 && (
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={styles.filterSelect}>
                <option value="">All members</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      {loadingClan ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading clan dragons…</p>
        </div>
      ) : (
        <MapCanvas
          dragons={activeDragons}
          filterSpecies={filterSpecies}
          filterGrowth={filterGrowth}
          filterUser={filterUser}
          userIsAdmin={userIsAdmin}
          onPinClick={d => onSelectDragon?.(d.id)}
          onPinMove={handlePinMove}
        />
      )}

      {/* Legend */}
      <div className={styles.legend}>
        {Object.values(SPECIES_CONFIG).map(cfg => (
          <span key={cfg.code} className={styles.legendItem} style={{ color: cfg.color }}>
            {cfg.icon} {cfg.code}
          </span>
        ))}
        <span className={styles.legendItem} style={{ color: 'var(--hint)' }}>💀 Dead</span>
        <span className={styles.legendHint}>
          Click pin → open in registry · Hold &amp; drag → move pin
        </span>
      </div>

      {/* Location picker */}
      {locationTarget && (
        <LocationPicker
          dragon={locationTarget}
          onSave={loc => handleLocationSave(locationTarget, loc)}
          onClose={() => setLocationTarget(null)}
          nestingSpots={nestingSpots}
          userIsAdmin={userIsAdmin}
        />
      )}
    </div>
  )
}
