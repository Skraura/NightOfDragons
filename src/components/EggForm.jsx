/**
 * EggForm.jsx — Beta1.3
 * Add Egg popup — like DragonForm but simplified:
 *   - No growth stage (it's an egg)
 *   - No elder ticks
 *   - No traits
 *   - "Keeper" instead of "Owner" (which account currently holds the egg)
 *   - Species, Gender, Skins, Notes still present
 *   - Saves with is_egg: true, growth: 'Egg'
 */
import { useState } from 'react'
import { SPECIES_LIST, GENDERS, getSkinsForSpecies } from '../lib/dragonData'
import { useApp } from '../App'
import { isAdmin } from '../lib/roleUtils'
import styles from './EggForm.module.css'

export default function EggForm({ egg = null, allUsers = [], onSave, onClose }) {
  const { user } = useApp()
  const userIsAdmin = isAdmin(user)
  const isEditing = !!egg

  // If admin, can choose any user's account as keeper
  const [keeperUserId, setKeeperUserId] = useState(egg?.user_id || user.id)
  const keeperUser = allUsers.find(u => u.id === keeperUserId) || user
  const keeperAccounts = keeperUser?.accounts || [{ id: keeperUser?.id, label: keeperUser?.username || keeperUser?.displayName }]

  const [form, setForm] = useState({
    species:          egg?.species          || '',
    gender:           egg?.gender           || '',
    skin_dominant:    egg?.skin_dominant    || '',
    skin_recessive:   egg?.skin_recessive   || '',
    account_id:       egg?.account_id       || keeperAccounts[0]?.id || '',
    player_name:      egg?.player_name      || keeperAccounts[0]?.label || '',
    notes:            egg?.notes            || '',
  })

  const [confirmClose, setConfirmClose] = useState(false)

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function handleKeeperUserChange(uid) {
    setKeeperUserId(uid)
    const u = allUsers.find(u => u.id === uid) || user
    const accs = u?.accounts || [{ id: u?.id, label: u?.username || u?.displayName }]
    set('account_id', accs[0]?.id || '')
    set('player_name', accs[0]?.label || '')
  }

  function handleKeeperAccountChange(accId) {
    set('account_id', accId)
    const accs = keeperUser?.accounts || [{ id: keeperUser?.id, label: keeperUser?.username }]
    const label = accs.find(a => a.id === accId)?.label || ''
    set('player_name', label)
  }

  function handleSubmit() {
    if (!form.species) return
    onSave({
      ...form,
      is_egg:    true,
      growth:    'Egg',
      ticks:     0,
      is_elder:  0,
      clan_role: '',
      user_id:   keeperUserId,
    })
  }

  const skins = form.species ? getSkinsForSpecies(form.species) : []

  return (
    <div className={styles.overlay} onClick={() => setConfirmClose(true)}>
      <div className={styles.modal} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={`cinzel ${styles.modalTitle}`}>{isEditing ? '🥚 Edit Egg' : '🥚 Add Egg'}</h2>
            <p className={styles.modalSub}>{isEditing ? 'Update this egg\'s details' : 'Register a new egg — no growth stage or traits yet'}</p>
          </div>
          <button className={styles.closeBtn} onClick={() => setConfirmClose(true)}>✕</button>
        </div>

        <div className={styles.formBody}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Keeper</h3>
            <p className={styles.sectionHint}>Which account currently holds this egg?</p>
            {userIsAdmin && allUsers.length > 0 && (
              <div className="form-group">
                <label>Member</label>
                <select value={keeperUserId} onChange={e => handleKeeperUserChange(e.target.value)}>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.displayName || u.username || u.email}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Keeper Account (Steam Handle)</label>
              <select
                value={form.account_id}
                onChange={e => handleKeeperAccountChange(e.target.value)}
              >
                {keeperAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Identity</h3>
            <div className={styles.twoCol}>
              <div className="form-group">
                <label>Species <span className={styles.req}>*</span></label>
                <select value={form.species} onChange={e => set('species', e.target.value)} required>
                  <option value="">Select species…</option>
                  {SPECIES_LIST.map(s => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
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
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Skins</h3>
            <div className={styles.twoCol}>
              <div className="form-group">
                <label>Dominant Skin</label>
                <input
                  list="egg-skins-list"
                  value={form.skin_dominant}
                  onChange={e => set('skin_dominant', e.target.value)}
                  placeholder="e.g. Crimson"
                />
              </div>
              <div className="form-group">
                <label>Recessive Skin</label>
                <input
                  list="egg-skins-list"
                  value={form.skin_recessive}
                  onChange={e => set('skin_recessive', e.target.value)}
                  placeholder="e.g. Albino"
                />
              </div>
            </div>
            <datalist id="egg-skins-list">
              {skins.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Notes</h3>
            <div className="form-group">
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Lineage notes, expected hatch date, etc."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        <div className={styles.formFooter}>
          <button className="btn btn-ghost" onClick={() => setConfirmClose(true)}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!form.species}
          >
            {isEditing ? '💾 Save Egg' : '🥚 Add Egg'}
          </button>
        </div>

        {confirmClose && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmBox}>
              <p>Discard this egg?</p>
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmClose(false)}>Keep editing</button>
                <button className="btn btn-primary btn-sm" onClick={onClose}>Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
