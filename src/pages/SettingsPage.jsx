import { useState, useEffect } from 'react'
import { useApp } from '../App'
import { useToast } from '../components/ToastProvider'
import { CAPTURE_FIELDS } from '../lib/dragonData'
import useLineagePrefs from '../hooks/useLineagePrefs'
import { isAdmin, isDev } from '../lib/roleUtils'
import styles from './SettingsPage.module.css'

export default function SettingsPage({ userId, user: userProp }) {
  const { syncApiKey, theme, setTheme, user: ctxUser } = useApp()
  const user = userProp || ctxUser
  const { addToast }   = useToast()
  const { prefs: lineagePrefs, setPrefs: setLineagePrefs } = useLineagePrefs()

  const [apiKey,         setApiKey]         = useState('')
  const [savedKey,       setSavedKey]       = useState('')
  const [highAccuracy,   setHighAccuracy]   = useState(false)
  const [captureKey,     setCaptureKey]     = useState('F8')
  const [hotkeyEditing,  setHotkeyEditing]  = useState(false)
  const [hotkeyInput,    setHotkeyInput]    = useState('')
  const [hotkeyStatus,   setHotkeyStatus]   = useState(null)  // null | 'ok' | 'fail'
  const [displays,       setDisplays]       = useState([])
  const [selectedDisplay,setSelectedDisplay]= useState(null)
  const [resolution,     setResolution]     = useState('')
  const [boxConfig,      setBoxConfig]      = useState(null)


  // ── Load on mount ──
  useEffect(() => {
    const stored = localStorage.getItem('dod_api_key') || ''
    setApiKey(stored)
    setSavedKey(stored)

    window.api?.session.loadSettings().then(s => {
      setHighAccuracy(!!s.highAccuracyMode)
      if (s.captureKey) setCaptureKey(s.captureKey)
    window.api?.hotkey.get().then(h => { if (h?.captureKey) setCaptureKey(h.captureKey) })
    })

    window.api?.screen.getDisplays().then(d => {
      setDisplays(d)
      const primary = d.find(x => x.primary) || d[0]
      if (primary) {
        setSelectedDisplay(primary.id)
        setResolution(`${primary.bounds.width}x${primary.bounds.height}`)
      }
    }).catch(() => {})  
  }, [])


  useEffect(() => {
    if (!resolution) return
    window.api?.boxConfig.get({ resolution }).then(cfg => setBoxConfig(cfg))
  }, [resolution])

  // Refresh calibration after window refocuses (user may have just calibrated)
  useEffect(() => {
    const onFocus = () => {
      if (resolution) {
        window.api?.boxConfig.get({ resolution }).then(cfg => setBoxConfig(cfg))
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [resolution])


  // ── Test connection ──

  // ── Save API key ──
  async function saveApiKey() {
    const trimmed = apiKey.trim()
    localStorage.setItem('dod_api_key', trimmed)
    setSavedKey(trimmed)
    syncApiKey(trimmed)
    // Also persist high accuracy mode
    await window.api?.session.saveSettings({ highAccuracyMode: highAccuracy })
    addToast('Settings saved', 'success')
  }

  // ── Toggle High Accuracy Mode ──
  async function toggleHighAccuracy(val) {
    setHighAccuracy(val)
    await window.api?.session.saveSettings({ highAccuracyMode: val })
    addToast(val ? 'High Accuracy Mode on — Claude Vision will be used' : 'Reverted to Tesseract (free)', 'info')
  }

  // ── Open calibration window ──
  async function openCalibration() {
    const res = await window.api?.calibration.open({ displayId: selectedDisplay })
    if (!res?.ok) addToast(res?.error || 'Could not open calibration', 'error')
    else addToast('Draw boxes over each field in the game UI', 'info')
  }

  const configuredFields = boxConfig ? Object.keys(boxConfig) : []
  const progress         = configuredFields.length
  const totalFields      = CAPTURE_FIELDS.length


  async function saveHotkey() {
    const key = hotkeyInput.trim() || 'F8'
    const res = await window.api?.hotkey.set({ accelerator: key })
    if (res?.ok) {
      setCaptureKey(key)
      setHotkeyStatus('ok')
      setHotkeyEditing(false)
    } else {
      setHotkeyStatus('fail')
    }
    setTimeout(() => setHotkeyStatus(null), 3000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h2 className={`cinzel ${styles.heading}`}>Settings</h2>

        {/* ── Theme card ── */}
        <section className={styles.card}>
          <h3 className={`cinzel ${styles.cardTitle}`}>Appearance</h3>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>Light Theme</div>
              <p className={styles.settingDesc}>Switch between dark and light modes.</p>
            </div>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={theme === 'light'} 
                onChange={e => setTheme(e.target.checked ? 'light' : 'dark')}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        </section>

        {/* ── OCR Engine card ── */}
        <section className={styles.card}>
          <h3 className={`cinzel ${styles.cardTitle}`}>OCR Engine</h3>
          <p className={styles.cardDesc}>
            Choose how the app reads text from your game screenshots when you press F8.
          </p>

          <div className={styles.engineGrid}>
            {/* Tesseract — FREE */}
            <div
              className={`${styles.engineCard} ${!highAccuracy ? styles.engineSelected : ''}`}
              onClick={() => toggleHighAccuracy(false)}
            >
              <div className={styles.engineRadio}>
                <span className={styles.engineRadioDot} />
              </div>
              <div className={styles.engineInfo}>
                <div className={styles.engineName}>
                  Tesseract OCR
                  <span className={styles.engineBadgeFree}>FREE</span>
                </div>
                <p className={styles.engineDesc}>
                  Runs completely offline on your machine. No account, no API key, no cost.
                  Works well for clean UI text. Recommended for most users.
                </p>
                <div className={styles.engineTags}>
                  <span className={styles.tagGood}>✓ Free forever</span>
                  <span className={styles.tagGood}>✓ Offline</span>
                  <span className={styles.tagGood}>✓ No account needed</span>
                  <span className={styles.tagNeutral}>~ Good accuracy</span>
                </div>
              </div>
            </div>

            {/* Claude Vision — PAID */}
            <div
              className={`${styles.engineCard} ${highAccuracy ? styles.engineSelected : ''} ${!savedKey ? styles.engineDisabled : ''}`}
              onClick={() => savedKey && toggleHighAccuracy(true)}
            >
              <div className={styles.engineRadio}>
                <span className={styles.engineRadioDot} />
              </div>
              <div className={styles.engineInfo}>
                <div className={styles.engineName}>
                  Claude Vision
                  <span className={styles.engineBadgePaid}>PAID</span>
                </div>
                <p className={styles.engineDesc}>
                  Uses the Anthropic Claude Haiku API to read each field.
                  Handles stylized game fonts and unusual colors better than Tesseract.
                  Costs ~$0.01–0.05 per F8 press.
                </p>
                <div className={styles.engineTags}>
                  <span className={styles.tagGood}>✓ Best accuracy</span>
                  <span className={styles.tagGood}>✓ Handles any font</span>
                  <span className={styles.tagBad}>✗ Requires API key</span>
                  <span className={styles.tagBad}>✗ ~$0.01–0.05 per capture</span>
                </div>
                {!savedKey && (
                  <p className={styles.engineWarn}>⚠ Enter an API key below to enable</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── API Key card (only relevant if Claude Vision selected) ── */}
        <section className={`${styles.card} ${!highAccuracy ? styles.cardDimmed : ''}`}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={`cinzel ${styles.cardTitle}`}>
                Anthropic API Key
                {!highAccuracy && <span className={styles.optionalTag}>optional</span>}
              </h3>
              <p className={styles.cardDesc}>
                Required only if using Claude Vision mode above. Your key is stored
                locally and only sent to api.anthropic.com.
              </p>
            </div>
            {savedKey && <span className={styles.statusBadge}>✓ Saved</span>}
          </div>
          <div className={styles.keyRow}>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-api03-…"
              autoComplete="off"
              className={styles.keyInput}
              onKeyDown={e => e.key === 'Enter' && saveApiKey()}
            />
            <button
              className="btn btn-primary"
              onClick={saveApiKey}
              disabled={!apiKey.trim() || apiKey.trim() === savedKey}
            >
              Save
            </button>
          </div>
          <p className={styles.keyHint}>
            Get your key at{' '}
            <a href="#" onClick={e => { e.preventDefault(); window.open?.('https://console.anthropic.com/settings/keys') }}>
              console.anthropic.com
            </a>
          </p>
        </section>

        {/* ── Calibration card — Dev only ── */}
        {isDev(user) && <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={`cinzel ${styles.cardTitle}`}>Box Calibration</h3>
              <p className={styles.cardDesc}>
                Draw boxes over each data field in your game UI. Positions are saved as percentages — no re-calibration needed when changing resolution.
              </p>
            </div>
            <div className={styles.progressBadge}>
              <span className={`cinzel ${styles.progressNum}`}>{progress}</span>
              <span className={styles.progressDen}> / {totalFields}</span>
            </div>
          </div>

          {displays.length > 1 && (
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label>Target Display</label>
              <select
                value={selectedDisplay || ''}
                onChange={e => {
                  const id = parseInt(e.target.value)
                  setSelectedDisplay(id)
                  const d = displays.find(x => x.id === id)
                  if (d) setResolution(`${d.bounds.width}x${d.bounds.height}`)
                }}
              >
                {displays.map(d => (
                  <option key={d.id} value={d.id}>{d.label}{d.primary ? ' (Primary)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.fieldGrid}>
            {CAPTURE_FIELDS.map(f => {
              const configured = configuredFields.includes(f.key)
              return (
                <div key={f.key} className={`${styles.fieldChip} ${configured ? styles.configured : ''}`}>
                  <span className={styles.chipIcon}>{configured ? '✓' : '○'}</span>
                  <span>{f.label}</span>
                </div>
              )
            })}
          </div>

          <div className={styles.calibrateRow}>
            <button className="btn btn-primary" onClick={openCalibration}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
              {progress === 0 ? 'Start Calibration' : 'Recalibrate'}
            </button>
          </div>

          <div className={styles.steps}>
            <p className={styles.stepsTitle}>How calibration works:</p>
            <ol className={styles.stepList}>
              <li>Open Day of Dragons and navigate to a dragon's stat screen</li>
              <li>Click "Start Calibration" — a transparent overlay appears over your screen</li>
              <li>For each field in the list, click and drag a box around it</li>
              <li>Click "Save Layout" — boxes are stored as % ratios and work on <strong>any resolution</strong></li>
            </ol>
          </div>
        </section>}

        {/* ── Capture Hotkey ── */}
        <section className={styles.card}>
          <h3 className={`cinzel ${styles.cardTitle}`}>Capture Hotkey</h3>
          <p className={styles.settingDesc} style={{marginBottom: '12px'}}>
            The global key that triggers a dragon stat capture. Default is <kbd className={styles.kbd}>F8</kbd>.
            Use Electron accelerator format, e.g. <code>F8</code>, <code>F9</code>, <code>Control+Shift+C</code>.
          </p>
          <div className={styles.calibrateRow} style={{alignItems:'center', gap: '10px'}}>
            <kbd className={styles.kbd} style={{fontSize:'15px', padding:'6px 14px'}}>{captureKey}</kbd>
            {!hotkeyEditing ? (
              <button className="btn btn-ghost btn-sm" onClick={() => { setHotkeyInput(captureKey); setHotkeyEditing(true); setHotkeyStatus(null) }}>
                Change
              </button>
            ) : (
              <>
                <input
                  className={styles.keyInput}
                  value={hotkeyInput}
                  onChange={e => setHotkeyInput(e.target.value)}
                  placeholder="e.g. F9 or Control+Shift+C"
                  style={{maxWidth: '220px'}}
                  onKeyDown={e => { if (e.key === 'Enter') saveHotkey() }}
                />
                <button className="btn btn-primary btn-sm" onClick={saveHotkey}>Apply</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setHotkeyEditing(false); setHotkeyStatus(null) }}>Cancel</button>
              </>
            )}
            {hotkeyStatus === 'ok'   && <span style={{color:'#4caf50',fontSize:'13px'}}>✓ Registered</span>}
            {hotkeyStatus === 'fail' && <span style={{color:'#e05a5a',fontSize:'13px'}}>✗ Key in use or invalid</span>}
          </div>
        </section>

        {/* ── F8 Capture Status (now dynamic) ── */}
        <section className={styles.card}>
          <h3 className={`cinzel ${styles.cardTitle}`}>Capture Key Status</h3>
          <p className={styles.cardDesc} style={{ marginBottom: 14 }}>
            Press <kbd className={styles.kbd}>{captureKey}</kbd> while in-game to silently capture
            the current dragon's stats. A confirmation window will appear so you can
            review and correct the results before saving.
          </p>
          <div className={styles.requireList}>
            {isDev(user) && <Req ok={progress > 0} label={`Box calibration done (${progress}/${totalFields} fields)`} />}
            <Req ok={true}         label={`OCR engine: ${highAccuracy && savedKey ? 'Claude Vision (paid)' : 'Tesseract (free)'}`} />
            {highAccuracy && <Req ok={!!savedKey} label="API key configured" />}
            <Req ok={true} label={`Capture key: ${captureKey}`} />
          </div>
        </section>

        {/* ── Lineage card display ── */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={`cinzel ${styles.cardTitle}`}>Lineage Card Display</h3>
              <p className={styles.cardDesc}>
                Choose which information appears on each dragon card in the family tree.
                Gender is always shown.
              </p>
            </div>
          </div>

          <div className={styles.lineagePrefsGrid}>
            {/* Gender — locked on */}
            <LineagePrefRow
              label="Gender"
              desc="♂ / ♀ symbol (always on)"
              checked={true}
              locked={true}
            />
            <LineagePrefRow
              label="Dominant skin"
              desc="e.g. Crimson, Gold, Leucistic…"
              checked={lineagePrefs.showSkin}
              onChange={v => setLineagePrefs(p => ({ ...p, showSkin: v }))}
            />
            <LineagePrefRow
              label="Growth Stage"
              desc="Baby, Juvi, Fighter, Breeder…"
              checked={lineagePrefs.showGrowth}
              onChange={v => setLineagePrefs(p => ({ ...p, showGrowth: v }))}
            />
            <LineagePrefRow
              label="Elder badge"
              desc="⬡ ELDER indicator"
              checked={lineagePrefs.showElder}
              onChange={v => setLineagePrefs(p => ({ ...p, showElder: v }))}
            />
            <LineagePrefRow
              label="Bloodline Quality"
              desc="Show Bloodline Quality badge on cards and lineage tree"
              checked={lineagePrefs.showBloodlineQuality}
              onChange={v => setLineagePrefs(p => ({ ...p, showBloodlineQuality: v }))}
            />
            <LineagePrefRow
              label="Ticks"
              desc="Growth progress bar"
              checked={lineagePrefs.showTicks}
              onChange={v => setLineagePrefs(p => ({ ...p, showTicks: v }))}
            />
          </div>
        </section>

        {/* ── Steam Accounts (in-game handles) ── */}
        <SteamAccountsCard userId={userId} user={user} addToast={addToast} />

        {/* ── Clan User Management (admin/dev only) ── */}
        {isAdmin(user) && <ClanUsersCard user={user} addToast={addToast} />}

      </div>
    </div>
  )
}

function SteamAccountsCard({ userId, user, addToast }) {
  const [accounts,    setAccounts]    = useState(user?.accounts || [])
  const [newLabel,    setNewLabel]    = useState('')
  const [adding,      setAdding]      = useState(false)
  const [removing,    setRemoving]    = useState(null)

  async function handleAdd() {
    if (!newLabel.trim()) return
    setAdding(true)
    try {
      const res = await window.api.account.add({ userId, label: newLabel.trim() })
      if (res.ok) {
        const updated = [...accounts, { id: res.accountId, label: newLabel.trim() }]
        setAccounts(updated)
        setNewLabel('')
        addToast(`Account "${newLabel.trim()}" added`, 'success')
      } else {
        addToast(res.error || 'Failed to add account', 'error')
      }
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(accountId, label) {
    if (accounts.length <= 1) { addToast('Cannot remove last account', 'error'); return }
    setRemoving(accountId)
    try {
      const res = await window.api.account.remove({ userId, accountId })
      if (res.ok) {
        setAccounts(prev => prev.filter(a => a.id !== accountId))
        addToast(`Account "${label}" removed`, 'info')
      } else {
        addToast(res.error || 'Failed to remove', 'error')
      }
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <section style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px', display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <h3 className="cinzel" style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 4px' }}>
          Steam Accounts
        </h3>
        <p style={{ fontSize:12, color:'var(--hint)', margin:0 }}>
          Each entry is an in-game Steam handle. When adding a dragon, you choose which account owns it.
          You cannot remove your last account.
        </p>
      </div>

      {/* Account list */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {accounts.map(a => (
          <div key={a.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
            <span style={{ fontSize:13, color:'var(--text)' }}>
              {a.id === userId ? '★ ' : ''}{a.label}
              {a.id === userId && <span style={{ fontSize:10, color:'var(--hint)', marginLeft:6 }}>(primary)</span>}
            </span>
            {a.id !== userId && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding:'3px 8px', fontSize:11, color:'var(--muted)' }}
                disabled={removing === a.id}
                onClick={() => handleRemove(a.id, a.label)}
              >
                {removing === a.id ? '…' : '✕'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      <div style={{ display:'flex', gap:8 }}>
        <input
          type="text"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="New Steam handle…"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:13 }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAdd}
          disabled={adding || !newLabel.trim()}
        >
          {adding ? '…' : '+ Add'}
        </button>
      </div>
    </section>
  )
}

function Req({ ok, label }) {
  return (
    <div className={`${styles.req} ${ok ? styles.reqOk : styles.reqNo}`}>
      <span>{ok ? '✓' : '✗'}</span>
      <span>{label}</span>
    </div>
  )
}

function LineagePrefRow({ label, desc, checked, onChange, locked = false }) {
  return (
    <div className={`${styles.settingRow} ${styles.lineagePrefRow}`}>
      <div className={styles.settingInfo}>
        <div className={styles.settingLabel}>
          {label}
          {locked && <span className={styles.optionalTag}>locked</span>}
        </div>
        {desc && <p className={styles.settingDesc}>{desc}</p>}
      </div>
      <label className={`${styles.switch} ${locked ? styles.switchLocked : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={e => !locked && onChange?.(e.target.checked)}
        />
        <span className={styles.slider} />
      </label>
    </div>
  )
}

// ── Clan User Management ──────────────────────────────────────────────────────
function ClanUsersCard({ user, addToast }) {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(null) // userId being updated

  useEffect(() => {
    window.api?.auth.listUsers?.()
      .then(u => setUsers(Array.isArray(u) ? u : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  async function handleRoleChange(targetUserId, newRole) {
    setUpdating(targetUserId)
    try {
      const res = await window.api.auth.updateRole({ userId: targetUserId, role: newRole })
      if (res?.ok) {
        setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u))
        addToast(`Role updated to "${newRole}"`, 'success')
      } else {
        addToast(res?.error || 'Failed to update role', 'error')
      }
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setUpdating(null)
    }
  }

  const ROLE_OPTIONS = [
    { value: 'member', label: '🐉 Member',       color: 'var(--text)' },
    { value: 'admin',  label: '★ Admin',          color: '#c9932a' },
    { value: 'dev',    label: '⚙ Developer',      color: '#5291f5' },
  ]

  return (
    <section style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px' }}>
      <h3 style={{ margin:'0 0 4px', fontSize:14, fontWeight:700 }}>👥 Clan Members</h3>
      <p style={{ margin:'0 0 16px', fontSize:12, color:'var(--muted)' }}>
        Manage roles for all registered clan members. Devs have all admin privileges plus dev tools.
      </p>

      {loading && <p style={{ color:'var(--muted)', fontSize:13 }}>Loading members…</p>}

      {!loading && users.map(u => {
        const isMe = u.id === user.id
        const currentRole = u.role || 'member'
        return (
          <div key={u.id} style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'10px 0', borderBottom:'1px solid var(--border)',
          }}>
            <div style={{
              width:34, height:34, borderRadius:'50%',
              background:'var(--surface2)', display:'flex', alignItems:'center',
              justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0,
              color: currentRole === 'dev' ? '#5291f5' : currentRole === 'admin' ? '#c9932a' : 'var(--muted)',
            }}>
              {(u.displayName || u.username || u.email || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:13 }}>
                {u.displayName || u.username || u.email}
                {isMe && <span style={{ fontSize:10, color:'var(--muted)', marginLeft:6 }}>(you)</span>}
              </div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>{u.email}</div>
            </div>
            <select
              value={currentRole}
              disabled={isMe || updating === u.id}
              onChange={e => handleRoleChange(u.id, e.target.value)}
              style={{
                fontSize:12, padding:'4px 8px', borderRadius:6,
                border:'1px solid var(--border)', background:'var(--surface2)',
                color: currentRole === 'dev' ? '#5291f5' : currentRole === 'admin' ? '#c9932a' : 'var(--text)',
                opacity: isMe ? 0.5 : 1,
                cursor: isMe ? 'not-allowed' : 'pointer',
              }}
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {updating === u.id && <span style={{ fontSize:11, color:'var(--muted)' }}>…</span>}
          </div>
        )
      })}
    </section>
  )
}
