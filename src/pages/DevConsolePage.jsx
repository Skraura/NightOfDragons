/**
 * DevConsolePage.jsx — v7.9.0
 *
 * Dev-only two-tab interface:
 *  Tab 1: Feedback Console — full thread management + version publishing
 *  Tab 2: Simulation Tools — quick-create test data, stat presets, clear sim data
 */

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../App'
import TrainingPage from './TrainingPage'
import styles from './DevConsolePage.module.css'

const ALL_SPECIES = ['ASD', 'BS', 'SS', 'FS', 'IR', 'BW', 'BIO']
const ALL_GROWTH  = ['Hatchling', 'Juvenile', 'Adult', 'Elder']
const ALL_GENDERS = ['M', 'F']
const STAT_KEYS   = [
  'stat_life_expectancy','stat_scale_thickness','stat_stamina','stat_bile_production',
  'stat_bite_force','stat_power','stat_strength','stat_nutrient_absorption','stat_water_retention',
  'stat_toxin_tolerance','stat_impact_resistance','stat_pierce_resistance','stat_fire_resistance',
  'stat_frost_resistance','stat_plasma_resistance','stat_lightning_resistance','stat_acid_resistance',
  'stat_venom_resistance',
]

// ── Stat presets ──────────────────────────────────────────────────────────────
const STAT_PRESETS = {
  '18A':   Object.fromEntries(STAT_KEYS.map(k => [k, 'A'])),
  '18A+':  Object.fromEntries(STAT_KEYS.map(k => [k, 'A+'])),
  '18F':   Object.fromEntries(STAT_KEYS.map(k => [k, 'F'])),
  '18B':   Object.fromEntries(STAT_KEYS.map(k => [k, 'B'])),
  'Mixed': Object.fromEntries(STAT_KEYS.map((k, i) => [k, ['A+','A','A','B+','A','A+','A','A+','A','B+','A','A','A+','B','A','A+','A','B+'][i]])),
}

function randomGrade() {
  return ['F','F','D','D','C','C','B','B','A','A','A+'][Math.floor(Math.random() * 11)]
}
function randomStats() {
  return Object.fromEntries(STAT_KEYS.map(k => [k, randomGrade()]))
}

// ── Lineage scenarios ─────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'basic_trio',
    label: 'Basic trio',
    desc: '1 mother + 1 father + 1 offspring',
    dragons: [
      { name: 'SimFather', gender: 'M', species: 'ASD', growth: 'Adult', stats: '18A' },
      { name: 'SimMother', gender: 'F', species: 'ASD', growth: 'Adult', stats: '18A' },
      { name: 'SimOffspring', gender: 'M', species: 'ASD', growth: 'Hatchling', stats: '18A', fatherIdx: 0, motherIdx: 1 },
    ],
  },
  {
    id: 'two_litters',
    label: '1 mother, 2 fathers, 2 offspring',
    desc: 'Mother has offspring with two different males',
    dragons: [
      { name: 'SimMother',     gender: 'F', species: 'ASD', growth: 'Adult', stats: '18A' },
      { name: 'SimFatherA',    gender: 'M', species: 'ASD', growth: 'Adult', stats: '18A' },
      { name: 'SimFatherB',    gender: 'M', species: 'ASD', growth: 'Adult', stats: '18A+' },
      { name: 'SimOffspringA', gender: 'F', species: 'ASD', growth: 'Hatchling', stats: '18A',  motherIdx: 0, fatherIdx: 1 },
      { name: 'SimOffspringB', gender: 'M', species: 'ASD', growth: 'Hatchling', stats: '18A+', motherIdx: 0, fatherIdx: 2 },
    ],
  },
  {
    id: 'renesting',
    label: 'Renesting (male is own father)',
    desc: 'Tests the renesting detection — male is set as his own father',
    dragons: [
      { name: 'SimMother',  gender: 'F', species: 'ASD', growth: 'Adult',     stats: '18A' },
      { name: 'SimRenest',  gender: 'M', species: 'ASD', growth: 'Adult',     stats: '18A', selfFather: true },
      { name: 'SimChild',   gender: 'F', species: 'ASD', growth: 'Hatchling', stats: '18A', motherIdx: 0, fatherIdx: 1 },
    ],
  },
  {
    id: 'three_gen',
    label: '3 generations',
    desc: 'Grandparents → parents → offspring',
    dragons: [
      { name: 'SimGrandFather', gender: 'M', species: 'ASD', growth: 'Elder', stats: '18A+' },
      { name: 'SimGrandMother', gender: 'F', species: 'ASD', growth: 'Elder', stats: '18A+' },
      { name: 'SimFather',      gender: 'M', species: 'ASD', growth: 'Adult', stats: '18A', fatherIdx: 0, motherIdx: 1 },
      { name: 'SimMother',      gender: 'F', species: 'ASD', growth: 'Adult', stats: '18A', fatherIdx: 0, motherIdx: 1 },
      { name: 'SimChild',       gender: 'F', species: 'ASD', growth: 'Hatchling', stats: '18A', fatherIdx: 2, motherIdx: 3 },
    ],
  },
]

