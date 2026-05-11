/**
 * CrystalTable.jsx — Beta1.3
 *
 * Crystal dashboard table.
 * Columns: Green | Cyan | Blue | Magenta | Red | Yellow
 * Rows:    one per account (Steam handle)
 *
 * Day mode:  tick = dragon's elder % falls in that color band
 * Night mode: tick = dragon's species element matches that crystal
 *
 * Members see only their own accounts.
 * Admins/Devs also see all members' accounts.
 */

import { useState, useMemo } from 'react'
import { isAdmin } from '../lib/roleUtils'
import {
  CRYSTAL_COLORS, CRYSTAL_CSS,
  getDayCrystal, getNightCrystal,
  SPECIES_ELEMENT,
} from '../lib/dragonData'
import { calcElderProgress, ELDER_DATA } from '../lib/nestingEngine'
import { useApp } from '../App'
import styles from './CrystalTable.module.css'

export default function CrystalTable({ dragons = [], clanDragons = [], allUsers = [] }) {
  const { user } = useApp()
  const userIsAdmin = isAdmin(user)
  const [isNight, setIsNight] = useState(false)
  const [viewMode, setViewMode] = useState('mine')   // 'mine' | 'all'

  // Build full dragon pool for admins (clan) or just own for members
  const pool = (userIsAdmin && viewMode === 'all')
    ? [...dragons, ...clanDragons].filter((d, i, arr) => !d.is_dead && arr.findIndex(x => x.id === d.id) === i)
    : dragons.filter(d => !d.is_dead)

  // Collect unique accounts: { key, label, userId }
  // 'mine' mode (or non-admin): own accounts only.
  // 'all' mode (admin only): all members' accounts inferred from pool.
  const accounts = useMemo(() => {
    const seen = new Map()

    if (userIsAdmin && viewMode === 'all') {
      // Build from allUsers for clean labels
      allUsers.forEach(u => {
        const accs = u.accounts || [{ id: u.id, label: u.displayName || u.username || u.email }]
        accs.forEach(a => {
          const key = `${u.id}::${a.id}`
          if (!seen.has(key)) seen.set(key, { key, label: a.label || u.displayName || u.username, userId: u.id, accountId: a.id })
        })
      })
      // Also catch any accounts from pool dragons not yet in allUsers
      pool.forEach(d => {
        const key = `${d.user_id}::${d.account_id || d.user_id}`
        if (!seen.has(key)) seen.set(key, {
          key,
          label: d.player_name || d.ownerUsername || 'Unknown',
          userId: d.user_id,
          accountId: d.account_id || d.user_id,
        })
      })
    } else {
      // Own accounts only (members always; admins in 'mine' mode)
      const accs = user?.accounts || [{ id: user?.id, label: user?.username }]
      accs.forEach(a => {
        const key = `${user.id}::${a.id}`
        seen.set(key, { key, label: a.label || user.username, userId: user.id, accountId: a.id })
      })
    }

    return Array.from(seen.values())
  }, [pool, allUsers, user, userIsAdmin, viewMode])

  // For each account × crystal, gather matching dragons
  function getDragonsForCell(accountKey, crystal) {
    const acc = accounts.find(a => a.key === accountKey)
    if (!acc) return []
    return pool.filter(d => {
      // Match account
      const dAccKey = `${d.user_id}::${d.account_id || d.user_id}`
      if (dAccKey !== accountKey && d.player_name !== acc.label && d.account_id !== acc.accountId) {
        // fallback: match by player_name
        if (d.player_name !== acc.label) return false
      }
      // Match crystal
      if (isNight) {
        return getNightCrystal(d.species) === crystal
      } else {
        // Need elder progress %
        if (!d.species || !ELDER_DATA[d.species]) return false
        const progress = calcElderProgress(d.species, d.ticks ?? 0)
        if (!progress || progress.isElder) return false
        return getDayCrystal(progress.pct) === crystal
      }
    })
  }

  // Group accounts by user for display
  const accountsByUser = useMemo(() => {
    if (!userIsAdmin) return [{ userId: user.id, userName: user.displayName || user.username, accounts: accounts }]
    const groups = new Map()
    accounts.forEach(a => {
      if (!groups.has(a.userId)) {
        const u = allUsers.find(u => u.id === a.userId)
        groups.set(a.userId, {
          userId: a.userId,
          userName: u?.displayName || u?.username || u?.email || 'Unknown',
          accounts: [],
        })
      }
      groups.get(a.userId).accounts.push(a)
    })
    return Array.from(groups.values())
  }, [accounts, allUsers, user, userIsAdmin])

  const totalCells = accounts.reduce((sum, acc) => {
    return sum + CRYSTAL_COLORS.filter(c => getDragonsForCell(acc.key, c).length > 0).length
  }, 0)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={`cinzel ${styles.title}`}>Crystal Schedule</h2>
          <p className={styles.sub}>
            {isNight ? 'Night — crystals by element' : 'Day — crystals by elder %'}
            {' · '}{totalCells} active dragon{totalCells !== 1 ? 's' : ''} need crystals
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* My Dragons / All Members switch (Admin/Dev only) */}
          {userIsAdmin && (
            <div style={{ display: 'flex', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--bg-border)', overflow: 'hidden' }}>
              {[['mine', 'My Dragons'], ['all', 'All Members']].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: viewMode === mode ? 'var(--accent)' : 'transparent',
                    color: viewMode === mode ? '#fff' : 'var(--text-muted)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >{label}</button>
              ))}
            </div>
          )}
          {/* Day / Night toggle */}
          <button
            className={`${styles.toggle} ${isNight ? styles.toggleNight : styles.toggleDay}`}
            onClick={() => setIsNight(n => !n)}
            title={isNight ? 'Switch to Day mode' : 'Switch to Night mode'}
          >
            <span className={styles.toggleIcon}>{isNight ? '🌙' : '☀️'}</span>
            <span className={styles.toggleTrack}>
              <span className={`${styles.toggleThumb} ${isNight ? styles.thumbRight : ''}`} />
            </span>
            <span className={styles.toggleLabel}>{isNight ? 'Night' : 'Day'}</span>
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.accountTh}>Account</th>
              {CRYSTAL_COLORS.map(c => (
                <th key={c} className={styles.crystalTh} style={{ color: CRYSTAL_CSS[c].text, borderBottom: `2px solid ${CRYSTAL_CSS[c].border}` }}>
                  <span className={styles.crystalDot} style={{ background: CRYSTAL_CSS[c].text }} />
                  {c}
                  {!isNight && (
                    <div className={styles.crystalRange}>
                      {c === 'Green'   && '0–15%'}
                      {c === 'Cyan'    && '15–30%'}
                      {c === 'Blue'    && '30–45%'}
                      {c === 'Magenta' && '45–60%'}
                      {c === 'Red'     && '60–75%'}
                      {c === 'Yellow'  && '75–100%'}
                    </div>
                  )}
                  {isNight && (
                    <div className={styles.crystalRange}>
                      {c === 'Green'   && 'Acid'}
                      {c === 'Cyan'    && 'Ice/Frost'}
                      {c === 'Blue'    && 'Plasma'}
                      {c === 'Magenta' && 'Lightning'}
                      {c === 'Red'     && 'Fire'}
                      {c === 'Yellow'  && 'Venom'}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accountsByUser.map(group => (
              group.accounts.map((acc, accIdx) => {
                const cells = CRYSTAL_COLORS.map(c => getDragonsForCell(acc.key, c))
                const hasAny = cells.some(c => c.length > 0)
                return (
                  <tr key={acc.key} className={`${styles.row} ${!hasAny ? styles.rowEmpty : ''}`}>
                    <td className={styles.accountCell}>
                      {userIsAdmin && accIdx === 0 && (
                        <div className={styles.groupLabel}>{group.userName}</div>
                      )}
                      <div className={styles.accountLabel}>{acc.label}</div>
                    </td>
                    {cells.map((matches, ci) => (
                      <td
                        key={CRYSTAL_COLORS[ci]}
                        className={styles.crystalCell}
                        style={matches.length > 0 ? {
                          background: CRYSTAL_CSS[CRYSTAL_COLORS[ci]].bg,
                          borderColor: CRYSTAL_CSS[CRYSTAL_COLORS[ci]].border,
                        } : {}}
                      >
                        {matches.length > 0 && (
                          <div className={styles.cellContent}>
                            <span className={styles.tick} style={{ color: CRYSTAL_CSS[CRYSTAL_COLORS[ci]].text }}>✓</span>
                            <div className={styles.dragonPips}>
                              {matches.map(d => (
                                <span
                                  key={d.id}
                                  className={styles.dragonPip}
                                  title={`${d.player_name || d.name || '?'} (${d.species}) ${
                                    isNight
                                      ? `— ${SPECIES_ELEMENT[d.species]?.element || ''}`
                                      : `— ${Math.round((calcElderProgress(d.species, d.ticks ?? 0)?.pct ?? 0) * 100)}%`
                                  }`}
                                >
                                  {d.species}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.emptyRow}>No accounts found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {isNight ? (
          <>
            <span className={styles.legendItem}><b>Night mode:</b> crystals determined by species element</span>
            <span className={styles.legendNote}>Blue (Plasma) and Cyan (Ice/Frost) not yet in game</span>
          </>
        ) : (
          <span className={styles.legendItem}><b>Day mode:</b> crystals determined by elder % · Elders and eggs excluded · White crystal (0%) not shown</span>
        )}
      </div>
    </div>
  )
}
