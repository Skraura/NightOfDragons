import { isAdmin } from '../lib/roleUtils'
/**
 * DragonForm.jsx — v7.1
 *
 * Changes from v6.1:
 *  - Name field RESTORED (shown between owner and account+species in registry)
 *  - Gender dropdown keyboard navigation fixed (emoji stripped from option text)
 *  - Hungry checkbox bigger (24×24px)
 *  - Click-off overlay shows "Are you sure?" confirmation
 *  - Ticks stored as 0–1, displayed/entered as 0–100%
 *  - "Purity" → "Skin Purity"
 *  - Mate / Harem fields added
 */

import { useState, useRef } from 'react'
import {
  SPECIES_LIST, GROWTH_STAGES, CLAN_ROLES, GENDERS, GRADES, BLOODLINE_GRADES,
  ALL_STAT_KEYS, ALL_RSTAT_KEYS, STAT_GROUPS,
  TRAIT_KEYS, TRAIT_DEFS, TRAIT_POINTS,
  getSkinsForSpecies, SKIN_COLORS,
  ticksFromGrowth,
  MAP_LOCATIONS,
} from '../lib/dragonData'
import { useApp } from '../App'
import styles from './DragonForm.module.css'

export default function DragonForm({ dragon, allDragons, clanDragons = [], nestingSpots = [], onSave, onClose }) {
  const { user } = useApp()
  const userIsAdmin = isAdmin(user)
  const isEdit = !!dragon

  // User's own accounts (Steam handles)
  const userAccounts = user?.accounts || [{ id: user?.id, label: user?.username }]
  const getAccountLabel = (id) => userAccounts.find(a => a.id === id)?.label || user?.username || ''

  const ELDER_TICKS = { ASD:49, BIO:49, BS:75, SS:80, FS:110, IR:110, BW:181 }
  const initMaxTicks = ELDER_TICKS[dragon?.species] || null
  const initTicksRaw = (dragon?.ticks != null && initMaxTicks)
    ? (dragon.ticks * initMaxTicks).toFixed(1)
    : ''

  const initStats  = ALL_STAT_KEYS.reduce( (acc, k) => ({ ...acc, [k]: dragon?.[k]  || '' }), {})
  const initRStats = ALL_RSTAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: dragon?.[k]  || '' }), {})
  const initAccountId = dragon?.account_id || userAccounts[0]?.id || ''

  // ticks stored 0–1 internally, edited/displayed as 0–100
  const ticksPct = dragon?.ticks != null ? Math.round(dragon.ticks * 100) : ''

  const [form, setForm] = useState({
    account_id:       initAccountId,
    name:             dragon?.name             || '',
    species:          dragon?.species          || '',
    gender:           dragon?.gender           || '',
    skin_dominant:    dragon?.skin_dominant    || '',
    skin_recessive:   dragon?.skin_recessive   || '',
    growth:           dragon?.growth           || '',
    clan_role:        dragon?.clan_role        || '',
    ticks:            ticksPct,
    ticksRaw:         initTicksRaw,
    is_elder:         dragon?.is_elder         || 0,
    father_id:        dragon?.father_id        || '',
    mother_id:        dragon?.mother_id        || '',
    bloodline_quality: dragon?.bloodline_quality || '',
    purity:           dragon?.purity           || '',
    trait_dominant:   dragon?.trait_dominant   || 0,
    trait_scavenger:  dragon?.trait_scavenger  || 0,
    trait_fast:       dragon?.trait_fast       || 0,
    // OCR name fields (kept for lineage OCR matching)
    father_name:       dragon?.father_name       || '',
    mother_name:       dragon?.mother_name       || '',
    grandfather1_name: dragon?.grandfather1_name || '',
    grandfather2_name: dragon?.grandfather2_name || '',
    grandmother1_name: dragon?.grandmother1_name || '',
    grandmother2_name: dragon?.grandmother2_name || '',
    // player_name = Steam handle label (synced from account selector)
    player_name:       dragon?.player_name || getAccountLabel(initAccountId),
    // Location
    location:         dragon?.location          || null,
    notes:            dragon?.notes            || '',
    is_hungry:        dragon?.is_hungry        || false,
    // Mate / Harem
    mate_id:          dragon?.mate_id          || '',
    harem:            dragon?.harem            || [],
    ...initStats,
    ...initRStats,
  })
  const [showRStats, setShowRStats] = useState(
    ALL_RSTAT_KEYS.some(k => !!dragon?.[k])
  )
  const [showOCR, setShowOCR] = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [locationMode,  setLocationMode]  = useState('preset')
  const [confirmLeave,  setConfirmLeave]  = useState(false)   // click-off warning
  const [confirmKill,   setConfirmKill]   = useState(null)    // { dragon } set-as-dead confirmation
  const isDirtyRef = useRef(false)

  const availableSkins = form.species ? getSkinsForSpecies(form.species) : []

  function set(key, val) {
    isDirtyRef.current = true
    setForm(f => {
      const next = { ...f, [key]: val }
      // When account changes, sync player_name to the account label (Steam handle)
      if (key === 'account_id') {
        next.player_name = getAccountLabel(val)
      }
      if (key === 'species') {
        // Clear parents if species changed
        const ownFather = allDragons.find(d => d.id === f.father_id)
        const ownMother = allDragons.find(d => d.id === f.mother_id)
        const clanFather = clanDragons.find(d => d.id === f.father_id)
        const clanMother = clanDragons.find(d => d.id === f.mother_id)
        if ((ownFather || clanFather) && (ownFather || clanFather).species !== val) next.father_id = ''
        if ((ownMother || clanMother) && (ownMother || clanMother).species !== val) next.mother_id = ''
        const newSkins = getSkinsForSpecies(val)
        if (f.skin_dominant && !newSkins.includes(f.skin_dominant)) next.skin_dominant = ''
        if (f.skin_recessive && !newSkins.includes(f.skin_recessive)) next.skin_recessive = ''
      }
      if (key === 'growth') {
        const derived = ticksFromGrowth(val)
        if (derived !== null) next.ticks = Math.round(derived * 100)
        next.is_elder = val === 'Elder' ? 1 : 0
      }
      return next
    })
  }

  function setLocation(loc) {
    setForm(f => ({ ...f, location: loc }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.species) return
    setSaving(true)
    try {
      const data = {
        ...form,
        ticks:    form.ticks !== '' ? parseFloat(form.ticks) / 100 : 0,
        is_elder: form.growth === 'Elder' ? 1 : 0,
      }
      const strFields = ['name','species','gender','skin_dominant','skin_recessive','growth','clan_role','bloodline_quality','purity','notes','player_name']
      strFields.forEach(k => { if (!data[k]) data[k] = '' })
      const nullFields = ['father_id','mother_id','mate_id']
      nullFields.forEach(k => { if (data[k] === '') data[k] = null })
      if (!Array.isArray(data.harem)) data.harem = []
      isDirtyRef.current = false
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  function handleOverlayClick(e) {
    if (e.target !== e.currentTarget) return
    if (isDirtyRef.current) {
      setConfirmLeave(true)
    } else {
      onClose()
    }
  }

  // ── Lineage parent candidates ──
  // Own dragons (full info) + clan dragons of same species (limited info, no stats)
  const myIds = new Set(allDragons.map(d => d.id))

  const potentialParents = (() => {
    if (!form.species) return []
    // Own same-species dragons (excluding self)
    const own = allDragons.filter(d => {
      if (dragon && d.id === dragon.id) return false
      return d.species === form.species
    }).map(d => ({
      id:     d.id,
      label:  `${d.species} ${d.gender === 'M' ? '♂' : d.gender === 'F' ? '♀' : '?'} — ${d.player_name || 'Yours'}${d.is_dead ? ' 💀' : ''}`,
      gender: d.gender,
      mine:   true,
    }))

    // Clan dragons of same species (other members only, no stats shown)
    const clan = clanDragons.filter(d => {
      if (dragon && d.id === dragon.id) return false
      if (myIds.has(d.id)) return false  // already in own list
      return d.species === form.species
    }).map(d => ({
      id:     d.id,
      label:  `${d.ownerUsername}'s ${d.species} ${d.gender === 'M' ? '♂' : d.gender === 'F' ? '♀' : '?'}${d.is_dead ? ' 💀' : ''}`,
      gender: d.gender,
      mine:   false,
    }))

    return [...own, ...clan]
  })()

  const fathers = potentialParents.filter(d => d.gender === 'M' || !d.gender)
  const mothers = potentialParents.filter(d => d.gender === 'F' || !d.gender)

  const totalTraitPts = TRAIT_KEYS.reduce((s, k) => s + (parseInt(form[`trait_${k}`]) || 0), 0)

  // Location display
  const locPreset = MAP_LOCATIONS.find(l => l.id === form.location?.id)

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>

      {/* ── Leave confirmation ── */}
      {confirmLeave && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center' }}
             onClick={e => e.stopPropagation()}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'24px 28px', maxWidth:360, width:'90%', boxShadow:'0 16px 48px rgba(0,0,0,0.6)', textAlign:'center' }}>
            <div style={{ fontSize:26, marginBottom:10 }}>⚠️</div>
            <h3 style={{ margin:'0 0 8px', fontSize:15 }}>Discard changes?</h3>
            <p style={{ margin:'0 0 18px', color:'var(--muted)', fontSize:12, lineHeight:1.6 }}>
              You have unsaved changes. Are you sure you want to leave? Your progress will be lost.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmLeave(false)}>No, stay</button>
              <button className="btn btn-primary" style={{ background:'#c44a4a', borderColor:'#c44a4a' }}
                      onClick={() => { setConfirmLeave(false); onClose() }}>
                Yes, discard
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={`cinzel ${styles.title}`}>{isEdit ? 'Edit Dragon' : 'Add Dragon'}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.body}>

            {/* ── Account (Steam handle = dragon name) ── */}
            <FormSection title="Account">
              <div className="form-group" style={{ maxWidth: 320 }}>
                <label>Steam Handle <span className={styles.labelHint}>(this becomes the dragon's name in the registry)</span></label>
                {userAccounts.length > 1 ? (
                  <select value={form.account_id} onChange={e => set('account_id', e.target.value)}>
                    {userAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                ) : (
                  <input readOnly value={getAccountLabel(form.account_id)} style={{ opacity: 0.7 }} />
                )}
                <span className={styles.labelHint} style={{ display: 'block', marginTop: 4 }}>
                  Owner shown in registry: <b>{user?.username || '—'}</b>
                </span>
              </div>
            </FormSection>

            {/* ── Identity ── */}
            <FormSection title="Identity">
              <div className={styles.grid2}>
                {/* Name field */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Dragon Name <span className={styles.labelHint}>(optional — shown between owner and species in registry)</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Ash, Ember, Void…"
                  />
                </div>
                <div className="form-group">
                  <label>Species *</label>
                  <select value={form.species} onChange={e => set('species', e.target.value)} required>
                    <option value="">Select species</option>
                    {SPECIES_LIST.map(s => (
                      <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  {/* Use plain text labels so browser key-navigation works (emoji breaks it) */}
                  <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Unknown</option>
                    {GENDERS.map(g => <option key={g.value} value={g.value}>{g.searchKey}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Growth Stage</label>
                  <select value={form.growth} onChange={e => set('growth', e.target.value)}>
                    <option value="">Select growth</option>
                    {GROWTH_STAGES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Clan Role</label>
                  <select
                    value={form.clan_role}
                    onChange={e => set('clan_role', e.target.value)}
                    title={!userIsAdmin && form.clan_role === 'Breeder' ? 'Breeder role is managed by Admins/Devs' : undefined}
                  >
                    <option value="">None</option>
                    {CLAN_ROLES.filter(r => r !== 'Breeder' || userIsAdmin).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    {/* If dragon already has Breeder role and user is not admin, show it read-only */}
                    {!userIsAdmin && form.clan_role === 'Breeder' && (
                      <option value="Breeder" disabled>Breeder (Admin only)</option>
                    )}
                  </select>
                  {!userIsAdmin && form.clan_role !== 'Breeder' && (
                    <p style={{ fontSize: 11, color: 'var(--hint)', marginTop: 4 }}>
                      🔒 Breeder role is assigned by Admins/Devs
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label>Bloodline Quality</label>
                  <select value={form.bloodline_quality} onChange={e => set('bloodline_quality', e.target.value)}>
                    <option value="">—</option>
                    {BLOODLINE_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Skin Purity</label>
                  <select value={form.purity} onChange={e => set('purity', e.target.value)}>
                    <option value="">—</option>
                    <option value="Pure">Pure</option>
                    <option value="U.P.">U.P. (Ultra Pure)</option>
                    <option value="Impure">Impure</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
                  <input
                    type="checkbox"
                    id="hungryChk"
                    checked={!!form.is_hungry}
                    onChange={e => set('is_hungry', e.target.checked)}
                    style={{ width: 24, height: 24, cursor: 'pointer', flexShrink: 0, accentColor: 'var(--accent)' }}
                  />
                  <label htmlFor="hungryChk" style={{ cursor: 'pointer', fontSize: 14, userSelect: 'none' }}>
                    🍖 Hungry
                  </label>
                </div>
              </div>
            </FormSection>

            {/* ── Location ── */}
            <FormSection title="Location">
              <div className={styles.locationRow}>
                <select
                  value={form.location?.id || ''}
                  onChange={e => {
                    const val = e.target.value
                    if (!val) { setLocation(null); return }
                    if (val === 'custom') { setLocation({ id: 'custom', label: 'Custom', x: 0.5, y: 0.5 }); return }
                    if (val.startsWith('nest-')) {
                      const spot = nestingSpots.find(s => `nest-${s.id}` === val)
                      if (spot) setLocation({ id: 'custom', label: spot.name, x: spot.x, y: spot.y, isNest: true, spotName: spot.name })
                      return
                    }
                    const loc = MAP_LOCATIONS.find(l => l.id === val)
                    if (loc?.x != null) setLocation({ id: loc.id, label: loc.label, x: loc.x, y: loc.y })
                  }}
                  className={styles.locationSelect}
                >
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
                {form.location?.id === 'custom' && (() => {
                  // Decompose stored frac → abs + direction
                  const x = form.location?.x ?? 0.5
                  const y = form.location?.y ?? 0.5
                  const ewAbs = Math.round(Math.abs((x - 0.5) * 1600))
                  const nsAbs = Math.round(Math.abs((0.5 - y) * 1600))
                  const ewDir = x >= 0.5 ? 'E' : 'W'
                  const nsDir = y <= 0.5 ? 'N' : 'S'

                  function updateCoord(newNsAbs, newNsDir, newEwAbs, newEwDir) {
                    const ns = newNsDir === 'N' ? newNsAbs : -newNsAbs
                    const ew = newEwDir === 'E' ? newEwAbs : -newEwAbs
                    setLocation({
                      ...form.location,
                      x: Math.max(0, Math.min(1, ew / 1600 + 0.5)),
                      y: Math.max(0, Math.min(1, 0.5 - ns / 1600)),
                    })
                  }

                  return (
                    <div className={styles.coordsRow} style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="number" min="0" max="800" step="1"
                          value={nsAbs}
                          onChange={e => updateCoord(parseInt(e.target.value)||0, nsDir, ewAbs, ewDir)}
                          style={{ width: 65 }}
                          placeholder="0"
                        />
                        <select value={nsDir} onChange={e => updateCoord(nsAbs, e.target.value, ewAbs, ewDir)} style={{ width: 54 }}>
                          <option value="N">N</option>
                          <option value="S">S</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="number" min="0" max="800" step="1"
                          value={ewAbs}
                          onChange={e => updateCoord(nsAbs, nsDir, parseInt(e.target.value)||0, ewDir)}
                          style={{ width: 65 }}
                          placeholder="0"
                        />
                        <select value={ewDir} onChange={e => updateCoord(nsAbs, nsDir, ewAbs, e.target.value)} style={{ width: 54 }}>
                          <option value="E">E</option>
                          <option value="W">W</option>
                        </select>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                        📍 {nsAbs}{nsDir} {ewAbs}{ewDir}
                      </span>
                    </div>
                  )
                })()}

                {/* Nesting spot — admin only, shown when custom coords selected */}
                {userIsAdmin && form.location?.id === 'custom' && (
                  <div style={{ marginTop: 10, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Spot name <span style={{ color: 'var(--hint)', fontSize: 11 }}>(required to share as nesting spot)</span></label>
                      <input
                        value={form.location?.spotName || ''}
                        onChange={e => setLocation({ ...form.location, spotName: e.target.value })}
                        placeholder="e.g. Brood Nest"
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        id="formIsNestChk"
                        checked={!!form.location?.isNest}
                        onChange={e => setLocation({ ...form.location, isNest: e.target.checked })}
                        style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <label htmlFor="formIsNestChk" style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                        🥚 Save as shared nesting spot (visible to all admins)
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </FormSection>

            {/* ── Skins ── */}
            <FormSection title="Skin">
              {!form.species && <p className={styles.lineageHint}>Select a species first to see available skins.</p>}
              <div className={styles.grid2}>
                <div className="form-group">
                  <label>Dominant Skin</label>
                  <select value={form.skin_dominant} onChange={e => set('skin_dominant', e.target.value)}>
                    <option value="">— None —</option>
                    {availableSkins.map(s => (
                      <option key={s} value={s} style={{ color: SKIN_COLORS[s] || 'inherit' }}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Recessive Skin</label>
                  <select value={form.skin_recessive} onChange={e => set('skin_recessive', e.target.value)}>
                    <option value="">— None —</option>
                    {availableSkins.map(s => (
                      <option key={s} value={s} style={{ color: SKIN_COLORS[s] || 'inherit' }}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>

            {/* ── Traits ── */}
            <FormSection title="Traits">
              <p className={styles.lineageHint}>
                Up to 7 mutation points across 3 traits. Level 4 (evolved) auto-detected from recessive stats.
                <span className={styles.traitTotal} style={{ color: totalTraitPts > 7 ? '#e05a5a' : 'var(--muted)' }}>
                  {' '}{totalTraitPts}/7 pts
                </span>
              </p>
              <div className={styles.grid3}>
                {TRAIT_KEYS.map(key => {
                  const def = TRAIT_DEFS[key]
                  const val = parseInt(form[`trait_${key}`]) || 0
                  return (
                    <div key={key} className="form-group">
                      <label>{def.icon} {def.label}</label>
                      <select value={val} onChange={e => set(`trait_${key}`, parseInt(e.target.value))}>
                        <option value={0}>— None</option>
                        <option value={1}>1 pt — {def.levelNames[1]}</option>
                        <option value={2}>2 pts — {def.levelNames[2]}</option>
                        <option value={3}>3 pts — {def.levelNames[3]}</option>
                        <option value={4}>4 pts — {def.levelNames[4]}</option>
                      </select>
                    </div>
                  )
                })}
              </div>
            </FormSection>

            {/* ── Stats ── */}
            <FormSection title="Stats">
              <div className={styles.statGrid2Col}>
                <div className={styles.statCol}>
                  <div className={styles.statColHeader}>Body</div>
                  {STAT_GROUPS.body.stats.map(({ key, label }) => (
                    <div key={key} className={`form-group ${styles.statRow}`}>
                      <label>{label}</label>
                      <select value={form[key]} onChange={e => set(key, e.target.value)}>
                        <option value="">—</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className={styles.statCol}>
                  <div className={styles.statColHeader}>Resistances</div>
                  {STAT_GROUPS.resistances.stats.map(({ key, label }) => (
                    <div key={key} className={`form-group ${styles.statRow}`}>
                      <label>{label}</label>
                      <select value={form[key]} onChange={e => set(key, e.target.value)}>
                        <option value="">—</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </FormSection>

            <FormSection title={
              <button type="button" className={styles.rstatToggle} onClick={() => setShowRStats(s => !s)}>
                {showRStats ? '▾' : '▸'} Recessive Stats
                {ALL_RSTAT_KEYS.some(k => form[k]) && <span className={styles.rstatBadge}>filled</span>}
              </button>
            }>
              {showRStats && (
                <div className={styles.statGrid2Col}>
                  <div className={styles.statCol}>
                    <div className={styles.statColHeader}>Body (Recessive)</div>
                    {STAT_GROUPS.body.stats.map(({ key, label }) => {
                      const rkey = `r_${key}`
                      return (
                        <div key={rkey} className={`form-group ${styles.statRow}`}>
                          <label>{label}</label>
                          <select value={form[rkey]} onChange={e => set(rkey, e.target.value)}>
                            <option value="">—</option>
                            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                  <div className={styles.statCol}>
                    <div className={styles.statColHeader}>Resistances (Recessive)</div>
                    {STAT_GROUPS.resistances.stats.map(({ key, label }) => {
                      const rkey = `r_${key}`
                      return (
                        <div key={rkey} className={`form-group ${styles.statRow}`}>
                          <label>{label}</label>
                          <select value={form[rkey]} onChange={e => set(rkey, e.target.value)}>
                            <option value="">—</option>
                            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </FormSection>

            {/* ── Progression ── */}
            <FormSection title="Progression">
              {(() => {
                // Import elder data inline to show species context
                const ELDER_TICKS = { ASD:49, BIO:49, BS:75, SS:80, FS:110, IR:110, BW:181 }
                const maxTicks = ELDER_TICKS[form.species] || null
                // Convert stored 0-1 fraction back to raw ticks for display
                const rawTicksDisplay = maxTicks && form.ticks !== ''
                  ? (parseFloat(String(form.ticks).replace(',','.')) / 100 * maxTicks).toFixed(1)
                  : ''
                return (
                  <div className={styles.ticksInputRow}>
                    <div className="form-group">
                      <label>
                        Elder Ticks
                        {maxTicks && <span className={styles.tickHint}> (/ {maxTicks} total for {form.species})</span>}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.ticksRaw ?? ''}
                        onChange={e => {
                          const raw = e.target.value.replace(',', '.')
                          set('ticksRaw', e.target.value)  // preserve display value with comma
                          const num = parseFloat(raw)
                          if (!isNaN(num) && maxTicks) {
                            // Convert raw tick count → % for storage
                            set('ticks', Math.min(100, (num / maxTicks * 100)).toFixed(2))
                          } else if (!isNaN(num)) {
                            set('ticks', Math.min(100, num).toFixed(2))
                          }
                        }}
                        placeholder={maxTicks ? `e.g. 33,3 of ${maxTicks}` : '0'}
                        disabled={form.growth === 'Elder' || form.growth === 'Hatchling' || form.growth === 'Juvenile'}
                      />
                      {form.growth === 'Elder'    && <span className={styles.tickHint}>Auto: {maxTicks || 100} ticks (100%)</span>}
                      {(form.growth === 'Hatchling' || form.growth === 'Juvenile') && <span className={styles.tickHint}>Auto: 0 ticks</span>}
                    </div>
                    <div className="form-group">
                      <label>% Progress</label>
                      <input
                        type="number" step="0.1" min="0" max="100"
                        value={form.ticks}
                        onChange={e => {
                          set('ticks', e.target.value)
                          const pct = parseFloat(e.target.value)
                          if (!isNaN(pct) && maxTicks) {
                            set('ticksRaw', (pct / 100 * maxTicks).toFixed(1))
                          }
                        }}
                        placeholder="0"
                        disabled={form.growth === 'Elder' || form.growth === 'Hatchling' || form.growth === 'Juvenile'}
                      />
                      {form.ticks !== '' && <span className={styles.tickHint}>{parseFloat(form.ticks).toFixed(1)}%</span>}
                    </div>
                  </div>
                )
              })()}
            </FormSection>

            {/* ── Mate / Harem ── */}
            <FormSection title="Mate & Harem">
              <p className={styles.lineageHint}>
                Primary mate is bidirectional — both dragons will show each other as mates.
                Harem is a personal reference list of approved nesting partners (no shared direct parents).
              </p>

              {(() => {
                // All living clan dragons excluding self
                const allLiving = [
                  ...allDragons,
                  ...clanDragons.filter(d => !allDragons.find(od => od.id === d.id))
                ].filter(d => !d.is_dead && (dragon ? d.id !== dragon.id : true))

                // Helper: shares a direct parent with current dragon
                function sharesParent(candidate) {
                  if (!form.father_id && !form.mother_id) return false
                  if (form.father_id && (candidate.father_id === form.father_id || candidate.mother_id === form.father_id)) return true
                  if (form.mother_id && (candidate.father_id === form.mother_id || candidate.mother_id === form.mother_id)) return true
                  return false
                }

                // Compatible mates: same species, opposite gender, no shared parents
                const currentSpecies = form.species
                const currentGender  = form.gender
                const oppositeGender = currentGender === 'M' ? 'F' : currentGender === 'F' ? 'M' : null

                const compatibleMates = allLiving.filter(d => {
                  if (currentSpecies && d.species !== currentSpecies) return false
                  if (oppositeGender && d.gender !== oppositeGender) return false
                  if (sharesParent(d)) return false
                  return true
                })

                // Warn if mate_id set to different species
                const selectedMate = allLiving.find(d => d.id === form.mate_id)
                const mateSpeciesMismatch = selectedMate && form.species && selectedMate.species !== form.species

                // Harem candidates: same species, OPPOSITE gender, no shared parents
                const haremCandidates = allLiving.filter(d => {
                  if (currentSpecies && d.species !== currentSpecies) return false
                  // Exclude same gender — dragons only bond with opposite gender
                  if (currentGender && d.gender === currentGender) return false
                  return true
                })

                return (
                  <>
                    {/* Primary mate */}
                    <div className="form-group">
                      <label>Primary Mate</label>
                      {mateSpeciesMismatch && (
                        <p style={{ color:'#e05a5a', fontSize:11, margin:'2px 0 4px' }}>
                          ⚠ Selected mate is a different species ({selectedMate.species}). Inter-species mating is not supported.
                        </p>
                      )}
                      <select
                        value={form.mate_id}
                        onChange={e => set('mate_id', e.target.value)}
                        style={{ borderColor: mateSpeciesMismatch ? '#e05a5a' : undefined }}
                      >
                        <option value="">— None —</option>
                        {compatibleMates.length === 0 && !form.mate_id && (
                          <option disabled value="">No compatible dragons found</option>
                        )}
                        {/* Show compatible first */}
                        {compatibleMates.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name ? `${d.name} — ` : ''}{d.ownerUsername || d.player_name || '?'} · {d.species} {d.gender === 'M' ? '♂' : d.gender === 'F' ? '♀' : ''}
                          </option>
                        ))}
                        {/* If editing and current mate isn't in compatible list, still show it */}
                        {form.mate_id && !compatibleMates.find(d => d.id === form.mate_id) && selectedMate && (
                          <option value={selectedMate.id}>
                            ⚠ {selectedMate.name ? `${selectedMate.name} — ` : ''}{selectedMate.ownerUsername || selectedMate.player_name} · {selectedMate.species}
                          </option>
                        )}
                      </select>
                      {!currentSpecies && (
                        <span className={styles.tickHint}>Select a species first to filter compatible mates</span>
                      )}
                    </div>

                    {/* Harem — custom Ctrl+click multi-select cards */}
                    <div className="form-group" style={{ marginTop: 8 }}>
                      <label>
                        Harem
                        <span style={{ fontWeight:400, color:'var(--muted)', fontSize:11, marginLeft:6 }}>
                          click to toggle · {form.harem.length} selected
                        </span>
                      </label>
                      {haremCandidates.length === 0 ? (
                        <p className={styles.lineageHint}>No candidates — add more dragons of the same species first.</p>
                      ) : (
                        <div className={styles.haremGrid}>
                          {haremCandidates.map(d => {
                            const selected = form.harem.includes(d.id)
                            const shared   = sharesParent(d)
                            return (
                              <button
                                key={d.id}
                                type="button"
                                className={`${styles.haremCard} ${selected ? styles.haremSelected : ''} ${shared ? styles.haremSharedParent : ''}`}
                                onClick={() => {
                                  set('harem', selected
                                    ? form.harem.filter(id => id !== d.id)
                                    : [...form.harem, d.id]
                                  )
                                }}
                                title={shared ? 'Shares a direct parent — not recommended' : undefined}
                              >
                                <span className={styles.haremGender} style={{ color: d.gender === 'M' ? '#4da6ff' : '#e05a5a' }}>
                                  {d.gender === 'M' ? '♂' : d.gender === 'F' ? '♀' : '?'}
                                </span>
                                <span className={styles.haremName}>
                                  {d.name || d.ownerUsername || d.player_name || '?'}
                                </span>
                                {d.name && <span className={styles.haremSub}>{d.ownerUsername || d.player_name}</span>}
                                {shared && <span className={styles.haremWarn}>⚠</span>}
                                {selected && <span className={styles.haremCheck}>✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </FormSection>

            {/* ── Lineage (parents from own + clan) ── */}
            <FormSection title="Lineage">
              {form.species
                ? <p className={styles.lineageHint}>Showing own {form.species} dragons + clan members' dragons (no stats visible for others).</p>
                : <p className={styles.lineageHint}>Select a species first.</p>
              }
              <div className={styles.grid2}>
                <div className="form-group">
                  <label>Father</label>
                  <select value={form.father_id} onChange={e => set('father_id', e.target.value)}>
                    <option value="">— None —</option>
                    {fathers.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Mother</label>
                  <select value={form.mother_id} onChange={e => set('mother_id', e.target.value)}>
                    <option value="">— None —</option>
                    {mothers.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>

            {/* ── Family Tree Names (OCR — collapsible) ── */}
            <FormSection title={
              <button type="button" className={styles.rstatToggle} onClick={() => setShowOCR(s => !s)}>
                {showOCR ? '▾' : '▸'} OCR Raw Names
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, marginLeft: 4 }}>
                  (auto-filled by F8 capture)
                </span>
              </button>
            }>
              {showOCR && (
                <div className={styles.grid2}>
                  <div className="form-group"><label>Father Name</label><input value={form.father_name} onChange={e => set('father_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                  <div className="form-group"><label>Mother Name</label><input value={form.mother_name} onChange={e => set('mother_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                  <div className="form-group"><label>Grandfather (paternal)</label><input value={form.grandfather1_name} onChange={e => set('grandfather1_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                  <div className="form-group"><label>Grandfather (maternal)</label><input value={form.grandfather2_name} onChange={e => set('grandfather2_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                  <div className="form-group"><label>Grandmother (paternal)</label><input value={form.grandmother1_name} onChange={e => set('grandmother1_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                  <div className="form-group"><label>Grandmother (maternal)</label><input value={form.grandmother2_name} onChange={e => set('grandmother2_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                </div>
              )}
            </FormSection>

            {/* ── Notes ── */}
            <FormSection title="Notes">
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any notes…" />
            </FormSection>
          </div>

          <div className={styles.footer}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.species}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Dragon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormSection({ title, children }) {
  return (
    <div className={styles.section}>
      <h3 className={`cinzel ${styles.sectionTitle}`}>{title}</h3>
      {children}
    </div>
  )
}