export default function DevConsolePage({ initialTab = 'feedback' }) {
  const { user } = useApp()
  const [tab, setTab] = useState(initialTab)

  // Sync tab when sidebar nav changes (initialTab changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setTab(initialTab) }, [initialTab])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={`cinzel ${styles.title}`}>⚙ Dev Console</h1>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'feedback' ? styles.tabActive : ''}`} onClick={() => setTab('feedback')}>
            💬 Feedback Console
          </button>
          <button className={`${styles.tab} ${tab === 'simulation' ? styles.tabActive : ''}`} onClick={() => setTab('simulation')}>
            ⚗️ Simulations
          </button>
          <button className={`${styles.tab} ${tab === 'training' ? styles.tabActive : ''}`} onClick={() => setTab('training')}>
            🎓 OCR Training
          </button>
        </div>
      </div>

      {tab === 'feedback'   && <FeedbackConsole user={user} />}
      {tab === 'simulation' && <SimulationTools user={user} />}
      {tab === 'training'   && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <TrainingPage />
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: Feedback Console
// ══════════════════════════════════════════════════════════════════════════════

function FeedbackConsole({ user }) {
  const [threads,      setThreads]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('all')
  const [sortBy,       setSortBy]       = useState('recent')
  const [showResolved, setShowResolved] = useState(false)
  const [publishing,   setPublishing]   = useState(false)
  const [versionDraft, setVersionDraft] = useState({ version: '', body: '' })
  const [showPublish,  setShowPublish]  = useState(false)
  const [versions,     setVersions]     = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, vers] = await Promise.all([
        window.api.feedback.getAll(),
        window.api.feedback.getVersions(),
      ])
      setThreads(Array.isArray(data) ? data : [])
      setVersions(Array.isArray(vers) ? vers : [])
    } catch { setThreads([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const TYPES = ['all', 'feature_add', 'feature_remove', 'feature_fix', 'other']
  const TYPE_LABELS = { all:'All', feature_add:'➕ Add', feature_remove:'➖ Remove', feature_fix:'🔧 Fix', other:'💬 Other' }
  const FROM_FILTERS = ['all', 'admin', 'member']

  const [fromFilter, setFromFilter] = useState('all')

  const filtered = threads
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t => showResolved ? true : !t.resolved)
    .filter(t => fromFilter === 'all' ? true : (fromFilter === 'admin' ? t._authorRole === 'admin' || t._authorRole === 'dev' : t._authorRole === 'member'))
    .sort((a, b) => sortBy === 'top'
      ? (b.upvotes?.length || 0) - (a.upvotes?.length || 0)
      : (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))

  async function markDone(id) {
    await window.api.feedback.markDone({ id })
    load()
  }

  async function sendReply(id, body) {
    await window.api.feedback.addReply({ id, body })
    load()
  }

  async function publishVersion() {
    if (!versionDraft.version.trim() || !versionDraft.body.trim()) return
    setPublishing(true)
    try {
      await window.api.feedback.publishVersion({ version: versionDraft.version.trim(), body: versionDraft.body.trim() })
      setVersionDraft({ version: '', body: '' })
      setShowPublish(false)
      load()
    } finally { setPublishing(false) }
  }

  return (
    <div className={styles.consoleBody}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterRow}>
          {TYPES.map(t => (
            <button key={t} className={`${styles.chip} ${filter === t ? styles.chipActive : ''}`} onClick={() => setFilter(t)}>
              {TYPE_LABELS[t]}
            </button>
          ))}
          <span className={styles.sep} />
          {FROM_FILTERS.map(f => (
            <button key={f} className={`${styles.chip} ${fromFilter === f ? styles.chipActive : ''}`} onClick={() => setFromFilter(f)}>
              {f === 'all' ? 'Everyone' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <span className={styles.sep} />
          <button className={`${styles.chip} ${sortBy === 'recent' ? styles.chipActive : ''}`} onClick={() => setSortBy('recent')}>🕐 Recent</button>
          <button className={`${styles.chip} ${sortBy === 'top'    ? styles.chipActive : ''}`} onClick={() => setSortBy('top')}>🔥 Top</button>
          <button className={`${styles.chip} ${showResolved ? styles.chipActive : ''}`} onClick={() => setShowResolved(s => !s)}>✅ Resolved</button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowPublish(s => !s)}>
          📢 Publish version note
        </button>
      </div>

      {/* Publish panel */}
      {showPublish && (
        <div className={styles.publishPanel}>
          <h3 style={{ margin:'0 0 12px', fontSize:14 }}>📢 Publish Version Note</h3>
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            <input
              value={versionDraft.version}
              onChange={e => setVersionDraft(d => ({ ...d, version: e.target.value }))}
              placeholder="Version (e.g. 7.9.0)"
              style={{ width:140 }}
            />
          </div>
          <textarea
            value={versionDraft.body}
            onChange={e => setVersionDraft(d => ({ ...d, body: e.target.value }))}
            placeholder="Paste the WhatsNew markdown content here…"
            rows={8}
            style={{ width:'100%', resize:'vertical', fontFamily:'monospace', fontSize:12 }}
          />
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button className="btn btn-primary btn-sm" onClick={publishVersion} disabled={publishing || !versionDraft.version || !versionDraft.body}>
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPublish(false)}>Cancel</button>
          </div>

          {versions.length > 0 && (
            <div style={{ marginTop:14, borderTop:'1px solid var(--border)', paddingTop:10 }}>
              <p style={{ fontSize:11, color:'var(--muted)', margin:'0 0 6px' }}>Previously published:</p>
              {versions.slice(0,5).map(v => (
                <div key={v.id} style={{ fontSize:12, color:'var(--text)', padding:'3px 0' }}>
                  <b>v{v.version}</b> — {v.published_at?.seconds ? new Date(v.published_at.seconds * 1000).toLocaleDateString() : '—'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thread list */}
      <div className={styles.threadList}>
        {loading && <div className={styles.loading}>Loading threads…</div>}
        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>No threads match these filters.</div>
        )}
        {filtered.map(t => (
          <DevThread key={t.id} thread={t} userId={user.id} onMarkDone={markDone} onReply={sendReply} onRefresh={load} />
        ))}
      </div>
    </div>
  )
}

function DevThread({ thread: t, userId, onMarkDone, onReply, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [showReply, setShowReply] = useState(false)

  const TYPE_COLORS = { feature_add:'#5291f5', feature_remove:'#e05a5a', feature_fix:'#c9932a', other:'#7c5cbf' }
  const TYPE_LABELS = { feature_add:'➕ Add', feature_remove:'➖ Remove', feature_fix:'🔧 Fix', other:'💬 Other' }
  const color = TYPE_COLORS[t.type] || '#888'
  const score = (t.upvotes?.length || 0) - (t.downvotes?.length || 0)

  return (
    <div className={`${styles.devThread} ${t.resolved ? styles.devThreadResolved : ''}`}>
      <div className={styles.devThreadTop}>
        <span className={styles.devTypeBadge} style={{ background:`${color}18`, color, border:`1px solid ${color}40` }}>
          {TYPE_LABELS[t.type] || t.type}
        </span>
        {t.visibility === 'private' && <span className={styles.devPrivate}>🔒</span>}
        {t.resolved && <span className={styles.devResolved}>✅ Done</span>}
        <span style={{ fontSize:11, color:'var(--muted)', marginLeft:'auto' }}>
          {score > 0 ? `+${score}` : score} votes · {t.replies?.length || 0} replies
        </span>
      </div>
      <h4 className={styles.devThreadTitle} onClick={() => setExpanded(e => !e)}>
        <span className={styles.expandArrow}>{expanded ? '▾' : '▸'}</span>
        {t.title || '(no title)'}
      </h4>
      {expanded && (
        <>
          <p className={styles.devThreadBody}>{t.body}</p>
          {t.subtasks?.length > 0 && (
            <ul className={styles.devSubtasks}>
              {t.subtasks.map((s, i) => <li key={i} className={s.done ? styles.devSubtaskDone : ''}>{s.done ? '✅' : '☐'} {s.text}</li>)}
            </ul>
          )}
          {t.replies?.length > 0 && (
            <div className={styles.devReplies}>
              {t.replies.map((r, i) => (
                <div key={i} className={styles.devReply}>
                  <span className={styles.devReplyAuthor}>{r.author_id === userId ? 'You (Dev)' : r.author_id?.slice(0,8)}</span>
                  <span>{r.body}</span>
                </div>
              ))}
            </div>
          )}
          {showReply ? (
            <div className={styles.devReplyInput}>
              <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={2} placeholder="Dev reply…" style={{ width:'100%', resize:'vertical' }} />
              <div style={{ display:'flex', gap:6, marginTop:4 }}>
                <button className="btn btn-primary btn-sm" onClick={async () => { await onReply(t.id, replyBody); setReplyBody(''); setShowReply(false) }}>Send</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowReply(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className={styles.devActions}>
              <button className={styles.devActionBtn} onClick={() => setShowReply(true)}>💬 Reply</button>
              {!t.resolved && (
                <button className={`${styles.devActionBtn} ${styles.devActionDone}`} onClick={() => onMarkDone(t.id)}>
                  ✅ Mark done
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: Simulation Tools
// ══════════════════════════════════════════════════════════════════════════════

function SimulationTools({ user }) {
  const [simDragons, setSimDragons]   = useState([])
  const [loadingSim, setLoadingSim]   = useState(true)
  const [creating,   setCreating]     = useState(false)
  const [clearing,   setClearing]     = useState(false)
  const [status,     setStatus]       = useState(null)  // { type: 'ok'|'err', msg }

  // Quick-create form
  const [quickSpecies, setQuickSpecies] = useState('ASD')
  const [quickGender,  setQuickGender]  = useState('M')
  const [quickGrowth,  setQuickGrowth]  = useState('Adult')
  const [quickName,    setQuickName]    = useState('')
  const [quickPreset,  setQuickPreset]  = useState('18A')

  const loadSim = useCallback(async () => {
    setLoadingSim(true)
    try {
      const all = await window.api.dragon.getAll({ userId: user.id })
      setSimDragons((Array.isArray(all) ? all : []).filter(d => d.is_sim))
    } catch { setSimDragons([]) }
    finally { setLoadingSim(false) }
  }, [user.id])

  useEffect(() => { loadSim() }, [loadSim])

  function toast(type, msg) {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 3500)
  }

  async function createQuick() {
    setCreating(true)
    try {
      const stats = quickPreset === 'random' ? randomStats() : (STAT_PRESETS[quickPreset] || STAT_PRESETS['18A'])
      await window.api.dragon.create({
        userId: user.id,
        data: {
          name: quickName.trim() || `Sim_${quickSpecies}_${Date.now().toString(36).slice(-4)}`,
          species: quickSpecies, gender: quickGender, growth: quickGrowth,
          is_sim: true, player_name: 'SimAccount', account_id: user.id,
          ...stats,
        },
      })
      toast('ok', 'Sim dragon created')
      setQuickName('')
      loadSim()
    } catch(e) { toast('err', e.message) }
    finally { setCreating(false) }
  }

  async function runScenario(scenario) {
    setCreating(true)
    try {
      const createdIds = []
      for (const d of scenario.dragons) {
        const stats = d.stats === 'random' ? randomStats() : (STAT_PRESETS[d.stats] || STAT_PRESETS['18A'])
        const res = await window.api.dragon.create({
          userId: user.id,
          data: {
            name: d.name, species: d.species, gender: d.gender, growth: d.growth,
            is_sim: true, player_name: 'SimAccount', account_id: user.id,
            ...stats,
          },
        })
        createdIds.push(res?.id || null)
      }
      // Wire lineage now that we have IDs
      for (let i = 0; i < scenario.dragons.length; i++) {
        const d = scenario.dragons[i]
        const id = createdIds[i]
        if (!id) continue
        const fatherId = d.selfFather ? id : (d.fatherIdx != null ? createdIds[d.fatherIdx] : null)
        const motherId = d.motherIdx != null ? createdIds[d.motherIdx] : null
        if (fatherId || motherId) {
          await window.api.dragon.update({ userId: user.id, id, data: { father_id: fatherId || null, mother_id: motherId || null } })
        }
      }
      toast('ok', `Scenario "${scenario.label}" created (${scenario.dragons.length} dragons)`)
      loadSim()
    } catch(e) { toast('err', e.message) }
    finally { setCreating(false) }
  }

  async function clearAllSim() {
    if (!window.confirm(`Delete all ${simDragons.length} simulation dragons? This cannot be undone.`)) return
    setClearing(true)
    try {
      await Promise.all(simDragons.map(d => window.api.dragon.delete({ userId: user.id, id: d.id })))
      toast('ok', `Cleared ${simDragons.length} sim dragons`)
      loadSim()
    } catch(e) { toast('err', e.message) }
    finally { setClearing(false) }
  }

  async function deleteSingle(id) {
    try {
      await window.api.dragon.delete({ userId: user.id, id })
      loadSim()
    } catch(e) { toast('err', e.message) }
  }

  return (
    <div className={styles.simBody}>
      {status && (
        <div className={`${styles.statusToast} ${status.type === 'ok' ? styles.toastOk : styles.toastErr}`}>
          {status.type === 'ok' ? '✅' : '❌'} {status.msg}
        </div>
      )}

      <div className={styles.simGrid}>
        {/* Quick Create */}
        <div className={styles.simCard}>
          <h3 className={styles.simCardTitle}>⚡ Quick Create</h3>
          <p className={styles.simCardSub}>Instantly add a single test dragon tagged <code>is_sim</code></p>
          <div className={styles.simForm}>
            <div className="form-group">
              <label>Name (optional)</label>
              <input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="Auto-generated if blank" />
            </div>
            <div className={styles.simRow}>
              <div className="form-group">
                <label>Species</label>
                <select value={quickSpecies} onChange={e => setQuickSpecies(e.target.value)}>
                  {ALL_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={quickGender} onChange={e => setQuickGender(e.target.value)}>
                  <option value="M">♂ Male</option>
                  <option value="F">♀ Female</option>
                </select>
              </div>
              <div className="form-group">
                <label>Growth</label>
                <select value={quickGrowth} onChange={e => setQuickGrowth(e.target.value)}>
                  {ALL_GROWTH.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Stat Preset</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[...Object.keys(STAT_PRESETS), 'random'].map(p => (
                  <button
                    key={p} type="button"
                    className={`${styles.presetBtn} ${quickPreset === p ? styles.presetActive : ''}`}
                    onClick={() => setQuickPreset(p)}
                  >{p}</button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={createQuick} disabled={creating}>
              {creating ? 'Creating…' : '+ Create dragon'}
            </button>
          </div>
        </div>

        {/* Lineage Scenarios */}
        <div className={styles.simCard}>
          <h3 className={styles.simCardTitle}>🌿 Lineage Scenarios</h3>
          <p className={styles.simCardSub}>Pre-built lineage trees for testing the canvas</p>
          <div className={styles.scenarioList}>
            {SCENARIOS.map(s => (
              <div key={s.id} className={styles.scenarioRow}>
                <div>
                  <div className={styles.scenarioLabel}>{s.label}</div>
                  <div className={styles.scenarioDesc}>{s.desc}</div>
                  <div className={styles.scenarioCount}>{s.dragons.length} dragons</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => runScenario(s)} disabled={creating}>
                  Run
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sim dragon list */}
      <div className={styles.simList}>
        <div className={styles.simListHeader}>
          <h3 className={styles.simCardTitle}>🗂 Simulation Dragons ({simDragons.length})</h3>
          {simDragons.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ color:'#e05a5a' }} onClick={clearAllSim} disabled={clearing}>
              {clearing ? 'Clearing…' : `🗑 Clear all ${simDragons.length}`}
            </button>
          )}
        </div>

        {loadingSim && <div className={styles.loading}>Loading sim dragons…</div>}

        {!loadingSim && simDragons.length === 0 && (
          <div className={styles.simEmpty}>No simulation dragons yet. Create some above!</div>
        )}

        {!loadingSim && simDragons.length > 0 && (
          <div className={styles.simDragonGrid}>
            {simDragons.map(d => (
              <div key={d.id} className={styles.simDragonCard}>
                <div className={styles.simDragonTop}>
                  <span style={{ fontWeight:700 }}>{d.name || d.species}</span>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>{d.species} {d.gender === 'M' ? '♂' : '♀'} · {d.growth}</span>
                </div>
                {d.father_id && <div style={{ fontSize:10, color:'var(--muted)' }}>Father: {d.father_id.slice(0,8)}</div>}
                {d.mother_id && <div style={{ fontSize:10, color:'var(--muted)' }}>Mother: {d.mother_id.slice(0,8)}</div>}
                <button className={styles.simDeleteBtn} onClick={() => deleteSingle(d.id)} title="Delete">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
