import { isAdmin, isDev, canSeeBreederContent } from '../lib/roleUtils'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../App'
import TitleBar from '../components/TitleBar'
import DragonList from '../components/DragonList'
import DragonDetail from '../components/DragonDetail'
import DragonForm from '../components/DragonForm'
import EggForm from '../components/EggForm'
import CrystalTable from '../components/CrystalTable'
import CaptureConfirmModal from '../components/CaptureConfirmModal'
import Sidebar from '../components/Sidebar'
import LineageGraph from '../components/LineageGraph'
import SettingsPage from './SettingsPage'
import NestingCalculator from './NestingCalculator'
import ElderTracker from './ElderTracker'
import TrainingPage from './TrainingPage'
import MapPage from './MapPage'
import AccountDashboard from './AccountDashboard'
import FeedbackPage from './FeedbackPage'
import DevConsolePage from './DevConsolePage'
import styles from './DashboardPage.module.css'
import { MAP_LOCATIONS } from '../lib/dragonData'

export default function DashboardPage({ onLogout }) {
  const { user, addToast, pendingCapture, setPendingCapture } = useApp()
  const [dragons,     setDragons]     = useState([])
  const [clanDragons, setClanDragons] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [view,        setView]        = useState('dragons')
  const [showForm,    setShowForm]    = useState(false)
  const [showEggForm, setShowEggForm] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addBtnRef = useRef(null)
  const [editDragon,  setEditDragon]  = useState(null)
  const [locationTarget, setLocationTarget] = useState(null) // dragon for location change from context menu
  const [filters, setFilters] = useState({
    search: '', species: '', growth: '', clan_role: '', gender: '', elder: '', dead: 'hide'
  })

  const [allUsers,    setAllUsers]    = useState([])
  const [filterUser,  setFilterUser]  = useState('')
  const [registryMode, setRegistryMode] = useState('mine') // 'mine' | 'clan' (admin only)
  const [dashboardMode, setDashboardMode] = useState('mine') // for AccountDashboard
  const [nestingSpots, setNestingSpots] = useState([])
  const loadDragons = useCallback(async () => {
    try {
      const list = await window.api.dragon.getAll({ userId: user.id })
      setDragons(list)
    } catch {
      addToast('Failed to load dragons', 'error')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => { loadDragons() }, [loadDragons])

  useEffect(() => {
    const handler = () => loadDragons()
    window.addEventListener('dragon:refresh', handler)
    return () => window.removeEventListener('dragon:refresh', handler)
  }, [loadDragons])

  // ── Load clan dragons (for lineage parent dropdowns + map) + users list ──
  useEffect(() => {
    if (isAdmin(user)) {
      window.api.dragon.getAllClan?.()
        .then(res => { if (res?.ok) setClanDragons(res.dragons || []) })
        .catch(() => {})
      window.api.auth.listUsers?.()
        .then(users => setAllUsers(users || []))
        .catch(() => {})
      window.api.nestingSpot?.getAll()
        .then(spots => setNestingSpots(spots || []))
        .catch(() => {})
    }
  }, [isAdmin(user)])

  // Dragons to show in registry (own or all clan for admins)
  const registryDragons = (isAdmin(user) && registryMode === 'clan') ? clanDragons : dragons

  const filtered = registryDragons.filter(d => {
    // Dead filter
    if (filters.dead === 'hide' && d.is_dead) return false
    if (filters.dead === 'only' && !d.is_dead) return false
    // User filter (admin clan mode)
    if (filterUser && d.user_id !== filterUser) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!d.species?.toLowerCase().includes(q) &&
          !d.skin_dominant?.toLowerCase().includes(q) &&
          !d.ownerUsername?.toLowerCase().includes(q) &&
          !d.player_name?.toLowerCase().includes(q)) return false
    }
    if (filters.species   && d.species    !== filters.species)    return false
    if (filters.growth    && d.growth     !== filters.growth)      return false
    if (filters.clan_role && d.clan_role  !== filters.clan_role)   return false
    if (filters.gender    && d.gender     !== filters.gender)      return false
    if (filters.elder === 'yes' && d.is_elder !== 1)               return false
    if (filters.elder === 'no'  && d.is_elder === 1)               return false
    return true
  })

  const selectedDragon = registryDragons.find(d => d.id === selected) || null

  // ── Actions ──
  async function handleDelete(id) {
    try {
      await window.api.dragon.delete({ userId: user.id, id })
      setDragons(prev => prev.filter(d => d.id !== id))
      if (selected === id) setSelected(null)
      addToast('Dragon removed', 'success')
    } catch {
      addToast('Failed to delete', 'error')
    }
  }

  async function handleToggleHungry(dragon) {
    try {
      const newVal = !dragon.is_hungry
      // Use the dragon's actual user_id so admins can update any member's dragon
      const targetUserId = dragon.user_id || user.id
      await window.api.dragon.update({ userId: targetUserId, id: dragon.id, data: { is_hungry: newVal } })
      // Refresh whichever list is active
      if (registryMode === 'clan' && isAdmin(user)) {
        const res = await window.api.dragon.getAllClan?.()
        if (res?.ok) setClanDragons(res.dragons || [])
      } else {
        await loadDragons()
      }
      addToast(newVal ? '🍖 Marked as hungry' : '✅ Marked as fed', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  async function handleKill(dragon) {
    if (!window.confirm(`Mark ${dragon.species} ${dragon.gender === 'M' ? '♂' : '♀'} as dead? It will remain in lineage trees with a 💀 marker.`)) return
    try {
      await window.api.dragon.kill({ userId: user.id, id: dragon.id })
      loadDragons()
      addToast('Dragon marked as dead', 'info')
    } catch (err) {
      addToast(err.message || 'Failed', 'error')
    }
  }

  const [killConfirm, setKillConfirm] = useState(null) // { duplicate, pendingData }

  async function handleSave(data) {
    try {
      // ── Duplicate prevention: 1 dragon per species per account ──
      if (!editDragon) {
        const duplicate = dragons.find(d =>
          d.species === data.species &&
          d.account_id === data.account_id &&
          !d.is_dead
        )
        if (duplicate) {
          // Show in-app confirmation instead of toast error
          setKillConfirm({ duplicate, pendingData: data })
          return
        }
      }

      await doSave(data)
    } catch (err) {
      addToast(err.message || 'Save failed', 'error')
    }
  }

  async function handleKillAndCreate() {
    if (!killConfirm) return
    const { duplicate, pendingData } = killConfirm
    setKillConfirm(null)
    try {
      // Mark the duplicate as dead
      await window.api.dragon.kill({ userId: user.id, id: duplicate.id })
      addToast(`${duplicate.name || duplicate.species} marked as dead`, 'info')
      // Now create the new dragon
      await doSave(pendingData)
    } catch (err) {
      addToast(err.message || 'Failed', 'error')
    }
  }

  async function doSave(data) {
    try {
      // Save as shared nesting spot if admin flagged it
      if (isAdmin(user) && data.location?.isNest && data.location?.spotName) {
        try {
          await window.api.nestingSpot?.save({
            name: data.location.spotName,
            x: data.location.x,
            y: data.location.y,
          })
          // Refresh nesting spots list
          window.api.nestingSpot?.getAll?.()
            .then(spots => setNestingSpots(spots || []))
            .catch(() => {})
        } catch (nestErr) {
          console.warn('[nestingSpot] save failed:', nestErr.message)
        }
      }

      if (editDragon) {
        await window.api.dragon.update({ userId: user.id, id: editDragon.id, data })
        if (data.mate_id !== editDragon.mate_id) {
          await window.api.dragon.setMate({ dragonId: editDragon.id, mateId: data.mate_id || null })
        }
        addToast('Dragon updated', 'success')
      } else {
        const res = await window.api.dragon.create({ userId: user.id, data })
        if (data.mate_id && res?.id) {
          await window.api.dragon.setMate({ dragonId: res.id, mateId: data.mate_id })
        }
        addToast('Dragon added', 'success')
      }
      setShowForm(false)
      setEditDragon(null)
      await loadDragons()
      window.dispatchEvent(new CustomEvent('dragon:refresh'))
    } catch (err) {
      addToast(err.message || 'Save failed', 'error')
    }
  }
  async function handleLocationSave(dragon, location) {
    setLocationTarget(null)
    try {
      await window.api.dragon.setLocation({ userId: user.id, id: dragon.id, location })
      loadDragons()
      addToast(location ? 'Location set' : 'Location cleared', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  // ── Tick: add 1 elder tick to a dragon ──
  async function handleTick(dragon) {
    const ELDER_TICKS = { ASD:49, BIO:49, BS:75, SS:80, FS:110, IR:110, BW:181 }
    const maxTicks = ELDER_TICKS[dragon.species]
    if (!maxTicks) return addToast('Unknown species tick data', 'error')
    const TICKS_PER_DAY = { ASD:4, BIO:4, BS:2, SS:2, FS:3, IR:3, BW:4 }
    const tickIncrement = 1 / maxTicks
    const currentTicks = parseFloat(dragon.ticks) || 0
    const newTicks = Math.min(currentTicks + tickIncrement, 1)
    const targetUserId = dragon.user_id || user.id
    try {
      await window.api.dragon.update({ userId: targetUserId, id: dragon.id, data: { ticks: newTicks } })
      if (registryMode === 'clan' && isAdmin(user)) {
        const res = await window.api.dragon.getAllClan?.()
        if (res?.ok) setClanDragons(res.dragons || [])
      } else {
        await loadDragons()
      }
      const pctNow = Math.round(newTicks * 100)
      addToast(`Tick added — ${dragon.species} now at ${pctNow}%`, 'success')
    } catch (err) {
      addToast(err.message || 'Failed to add tick', 'error')
    }
  }

  // ── Give Egg: mark egg as dead for giver, create for receiver ──
  async function handleGiveEgg(egg, { userId: recipientId, accountId, accountLabel }) {
    try {
      // Mark this egg as dead (transferred)
      await window.api.dragon.update({ userId: egg.user_id || user.id, id: egg.id, data: { is_dead: true, notes: `${egg.notes ? egg.notes + ' | ' : ''}Transferred to ${accountLabel}` } })
      // Create a new egg entry for the recipient
      await window.api.dragon.create({
        userId: recipientId,
        data: {
          species:        egg.species,
          gender:         egg.gender,
          skin_dominant:  egg.skin_dominant,
          skin_recessive: egg.skin_recessive,
          notes:          `Received egg${egg.notes ? ': ' + egg.notes : ''}`,
          is_egg:         true,
          growth:         'Egg',
          ticks:          0,
          is_elder:       0,
          account_id:     accountId,
          player_name:    accountLabel,
          user_id:        recipientId,
        }
      })
      await loadDragons()
      window.dispatchEvent(new CustomEvent('dragon:refresh'))
      addToast(`🥚 Egg given to ${accountLabel}`, 'success')
    } catch (err) {
      addToast(err.message || 'Failed to give egg', 'error')
    }
  }

  async function handleSaveEgg(data) {
    try {
      if (editDragon?.is_egg) {
        await window.api.dragon.update({ userId: editDragon.user_id || user.id, id: editDragon.id, data })
        addToast('🥚 Egg updated', 'success')
      } else {
        await window.api.dragon.create({ userId: data.user_id || user.id, data })
        addToast('🥚 Egg added', 'success')
      }
      setShowEggForm(false)
      setEditDragon(null)
      await loadDragons()
      window.dispatchEvent(new CustomEvent('dragon:refresh'))
    } catch (err) {
      addToast(err.message || 'Save failed', 'error')
    }
  }

  async function handleExport() {
    try {
      const res = await window.api.data.export({ userId: user.id })
      if (res.ok) addToast('Registry exported!', 'success')
      else if (!res.canceled) addToast(res.error || 'Export failed', 'error')
    } catch (err) { addToast(err.message, 'error') }
  }

  async function handleImport() {
    try {
      const res = await window.api.data.import({ userId: user.id })
      if (res.ok) { addToast(`Imported ${res.imported} dragons`, 'success'); loadDragons() }
      else if (!res.canceled) addToast(res.error || 'Import failed', 'error')
    } catch (err) { addToast(err.message, 'error') }
  }

  // When map pin is clicked → jump to registry and select that dragon
  function handleMapDragonClick(dragonId) {
    setView('dragons')
    setSelected(dragonId)
  }

  const stats = {
    total:    dragons.length,
    elders:   dragons.filter(d => d.is_elder).length,
    breeders: dragons.filter(d => d.clan_role === 'Breeder').length,
    fighters: dragons.filter(d => d.clan_role === 'Fighter').length,
  }

  return (
    <div className={styles.root}>
      <TitleBar />
      <div className={styles.body}>
        <Sidebar user={user} view={view} onView={setView} onLogout={onLogout} stats={stats} />

        {/* ── View routing ── */}
        {view === 'account-dashboard' && (
          <AccountDashboard
            dragons={dragons}
            clanDragons={clanDragons}
            allUsers={allUsers}
            mode={dashboardMode}
            onModeChange={setDashboardMode}
          />
        )}
        {view === 'settings'    && <SettingsPage userId={user.id} user={user} />}

        {/* Feedback — accessible to ALL members */}
        {view === 'feedback' && (
          <div className={styles.main}>
            <FeedbackPage dragons={dragons} />
          </div>
        )}

        {view === 'nesting'     && <NestingCalculator dragons={dragons.filter(d => !d.is_egg)} />}
        {view === 'elder'       && <ElderTracker user={user} dragons={[...dragons, ...clanDragons].filter((d,i,a)=>a.findIndex(x=>x.id===d.id)===i)} myDragons={dragons} onTick={handleTick} />}
        {view === 'crystals'    && (
          <div className={styles.main}>
            <CrystalTable dragons={dragons} clanDragons={clanDragons} allUsers={allUsers} />
          </div>
        )}
        {/* Training page lives inside DevConsolePage → dev-training nav */}
        {view === 'map'         && (
          <div className={styles.main}>
            <MapPage
              myDragons={dragons}
              onSelectDragon={handleMapDragonClick}
              onDragonMoved={loadDragons}
            />
          </div>
        )}
        {view === 'clan-canvas' && canSeeBreederContent(user) && (
          <div className={styles.main} style={{ padding:0 }}>
            <LineageGraph dragons={clanDragons} clanDragons={[]} user={user} />
          </div>
        )}
        {view === 'clan-map' && isAdmin(user) && (
          <div className={styles.main}>
            <MapPage
              myDragons={[]}
              clanMapMode={true}
              onSelectDragon={handleMapDragonClick}
              onDragonMoved={loadDragons}
            />
          </div>
        )}

        {/* Dev console — feedback + simulations + training */}
        {(view === 'dev-feedback' || view === 'dev-simulation' || view === 'dev-training') && isDev(user) && (
          <div className={styles.main}>
            <DevConsolePage initialTab={view === 'dev-simulation' ? 'simulation' : view === 'dev-training' ? 'training' : 'feedback'} />
          </div>
        )}



        {view === 'lineage' && (
          <div className={styles.main} style={{ padding:0 }}>
            <LineageGraph dragons={dragons} clanDragons={clanDragons} user={user} />
          </div>
        )}

        {view === 'dragons' && (
          <div className={styles.main}>
            {/* Top bar */}
            <div className={styles.topBar}>
              <div className={styles.topLeft}>
                <h2 className={`cinzel ${styles.pageTitle}`}>
                  Dragon Registry
                  {isAdmin(user) && registryMode === 'clan' && <span style={{ fontSize: 13, color: 'var(--accent)', marginLeft: 8 }}>★ All Members</span>}
                </h2>
                <span className={styles.count}>{filtered.length} / {registryDragons.length}</span>
              </div>
              <div className={styles.topRight}>
                {isAdmin(user) && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    <button
                      className={`btn btn-sm ${registryMode === 'mine' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => { setRegistryMode('mine'); setFilterUser('') }}
                    >My Dragons</button>
                    <button
                      className={`btn btn-sm ${registryMode === 'clan' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setRegistryMode('clan')}
                    >★ All Members</button>
                  </div>
                )}
                <div className={styles.filterBar}>
                  <input
                    className={styles.search}
                    type="text"
                    placeholder="Search species, skin, player…"
                    value={filters.search}
                    onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                  />
                  <select value={filters.species} onChange={e => setFilters(f => ({ ...f, species: e.target.value }))}>
                    <option value="">All species</option>
                    {['FS','SS','ASD','IR','BS','BW','BIO'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={filters.growth} onChange={e => setFilters(f => ({ ...f, growth: e.target.value }))}>
                    <option value="">All growth</option>
                    {['Hatchling','Juvenile','Adult','Elder'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={filters.clan_role} onChange={e => setFilters(f => ({ ...f, clan_role: e.target.value }))}>
                    <option value="">All roles</option>
                    <option value="Fighter">Fighter</option>
                    <option value="Breeder">Breeder</option>
                  </select>
                  <select value={filters.gender} onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">Any gender</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                  <select value={filters.elder} onChange={e => setFilters(f => ({ ...f, elder: e.target.value }))}>
                    <option value="">Elder: all</option>
                    <option value="yes">Elder only</option>
                    <option value="no">Non-elder</option>
                  </select>
                  <select value={filters.dead} onChange={e => setFilters(f => ({ ...f, dead: e.target.value }))}>
                    <option value="hide">Hide dead</option>
                    <option value="">Show all</option>
                    <option value="only">Dead only</option>
                  </select>
                  {isAdmin(user) && registryMode === 'clan' && allUsers.length > 0 && (
                    <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                      <option value="">All members</option>
                      {allUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className={styles.actionBtns}>
                  <button className="btn btn-ghost btn-sm" onClick={handleImport} title="Import JSON">↑ Import</button>
                  <button className="btn btn-ghost btn-sm" onClick={handleExport} title="Export JSON">↓ Export</button>
                  {/* Split button: left = Add Dragon, right arrow = expand menu with Add Egg */}
                  <div className={styles.splitBtn} ref={addBtnRef}>
                    <button
                      className={`btn btn-primary ${styles.splitBtnMain}`}
                      onClick={() => { setEditDragon(null); setShowForm(true); setAddMenuOpen(false) }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Add Dragon
                    </button>
                    <button
                      className={`btn btn-primary ${styles.splitBtnArrow}`}
                      onClick={() => setAddMenuOpen(o => !o)}
                      title="More options"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {addMenuOpen && (
                      <div className={styles.splitDropdown}>
                        <button className={styles.splitDropItem} onClick={() => { setAddMenuOpen(false); setShowEggForm(true) }}>
                          🥚 Add Egg
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.content}>
              <DragonList
                dragons={filtered}
                loading={loading}
                selected={selected}
                onSelect={setSelected}
                onEdit={d  => { setEditDragon(d); d.is_egg ? setShowEggForm(true) : setShowForm(true) }}
                onDelete={handleDelete}
                onKill={handleKill}
                onChangeLocation={d => setLocationTarget(d)}
                onToggleHungry={handleToggleHungry}
                onTick={handleTick}
                onGiveEgg={handleGiveEgg}
                allUsers={allUsers}
              />
              {selectedDragon && (
                <div className={styles.detailOverlay} onClick={() => setSelected(null)}>
                  <div className={styles.detailSidebar} onClick={e => e.stopPropagation()}>
                    <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
                    <DragonDetail
                      dragon={selectedDragon}
                      allDragons={dragons}
                      onEdit={d => { setEditDragon(d); d.is_egg ? setShowEggForm(true) : setShowForm(true) }}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Dragon form (add / edit) ── */}
      {showForm && (
        <DragonForm
          dragon={editDragon}
          allDragons={dragons}
          clanDragons={clanDragons}
          nestingSpots={nestingSpots}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditDragon(null) }}
        />
      )}

      {/* ── Egg form ── */}
      {showEggForm && (
        <EggForm
          egg={editDragon}
          allUsers={allUsers}
          onSave={handleSaveEgg}
          onClose={() => { setShowEggForm(false); setEditDragon(null) }}
        />
      )}

      {/* ── Kill-and-replace confirmation modal ── */}
      {killConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
             onClick={() => setKillConfirm(null)}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'28px 32px', maxWidth:420, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}
               onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:28, textAlign:'center', marginBottom:12 }}>💀</div>
            <h3 style={{ margin:'0 0 8px', textAlign:'center', fontSize:16 }}>Set as Dead?</h3>
            <p style={{ margin:'0 0 20px', color:'var(--muted)', fontSize:13, textAlign:'center', lineHeight:1.6 }}>
              This action will set{' '}
              <b style={{ color:'var(--text)' }}>
                {killConfirm.duplicate.name || killConfirm.duplicate.species}
              </b>{' '}
              (Account: <b style={{ color:'var(--text)' }}>{killConfirm.duplicate.ownerUsername || killConfirm.duplicate.player_name}</b>)
              {' '}as <b style={{ color:'#e05a5a' }}>Dead</b>, then register the new dragon.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button className="btn btn-ghost" onClick={() => setKillConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background:'#c44a4a', borderColor:'#c44a4a' }} onClick={handleKillAndCreate}>
                Yes, set as dead & proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Location picker (from context menu) ── */}
      {locationTarget && (
        <LocationModal
          dragon={locationTarget}
          onSave={loc => handleLocationSave(locationTarget, loc)}
          onClose={() => setLocationTarget(null)}
        />
      )}

      {/* ── F8 Capture → full DragonForm with real dragons available ── */}
      {pendingCapture && (
        <CaptureConfirmModal
          capture={pendingCapture}
          userId={user.id}
          allDragons={dragons}
          clanDragons={clanDragons}
          nestingSpots={nestingSpots}
          onClose={() => setPendingCapture(null)}
          onSaved={() => {
            setPendingCapture(null)
            loadDragons()
          }}
        />
      )}
    </div>
  )
}

// ── Inline location change modal ──────────────────────────────────────────────
function LocationModal({ dragon, onSave, onClose }) {
  const [locId, setLocId] = useState(dragon.location?.id || '')

  function handleSave() {
    if (!locId) { onSave(null); return }
    const loc = MAP_LOCATIONS.find(l => l.id === locId)
    if (loc?.x != null) onSave({ id: loc.id, label: loc.label, x: loc.x, y: loc.y })
    else onSave(null)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(8,10,15,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:360, overflow:'hidden' }}>
        <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontWeight:600, fontSize:14 }}>Change Location</span>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding:18 }}>
          <div className="form-group">
            <label>Location</label>
            <select value={locId} onChange={e => setLocId(e.target.value)} style={{ width:'100%' }}>
              <option value="">— No location —</option>
              {MAP_LOCATIONS.filter(l => l.x != null).map(l => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ padding:'14px 18px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8, background:'var(--bg)' }}>
          <button className="btn btn-ghost" onClick={() => onSave(null)}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
