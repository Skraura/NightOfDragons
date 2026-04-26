/**
 * AccountDashboard.jsx — v7.0
 *
 * Shows a per-account species matrix + rich stats charts.
 * Modes: 'mine' (own dragons) | 'clan' (admin, all members)
 */

import { useState, useMemo } from 'react'
import { useApp } from '../App'
import {
  SPECIES_FULL, SPECIES_CONFIG, SKIN_COLORS, SKINS_UNIVERSAL,
} from '../lib/dragonData'
import styles from './AccountDashboard.module.css'

const SPECIES_CODES = Object.keys(SPECIES_FULL) // ['FS','SS','ASD','IR','BS','BW','BIO']

const GROWTH_ICON = { Hatchling: '🥚', Juvenile: '🐉', Adult: '🦖', Elder: '⬡' }
const RARITY_COLOR = { Common: '#aaa', Uncommon: '#4caf50', Rare: '#2196f3', Exotic: '#ff9800', Mutation: '#e040fb' }

// ─── helpers ─────────────────────────────────────────────────────────────────
function skinColor(skin) {
  return SKIN_COLORS?.[skin] || '#888'
}

function speciesCfg(code) {
  const name = SPECIES_FULL[code] || code
  return SPECIES_CONFIG[name] || { color: '#aaa', icon: '🐉' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Tiny colored circle for skin */
function SkinDot({ skin, size = 10 }) {
  const color = skinColor(skin)
  return (
    <span
      title={skin || '—'}
      style={{
        display: 'inline-block', width: size, height: size,
        borderRadius: '50%', background: color,
        border: '1px solid rgba(255,255,255,0.15)',
        flexShrink: 0,
      }}
    />
  )
}

/** Cell for one species slot in the matrix */
function MatrixCell({ dragons }) {
  if (!dragons.length) return <td className={styles.matrixCell} style={{ opacity: 0.2 }}>—</td>

  // Pick the most "prominent" one to show (Elder > Adult > etc.)
  const growthRank = { Elder: 4, Adult: 3, Juvenile: 2, Hatchling: 1 }
  const sorted = [...dragons].sort((a, b) => (growthRank[b.growth] || 0) - (growthRank[a.growth] || 0))
  const best = sorted[0]
  const icon = GROWTH_ICON[best.growth] || '🐉'
  const extraCount = dragons.length - 1

  return (
    <td className={styles.matrixCell}>
      <div className={styles.cellInner} title={dragons.map(d => `${d.ownerUsername || d.player_name || '?'} · ${d.growth || '?'} · ${d.skin_dominant || '?'}`).join('\n')}>
        <span className={styles.checkMark}>✓</span>
        <span className={styles.growthIcon} title={best.growth}>{icon}</span>
        <SkinDot skin={best.skin_dominant} />
        {extraCount > 0 && <span className={styles.extra}>+{extraCount}</span>}
      </div>
    </td>
  )
}

/** Horizontal bar chart row */
function BarRow({ label, value, max, color = 'var(--accent)', width = 160 }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack} style={{ width }}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.barValue}>{value}</span>
    </div>
  )
}

