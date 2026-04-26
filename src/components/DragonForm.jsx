/**
 * DragonForm.jsx — v6.1
 *
 * Changes from v6.0:
 *  - Name field REMOVED (was optional, now gone entirely)
 *  - Account selector added (which Steam handle owns this dragon)
 *  - Location picker added (known place or custom coords)
 *  - Lineage dropdowns show ALL clan dragons of same species:
 *      - Own dragons: show full info
 *      - Other members' dragons: show "Owner's gender species" (no stats/skins leaked)
 *  - Dead dragons still selectable as parents (shown with 💀 prefix)
 */

import { useState } from 'react'
import {
  SPECIES_LIST, GROWTH_STAGES, CLAN_ROLES, GENDERS, GRADES, BLOODLINE_GRADES,
  ALL_STAT_KEYS, STAT_GROUPS,
  TRAIT_KEYS, TRAIT_DEFS, TRAIT_POINTS,
  getSkinsForSpecies, SKIN_COLORS,
  ticksFromGrowth,
  MAP_LOCATIONS,
} from '../lib/dragonData'
import { useApp } from '../App'
import styles from './DragonForm.module.css'

export default function DragonForm({ dragon, allDragons, clanDragons = [], nestingSpots = [], onSave, onClose }) {
  const { user } = useApp()
  const isAdmin = !!user?.isAdmin
  const isEdit = !!dragon

  // User's own accounts (Steam handles)
  const userAccounts = user?.accounts || [{ id: user?.id, label: user?.username }]
  const getAccountLabel = (id) => userAccounts.find(a => a.id === id)?.label || user?.username || ''

  const initStats = ALL_STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: dragon?.[k] || '' }), {})
  const initAccountId = dragon?.account_id || userAccounts[0]?.id || ''

  const [form, setForm] = useState({
    account_id:       initAccountId,
    species:          dragon?.species          || '',
    gender:           dragon?.gender           || '',
    skin_dominant:    dragon?.skin_dominant    || '',
    skin_recessive:   dragon?.skin_recessive   || '',
    growth:           dragon?.growth           || '',
    clan_role:        dragon?.clan_role        || '',
    ticks:            dragon?.ticks            ?? '',
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
    ...initStats,
  })
  const [saving,        setSaving]        = useState(false)
  const [locationMode,  setLocationMode]  = useState('preset') // 'preset' | 'custom'

  const availableSkins = form.species ? getSkinsForSpecies(form.species) : []

  function set(key, val) {
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
        if (derived !== null) next.ticks = derived
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
        ticks:    form.ticks !== '' ? parseFloat(form.ticks) : 0,
        is_elder: form.growth === 'Elder' ? 1 : 0,
      }
      const strFields = ['species','gender','skin_dominant','skin_recessive','growth','clan_role','bloodline_quality','purity','notes','player_name']
      strFields.forEach(k => { if (!data[k]) data[k] = '' })
      const nullFields = ['father_id','mother_id']
      nullFields.forEach(k => { if (data[k] === '') data[k] = null })
      await onSave(data)
    } finally {
      setSaving(false)
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
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
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
                  <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Unknown</option>
                    {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
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
                  <select value={form.clan_role} onChange={e => set('clan_role', e.target.value)}>
                    <option value="">None</option>
                    {CLAN_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Bloodline Quality</label>
                  <select value={form.bloodline_quality} onChange={e => set('bloodline_quality', e.target.value)}>
                    <option value="">—</option>
                    {BLOODLINE_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Purity</label>
                  <select value={form.purity} onChange={e => set('purity', e.target.value)}>
                    <option value="">—</option>
                    <option value="Pure">Pure</option>
                    <option value="U.P.">U.P. (Ultra Pure)</option>
                    <option value="Impure">Impure</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                  <input
                    type="checkbox"
                    id="hungryChk"
                    checked={!!form.is_hungry}
                    onChange={e => set('is_hungry', e.target.checked)}
                  />
                  <label htmlFor="hungryChk" style={{ cursor: 'pointer', fontSize: 13 }}>
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
                  {isAdmin && nestingSpots.length > 0 && (
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
                  const ewAbs = Math.round(Math.abs((x - 0.5) * 200))
                  const nsAbs = Math.round(Math.abs((0.5 - y) * 200))
                  const ewDir = x >= 0.5 ? 'E' : 'W'
                  const nsDir = y <= 0.5 ? 'N' : 'S'

                  function updateCoord(newNsAbs, newNsDir, newEwAbs, newEwDir) {
                    const ns = newNsDir === 'N' ? newNsAbs : -newNsAbs
                    const ew = newEwDir === 'E' ? newEwAbs : -newEwAbs
                    setLocation({
                      ...form.location,
                      x: Math.max(0, Math.min(1, ew / 200 + 0.5)),
                      y: Math.max(0, Math.min(1, 0.5 - ns / 200)),
                    })
                  }

                  return (
                    <div className={styles.coordsRow} style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="number" min="0" step="1"
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
                          type="number" min="0" step="1"
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
                {isAdmin && form.location?.id === 'custom' && (
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
                        <option value={1}>1 pt</option>
                        <option value={2}>2 pts</option>
                        <option value={3}>3 pts</option>
                        <option value={4}>4 pts — {def.evolved}</option>
                      </select>
                    </div>
                  )
                })}
              </div>
            </FormSection>

            {/* ── Stats ── */}
            {Object.entries(STAT_GROUPS).map(([groupKey, group]) => (
              <FormSection key={groupKey} title={`Stats — ${group.label}`}>
                <div className={styles.statGrid}>
                  {group.stats.map(({ key, label }) => (
                    <div key={key} className="form-group">
                      <label>{label}</label>
                      <select value={form[key]} onChange={e => set(key, e.target.value)}>
                        <option value="">—</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </FormSection>
            ))}

            {/* ── Progression ── */}
            <FormSection title="Progression">
              <div className={styles.grid3}>
                <div className="form-group">
                  <label>Ticks (0–1)</label>
                  <input
                    type="number" step="0.01" min="0" max="1"
                    value={form.ticks}
                    onChange={e => set('ticks', e.target.value)}
                    placeholder="0.00"
                    disabled={form.growth === 'Elder' || form.growth === 'Hatchling' || form.growth === 'Juvenile'}
                  />
                  {form.growth === 'Elder'    && <span className={styles.tickHint}>Auto: 100%</span>}
                  {(form.growth === 'Hatchling' || form.growth === 'Juvenile') && <span className={styles.tickHint}>Auto: 0%</span>}
                </div>
              </div>
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

            {/* ── Family Tree Names (OCR fallback) ── */}
            <FormSection title="Family Tree Names">
              <p className={styles.lineageHint}>Auto-filled by OCR on capture. Leave blank if unknown.</p>
              <div className={styles.grid2}>
                <div className="form-group"><label>Father Name</label><input value={form.father_name} onChange={e => set('father_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                <div className="form-group"><label>Mother Name</label><input value={form.mother_name} onChange={e => set('mother_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                <div className="form-group"><label>Grandfather (paternal)</label><input value={form.grandfather1_name} onChange={e => set('grandfather1_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                <div className="form-group"><label>Grandfather (maternal)</label><input value={form.grandfather2_name} onChange={e => set('grandfather2_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                <div className="form-group"><label>Grandmother (paternal)</label><input value={form.grandmother1_name} onChange={e => set('grandmother1_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
                <div className="form-group"><label>Grandmother (maternal)</label><input value={form.grandmother2_name} onChange={e => set('grandmother2_name', e.target.value)} placeholder="UNKNOWN = blank" /></div>
              </div>
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