/** Simple SVG pie/donut */
function DonutChart({ slices, size = 120, thickness = 22, title }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <div className={styles.donutEmpty}>No data</div>

  let offset = 0
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2, cy = size / 2

  const paths = slices.map((sl, i) => {
    const pct = sl.value / total
    const dash = pct * circ
    const path = (
      <circle
        key={i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={sl.color}
        strokeWidth={thickness}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={-offset * circ}
        style={{ transition: 'stroke-dasharray 0.4s' }}
      />
    )
    offset += pct
    return path
  })

  return (
    <div className={styles.donutWrap}>
      {title && <div className={styles.donutTitle}>{title}</div>}
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={thickness} />
        {paths}
      </svg>
      <div className={styles.donutLegend}>
        {slices.filter(s => s.value > 0).map((s, i) => (
          <div key={i} className={styles.donutLegendRow}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
            <span>{s.label}</span>
            <span className={styles.donutLegendVal}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Vertical bar chart (mini sparkline-ish) */
function VertBarChart({ data, color = 'var(--accent)', height = 80, title }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className={styles.vertChartWrap}>
      {title && <div className={styles.chartTitle}>{title}</div>}
      <div className={styles.vertBars} style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className={styles.vertBarCol} title={`${d.label}: ${d.value}`}>
            <div
              className={styles.vertBarFill}
              style={{ height: `${(d.value / max) * 100}%`, background: color }}
            />
            <div className={styles.vertBarX}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AccountDashboard({ dragons, clanDragons, allUsers, mode, onModeChange }) {
  const { user } = useApp()
  const isAdmin = !!user?.isAdmin

  // Build the working dataset
  const workingDragons = mode === 'clan' ? clanDragons : dragons

  // Resolve account rows: group by (user_id, account_id)
  const accountRows = useMemo(() => {
    const map = new Map()
    workingDragons.forEach(d => {
      const key = d.account_id || d.user_id
      if (!map.has(key)) {
        map.set(key, {
          accountId: key,
          userId: d.user_id,
          label: d.ownerUsername || d.player_name || key,
          owner: d.ownerDisplayName || (allUsers.find(u => u.id === d.user_id)?.displayName) || '?',
          dragons: [],
        })
      }
      map.get(key).dragons.push(d)
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [workingDragons, allUsers])

  // ── Derived stats ──
  const total    = workingDragons.length
  const alive    = workingDragons.filter(d => !d.is_dead)
  const dead     = workingDragons.filter(d => d.is_dead)
  const elders   = alive.filter(d => d.growth === 'Elder')
  const hungry   = alive.filter(d => d.is_hungry)
  const fighters = alive.filter(d => d.clan_role === 'Fighter')
  const breeders = alive.filter(d => d.clan_role === 'Breeder')

  // Species distribution
  const speciesCounts = SPECIES_CODES.map(code => ({
    label: code,
    value: alive.filter(d => d.species === code).length,
    color: speciesCfg(code).color,
  }))

  // Growth distribution
  const growthOrder = ['Hatchling', 'Juvenile', 'Adult', 'Elder']
  const growthColors = { Hatchling: '#4db6ac', Juvenile: '#7c5cbf', Adult: '#e5713a', Elder: '#7ecfcf' }
  const growthCounts = growthOrder.map(g => ({
    label: g, value: alive.filter(d => d.growth === g).length, color: growthColors[g],
  }))

  // Gender split
  const males   = alive.filter(d => d.gender === 'M').length
  const females = alive.filter(d => d.gender === 'F').length

  // Skin distribution (top 8)
  const skinMap = {}
  alive.forEach(d => { if (d.skin_dominant) skinMap[d.skin_dominant] = (skinMap[d.skin_dominant] || 0) + 1 })
  const topSkins = Object.entries(skinMap).sort((a, b) => b[1] - a[1]).slice(0, 8)

  // Ticks distribution
  const tickGroups = { '0': 0, '1-2': 0, '3-4': 0, '5-6': 0, '7+': 0 }
  alive.forEach(d => {
    const t = parseFloat(d.ticks) || 0
    if (t === 0) tickGroups['0']++
    else if (t <= 2) tickGroups['1-2']++
    else if (t <= 4) tickGroups['3-4']++
    else if (t <= 6) tickGroups['5-6']++
    else tickGroups['7+']++
  })

  // Dragons per account/user (vertical bars)
  const chartData = useMemo(() => {
    if (mode === 'clan') {
      const userMap = new Map()
      workingDragons.forEach(d => {
        if (d.is_dead) return
        const uid = d.user_id
        if (!userMap.has(uid)) {
          const name = allUsers.find(u => u.id === uid)?.displayName || d.ownerDisplayName || '?'
          userMap.set(uid, { label: name, value: 0 })
        }
        userMap.get(uid).value++
      })
      return Array.from(userMap.values())
        .map(u => ({
          label: u.label.length > 8 ? u.label.slice(0, 7) + '…' : u.label,
          value: u.value,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15)
    }
    return accountRows.map(r => ({
      label: r.label.length > 8 ? r.label.slice(0, 7) + '…' : r.label,
      value: r.dragons.filter(d => !d.is_dead).length,
    }))
  }, [mode, workingDragons, accountRows, allUsers])

  // Dragons per species per user (for admin)
  const perUserSpecies = isAdmin
    ? (() => {
        const byUser = {}
        workingDragons.forEach(d => {
          const uid = d.user_id
          const name = allUsers.find(u => u.id === uid)?.displayName || uid
          if (!byUser[name]) byUser[name] = {}
          byUser[name][d.species] = (byUser[name][d.species] || 0) + 1
        })
        return byUser
      })()
    : null

  // Bloodline quality distribution
  const bqOrder = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E', 'F']
  const bqColors = {
    'A': '#FFD700', 'A-': '#FFC107',
    'B+': '#8BC34A', 'B': '#4CAF50', 'B-': '#66BB6A',
    'C+': '#2196F3', 'C': '#42A5F5', 'C-': '#64B5F6',
    'D+': '#9C27B0', 'D': '#AB47BC', 'D-': '#CE93D8',
    'E': '#F44336', 'F': '#B71C1C',
  }
  const bqCounts = bqOrder.map(bq => ({
    label: bq, value: alive.filter(d => d.bloodline_quality === bq).length,
    color: bqColors[bq] || '#aaa',
  })).filter(b => b.value > 0)

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h2 className={`cinzel ${styles.title}`}>Account Dashboard</h2>
          <p className={styles.sub}>{alive.length} active · {dead.length} dead · {accountRows.length} account{accountRows.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <div className={styles.modeToggle}>
            <button
              className={`btn btn-sm ${mode === 'mine' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onModeChange('mine')}
            >My Dragons</button>
            <button
              className={`btn btn-sm ${mode === 'clan' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onModeChange('clan')}
            >★ All Members</button>
          </div>
        )}
      </div>

      {/* ── Species Matrix ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Species Matrix</h3>
        <div className={styles.tableWrap}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th className={styles.thAccount}>Account</th>
                {mode === 'clan' && <th className={styles.thOwner}>Owner</th>}
                {SPECIES_CODES.map(code => {
                  const cfg = speciesCfg(code)
                  return (
                    <th key={code} className={styles.thSpecies} title={SPECIES_FULL[code]}>
                      <div className={styles.thSpeciesInner}>
                        <span style={{ color: cfg.color }}>{cfg.icon}</span>
                        <span className={styles.speciesCode}>{code}</span>
                      </div>
                    </th>
                  )
                })}
                <th className={styles.thTotal}>Total</th>
              </tr>
            </thead>
            <tbody>
              {accountRows.map(row => {
                const aliveRow = row.dragons.filter(d => !d.is_dead)
                return (
                  <tr key={row.accountId} className={styles.matrixRow}>
                    <td className={styles.tdAccount}>
                      <span className={styles.accountName}>{row.label}</span>
                      {row.dragons.some(d => d.is_dead) && (
                        <span className={styles.deadCount} title="Dead dragons">💀 {row.dragons.filter(d => d.is_dead).length}</span>
                      )}
                    </td>
                    {mode === 'clan' && (
                      <td className={styles.tdOwner}>{row.owner}</td>
                    )}
                    {SPECIES_CODES.map(code => (
                      <MatrixCell
                        key={code}
                        dragons={aliveRow.filter(d => d.species === code)}
                      />
                    ))}
                    <td className={styles.tdTotal}>{aliveRow.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.matrixLegend}>
          <span>✓ = has at least one</span>
          <span>{GROWTH_ICON.Hatchling} Hatchling · {GROWTH_ICON.Juvenile} Juvenile · {GROWTH_ICON.Adult} Adult · {GROWTH_ICON.Elder} Elder</span>
          <span>● = dominant skin colour</span>
          <span>+N = additional dragons of that species</span>
        </div>
      </div>

      {/* ── Quick stats cards ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Clan Stats</h3>
        <div className={styles.statCards}>
          {[
            { label: 'Total Dragons', value: total,         color: 'var(--accent)' },
            { label: 'Alive',         value: alive.length,  color: '#4caf50' },
            { label: 'Dead',          value: dead.length,   color: '#e57373' },
            { label: 'Elders',        value: elders.length, color: '#7ecfcf' },
            { label: 'Hungry',        value: hungry.length, color: '#ff9800' },
            { label: 'Fighters',      value: fighters.length, color: '#ef5350' },
            { label: 'Breeders',      value: breeders.length, color: '#ab47bc' },
            { label: 'Accounts',      value: accountRows.length, color: 'var(--muted)' },
          ].map(s => (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statCardValue} style={{ color: s.color }}>{s.value}</div>
              <div className={styles.statCardLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts row 1 ── */}
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <DonutChart
            title="By Species"
            slices={speciesCounts}
            size={130}
            thickness={24}
          />
        </div>

        <div className={styles.chartCard}>
          <DonutChart
            title="By Growth Stage"
            slices={growthCounts}
            size={130}
            thickness={24}
          />
        </div>

        <div className={styles.chartCard}>
          <DonutChart
            title="By Gender"
            slices={[
              { label: 'Male ♂',   value: males,   color: '#64b5f6' },
              { label: 'Female ♀', value: females, color: '#f48fb1' },
            ]}
            size={130}
            thickness={24}
          />
        </div>

        <div className={styles.chartCard}>
          <DonutChart
            title="By Role"
            slices={[
              { label: 'Fighter', value: fighters.length, color: '#ef5350' },
              { label: 'Breeder', value: breeders.length, color: '#ab47bc' },
              { label: 'None',    value: alive.filter(d => !d.clan_role).length, color: '#555' },
            ]}
            size={130}
            thickness={24}
          />
        </div>
      </div>

      {/* ── Charts row 2 ── */}
      <div className={styles.chartsRow}>
        {/* Top skins */}
        <div className={styles.chartCard} style={{ flex: 2, minWidth: 220 }}>
          <div className={styles.chartTitle}>Top Skins</div>
          <div className={styles.skinList}>
            {topSkins.length === 0
              ? <span style={{ color: 'var(--hint)', fontSize: 13 }}>No data</span>
              : topSkins.map(([skin, cnt]) => (
                <BarRow
                  key={skin}
                  label={skin}
                  value={cnt}
                  max={topSkins[0][1]}
                  color={skinColor(skin)}
                  width={110}
                />
              ))
            }
          </div>
        </div>

        {/* Bloodline quality */}
        <div className={styles.chartCard} style={{ flex: 2, minWidth: 220 }}>
          <div className={styles.chartTitle}>Bloodline Quality</div>
          {bqCounts.length === 0
            ? <span style={{ color: 'var(--hint)', fontSize: 13 }}>No data</span>
            : <div className={styles.skinList}>
              {bqCounts.map(b => (
                <BarRow
                  key={b.label}
                  label={b.label}
                  value={b.value}
                  max={bqCounts[0].value}
                  color={b.color}
                  width={110}
                />
              ))}
            </div>
          }
        </div>

        {/* Ticks */}
        <div className={styles.chartCard} style={{ flex: 1, minWidth: 160 }}>
          <VertBarChart
            title="Ticks Distribution"
            color="var(--elder)"
            height={90}
            data={Object.entries(tickGroups).map(([label, value]) => ({ label, value }))}
          />
        </div>

        {/* Dragons per account/user */}
        <div className={styles.chartCard} style={{ flex: 1.5, minWidth: 180 }}>
          <VertBarChart
            title={mode === 'clan' ? "Dragons per User" : "Dragons per Account"}
            color="var(--accent)"
            height={90}
            data={chartData}
          />
        </div>
      </div>

      {/* ── Admin only: per-user species breakdown ── */}
      {isAdmin && mode === 'clan' && perUserSpecies && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Species per Member</h3>
          <div className={styles.tableWrap}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th className={styles.thAccount}>Member</th>
                  {SPECIES_CODES.map(code => (
                    <th key={code} className={styles.thSpecies} title={SPECIES_FULL[code]}>
                      <div className={styles.thSpeciesInner}>
                        <span style={{ color: speciesCfg(code).color }}>{speciesCfg(code).icon}</span>
                        <span className={styles.speciesCode}>{code}</span>
                      </div>
                    </th>
                  ))}
                  <th className={styles.thTotal}>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(perUserSpecies).sort((a, b) => a[0].localeCompare(b[0])).map(([userName, counts]) => {
                  const rowTotal = Object.values(counts).reduce((s, n) => s + n, 0)
                  return (
                    <tr key={userName} className={styles.matrixRow}>
                      <td className={styles.tdAccount}><span className={styles.accountName}>{userName}</span></td>
                      {SPECIES_CODES.map(code => (
                        <td key={code} className={styles.matrixCell}>
                          {counts[code] ? (
                            <div className={styles.cellInner}>
                              <span className={styles.checkMark} style={{ color: speciesCfg(code).color }}>✓</span>
                              {counts[code] > 1 && <span className={styles.extra}>×{counts[code]}</span>}
                            </div>
                          ) : <span style={{ opacity: 0.2 }}>—</span>}
                        </td>
                      ))}
                      <td className={styles.tdTotal}>{rowTotal}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
