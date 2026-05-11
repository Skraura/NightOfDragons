import { useState, useMemo } from 'react'
import { GRADES, ALL_SKINS, STAT_LABELS, ALL_STAT_KEYS, getGradeClass, SPECIES_LIST } from '../lib/dragonData'
import { calcStatOutcome, calcSkinOutcome, getBroodCrit, skinRarityLabel, GRADE_TO_NUM } from '../lib/nestingEngine'
import { useApp } from '../App'
import { isAdmin, canSeeBreederContent } from '../lib/roleUtils'
import styles from './NestingCalculator.module.css'

const STAT_KEYS = ALL_STAT_KEYS

const emptyParent = () =>
  Object.fromEntries([
    ['species', ''],
    ['skin_dominant', ''],
    ['skin_recessive', ''],
    ...STAT_KEYS.map(k => [k, '']),
  ])

/** Returns true if dragonA and dragonB share at least one direct parent */
function shareParent(a, b) {
  if (!a || !b) return false
  const parentsA = [a.father_id, a.mother_id].filter(Boolean)
  const parentsB = [b.father_id, b.mother_id].filter(Boolean)
  return parentsA.some(p => parentsB.includes(p))
}

export default function NestingCalculator({ dragons = [] }) {
  const { user } = useApp()
  const userIsAdmin       = isAdmin(user)
  const userCanSeeBreeder = canSeeBreederContent(user)

  const [momId, setMomId]   = useState('')
  const [dadId, setDadId]   = useState('')
  const [mom, setMom]       = useState(emptyParent())
  const [dad, setDad]       = useState(emptyParent())
  const [tries, setTries]   = useState(1)
  const [tab, setTab]       = useState('stats')

  // Popup state
  const [popup, setPopup] = useState(null) // { side: 'mom'|'dad', firstDragon: DragonObject }

  // When a dragon is selected from registry, fill parent form
  function selectDragon(side, id) {
    const d = dragons.find(x => x.id === id)
    if (!d) {
      if (side === 'mom') { setMom(emptyParent()); setMomId('') }
      else { setDad(emptyParent()); setDadId('') }
      return
    }
    const filled = emptyParent()
    Object.keys(filled).forEach(k => {
      if (d[k] !== undefined && d[k] !== null) filled[k] = String(d[k])
    })
    if (side === 'mom') { setMom(filled); setMomId(id) }
    else { setDad(filled); setDadId(id) }
  }

  // Called after the FIRST parent is selected — opens popup for opposite side
  function onFirstParentSelected(side, id) {
    selectDragon(side, id)
    const firstDragon = dragons.find(x => x.id === id)
    if (firstDragon) {
      setPopup({ side: side === 'mom' ? 'dad' : 'mom', firstDragon })
    }
  }

  function onPopupSelect(id) {
    if (!popup) return
    selectDragon(popup.side, id)
    setPopup(null)
  }

  function onPopupClose() { setPopup(null) }

  // Dragon candidates for the popup (opposite gender, same species, no shared parents)
  const popupCandidates = useMemo(() => {
    if (!popup) return []
    const { side, firstDragon } = popup
    const oppositeGender = firstDragon.gender === 'M' ? 'F' : 'M'
    return dragons.filter(d => {
      if (d.id === firstDragon.id) return false
      if (d.is_egg) return false
      if (d.species !== firstDragon.species) return false
      if (d.gender && d.gender !== oppositeGender) return false
      if (shareParent(d, firstDragon)) return false
      return true
    })
  }, [popup, dragons])

  // Breeder pairings: same species, opposite gender (known), no shared parents, no eggs
  // Visible to: Breeder, Admin, Dev
  const breederPairings = useMemo(() => {
    if (!userCanSeeBreeder) return []
    const breeders = dragons.filter(d => d.clan_role === 'Breeder' && !d.is_egg && !d.is_dead)
    const pairs = []
    const females = breeders.filter(d => d.gender === 'F')
    const males   = breeders.filter(d => d.gender === 'M')
    females.forEach(f => {
      males.forEach(m => {
        if (f.species !== m.species) return
        if (shareParent(f, m)) return
        pairs.push({ female: f, male: m })
      })
    })
    return pairs
  }, [dragons, userCanSeeBreeder])

  const speciesMismatch =
    mom.species && dad.species && mom.species !== dad.species

  function setParentField(side, key, val) {
    if (side === 'mom') setMom(p => ({ ...p, [key]: val }))
    else setDad(p => ({ ...p, [key]: val }))
  }

  function applyBreederPair(pair) {
    selectDragon('mom', pair.female.id)
    selectDragon('dad', pair.male.id)
  }

  // ── Compute outcomes ──────────────────────────────────────────────────────
  const statOutcomes = useMemo(() => {
    return STAT_KEYS.map(key => ({
      key,
      label: STAT_LABELS[key],
      ...calcStatOutcome(mom[key], mom[key], dad[key], dad[key]),
      momDom: mom[key], dadDom: dad[key],
    }))
  }, [mom, dad])

  const skinOutcome = useMemo(() => {
    return calcSkinOutcome(mom.skin_dominant, mom.skin_recessive, dad.skin_dominant, dad.skin_recessive)
  }, [mom, dad])

  const broodCrit = useMemo(() => getBroodCrit(tries), [tries])

  const hasStats  = STAT_KEYS.some(k => mom[k] || dad[k])
  const hasSkins  = mom.skin_dominant || dad.skin_dominant

  const firstSelected = momId ? dragons.find(d => d.id === momId) : dadId ? dragons.find(d => d.id === dadId) : null
  const firstSide = momId ? 'mom' : dadId ? 'dad' : null

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h2 className={`cinzel ${styles.title}`}>Nesting Calculator</h2>
        <p className={styles.sub}>Predict offspring stats and skins from two parents</p>
      </div>

      <div className={styles.layout}>
        {/* ── Breeder Pairings (Admin/Dev only) ── */}
        {userCanSeeBreeder && breederPairings.length > 0 && (
          <div className={styles.breederSection}>
            <div className={styles.breederHeader}>
              <span className={styles.breederTitle}>🐣 Breeder Pairings</span>
              <span className={styles.breederSub}>{breederPairings.length} compatible pair{breederPairings.length !== 1 ? 's' : ''}</span>
            </div>
            <div className={styles.breederList}>
              {breederPairings.map((pair, i) => (
                <button
                  key={i}
                  className={styles.breederPair}
                  onClick={() => applyBreederPair(pair)}
                  title="Click to load this pair into the calculator"
                >
                  <span className={styles.breederFemale}>♀ {pair.female.player_name || pair.female.name || 'Unknown'}</span>
                  <span className={styles.breederX}>×</span>
                  <span className={styles.breederMale}>♂ {pair.male.player_name || pair.male.name || 'Unknown'}</span>
                  <span className={styles.breederSpecies}>{pair.female.species}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Parents ── */}
        <div className={styles.parents}>
          <ParentPanel
            side="mom" label="Mother"
            parentId={momId}
            parent={mom}
            dragons={dragons}
            otherParentId={dadId}
            onSelectFirst={id => onFirstParentSelected('mom', id)}
            onSelectDragon={id => selectDragon('mom', id)}
            onOpenPopup={() => firstSelected && setPopup({ side: 'dad', firstDragon: firstSelected })}
            showPopupBtn={!!momId && !dadId}
            onChange={(key, val) => setParentField('mom', key, val)}
          />
          <div className={styles.vs}><span>×</span></div>
          <ParentPanel
            side="dad" label="Father"
            parentId={dadId}
            parent={dad}
            dragons={dragons}
            otherParentId={momId}
            onSelectFirst={id => onFirstParentSelected('dad', id)}
            onSelectDragon={id => selectDragon('dad', id)}
            onOpenPopup={() => firstSelected && setPopup({ side: 'mom', firstDragon: firstSelected })}
            showPopupBtn={!!dadId && !momId}
            onChange={(key, val) => setParentField('dad', key, val)}
          />
        </div>

        {/* ── Species mismatch warning ── */}
        {speciesMismatch && (
          <div style={{
            background: 'rgba(196,74,74,0.15)',
            border: '1px solid rgba(196,74,74,0.4)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '12px',
            color: '#e07070',
            fontSize: '13px',
          }}>
            ⚠️ Cross-species nesting is not possible. Please select two dragons of the same species.
          </div>
        )}

        {/* ── Results ── */}
        <div className={styles.results}>
          {/* Tabs */}
          <div className={styles.tabs}>
            {[['stats','Stats'],['skins','Skins'],['brood','Brood Crits']].map(([id, lbl]) => (
              <button
                key={id}
                className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
                onClick={() => setTab(id)}
              >{lbl}</button>
            ))}
          </div>

          {/* Stats tab */}
          {tab === 'stats' && (
            <div className={styles.tabBody}>
              {!hasStats && (
                <div className={styles.empty}>Enter parent stats to see offspring predictions</div>
              )}
              {hasStats && (
                <div className={styles.statResults}>
                  <div className={styles.statResultHeader}>
                    <span>Stat</span>
                    <span>Mother</span>
                    <span>Father</span>
                    <span>Child Dom</span>
                    <span>Crit (+1)</span>
                    <span>Super (+2)</span>
                    <span>Child Recc</span>
                  </div>
                  {statOutcomes.filter(o => o.momDom || o.dadDom).map(o => (
                    <div key={o.key} className={styles.statResultRow}>
                      <span className={styles.statName}>{o.label}</span>
                      <GradeCell grade={o.momDom} />
                      <GradeCell grade={o.dadDom} />
                      <GradeCell grade={o.childDom} highlight />
                      <GradeCell grade={o.critDom} />
                      <GradeCell grade={o.superCritDom} />
                      <GradeCell grade={o.childRecc} muted />
                    </div>
                  ))}
                  <p className={styles.note}>
                    * Child Dom = best possible dominant. Crit/Super Crit require luck (see Brood Crits tab).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Skins tab */}
          {tab === 'skins' && (
            <div className={styles.tabBody}>
              {!hasSkins && (
                <div className={styles.empty}>Enter parent skins to see offspring predictions</div>
              )}
              {hasSkins && (
                <>
                  <div className={styles.skinParents}>
                    <SkinTag label="Mom Dom"  skin={mom.skin_dominant}  />
                    <SkinTag label="Mom Recc" skin={mom.skin_recessive} />
                    <SkinTag label="Dad Dom"  skin={dad.skin_dominant}  />
                    <SkinTag label="Dad Recc" skin={dad.skin_recessive} />
                  </div>
                  <div className={styles.skinOutcomeHeader}>
                    <span>Child Dominant</span>
                    <span>Child Recessive</span>
                    <span>Likelihood</span>
                  </div>
                  {skinOutcome.outcomes.length === 0 && (
                    <div className={styles.empty}>No valid skin combinations found</div>
                  )}
                  {skinOutcome.outcomes.map((o, i) => (
                    <div key={i} className={`${styles.skinOutcomeRow} ${i === 0 ? styles.skinOutcomeBest : ''}`}>
                      <div className={styles.skinCell}>
                        <span className={styles.skinName}>{o.dom}</span>
                        <span className={styles.skinRarity}>{o.domRarity}</span>
                      </div>
                      <div className={styles.skinCell}>
                        <span className={styles.skinName}>{o.recc}</span>
                        <span className={styles.skinRarity}>{o.reccRarity}</span>
                      </div>
                      <span className={`${styles.weight} ${styles['weight' + o.weight]}`}>{o.weight}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Brood crits tab */}
          {tab === 'brood' && (
            <div className={styles.tabBody}>
              <div className={styles.broodHeader}>
                <div className={styles.broodControl}>
                  <label>Number of tries</label>
                  <div className={styles.triesRow}>
                    {[1,2,3,4,5,6,7,10].map(t => (
                      <button
                        key={t}
                        className={`${styles.triesBtn} ${tries === t ? styles.triesBtnActive : ''}`}
                        onClick={() => setTries(t)}
                      >{t}{t === 10 ? '+' : ''}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.broodGrid}>
                <BroodStat label="Success chance" value={`${(broodCrit.ingame * 100).toFixed(0)}%`} color="var(--green)" big />
                <BroodStat label="Crit (+1 grade)" value={`${(broodCrit.crit * 100).toFixed(1)}%`} color="var(--accent)" />
                <BroodStat label="Super Crit (+2)" value={`${(broodCrit.superCrit * 100).toFixed(1)}%`} color="var(--grade-axx)" />
                <BroodStat label="Fail (nothing)"  value={`${(broodCrit.fail * 100).toFixed(1)}%`} color="var(--text-muted)" />
                <BroodStat label="Super Fail"      value={`${(broodCrit.superFail * 100).toFixed(1)}%`} color="var(--red)" />
              </div>

              <div className={styles.broodBar}>
                <div className={styles.broodBarFill} style={{ width: `${broodCrit.ingame * 100}%`, background: 'var(--green)' }} />
              </div>

              <p className={styles.note}>
                Higher Fertility mutation points reduce your failure rate more slowly.
                You can try each stat as many times as you want per nesting.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mate Selection Popup ── */}
      {popup && (
        <MatePopup
          side={popup.side}
          firstDragon={popup.firstDragon}
          candidates={popupCandidates}
          onSelect={onPopupSelect}
          onClose={onPopupClose}
        />
      )}
    </div>
  )
}

// ── Mate selection popup ──────────────────────────────────────────────────────

function MatePopup({ side, firstDragon, candidates, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const label = side === 'dad' ? 'Father' : 'Mother'
  const genderIcon = side === 'dad' ? '♂' : '♀'

  const filtered = candidates.filter(d => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (d.player_name || '').toLowerCase().includes(q) ||
      (d.name || '').toLowerCase().includes(q) ||
      (d.species || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className={styles.popupOverlay} onClick={onClose}>
      <div className={styles.popupBox} onClick={e => e.stopPropagation()}>
        <div className={styles.popupHeader}>
          <div>
            <h3 className={`cinzel ${styles.popupTitle}`}>
              {genderIcon} Select {label}
            </h3>
            <p className={styles.popupSub}>
              Same species as <strong>{firstDragon.player_name || firstDragon.name || 'selected dragon'}</strong> ({firstDragon.species}) · opposite gender · no shared parents
            </p>
          </div>
          <button className={styles.popupClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.popupSearch}>
          <input
            autoFocus
            placeholder="Search by account…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.popupSearchInput}
          />
        </div>
        <div className={styles.popupList}>
          {filtered.length === 0 && (
            <div className={styles.popupEmpty}>
              {candidates.length === 0
                ? `No compatible ${label.toLowerCase()}s found. Check species, gender, and parentage.`
                : 'No results match your search.'}
            </div>
          )}
          {filtered.map(d => (
            <button key={d.id} className={styles.popupItem} onClick={() => onSelect(d.id)}>
              <span className={styles.popupItemGender}>{d.gender === 'M' ? '♂' : d.gender === 'F' ? '♀' : '?'}</span>
              <span className={styles.popupItemName}>{d.player_name || d.name || 'Unknown'}</span>
              <span className={styles.popupItemSpecies}>{d.species}</span>
              {d.clan_role && <span className={styles.popupItemRole}>{d.clan_role}</span>}
              {d.bloodline_quality && <span className={styles.popupItemBQ}>{d.bloodline_quality}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ParentPanel({ side, label, parentId, parent, dragons, otherParentId, onSelectFirst, onSelectDragon, onChange }) {
  const [collapsed, setCollapsed] = useState(false)
  const genderFilter = side === 'mom' ? 'F' : 'M'

  // Filter by gender, allow unknown-gender dragons
  const genderedDragons = dragons.filter(d => d.gender === genderFilter || !d.gender)

  // When this side already has a selection but the other doesn't → use normal select
  // When neither is selected → selecting triggers popup for the other side
  const otherSelected = !!otherParentId
  const thisSelected = !!parentId

  function handleSelect(id) {
    if (!id) {
      onSelectDragon('')
      return
    }
    if (!otherSelected) {
      // First selection — trigger popup for the other side
      onSelectFirst(id)
    } else {
      onSelectDragon(id)
    }
  }

  return (
    <div className={`${styles.parentPanel} ${side === 'mom' ? styles.mom : styles.dad}`}>
      <div className={styles.parentHeader}>
        <span className={`cinzel ${styles.parentLabel}`}>{label}</span>
        <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div className={styles.parentBody}>
          {genderedDragons.length > 0 && (
            <div className="form-group">
              <label>From Registry</label>
              <select value={parentId} onChange={e => handleSelect(e.target.value)}>
                <option value="">— Manual entry —</option>
                {genderedDragons.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.player_name || d.name || 'Unknown'} ({d.species}){d.clan_role === 'Breeder' ? ' 🐣' : ''}
                  </option>
                ))}
              </select>
              {thisSelected && !otherSelected && (
                <p className={styles.popupHint}>
                  👆 Now select the {side === 'mom' ? 'father' : 'mother'} — a filtered list will appear
                </p>
              )}
            </div>
          )}

          <div className={styles.skinRow}>
            <div className="form-group">
              <label>Dom Skin</label>
              <input
                list="skins-list"
                value={parent.skin_dominant}
                onChange={e => onChange('skin_dominant', e.target.value)}
                placeholder="e.g. Crimson"
              />
            </div>
            <div className="form-group">
              <label>Recc Skin</label>
              <input
                list="skins-list"
                value={parent.skin_recessive}
                onChange={e => onChange('skin_recessive', e.target.value)}
                placeholder="e.g. Albino"
              />
            </div>
          </div>

          <datalist id="skins-list">
            {ALL_SKINS.map(s => <option key={s} value={s} />)}
          </datalist>

          <div className={styles.statsBlock}>
            <p className={styles.statsBlockLabel}>Stats</p>
            <div className={styles.statInputGrid}>
              {STAT_KEYS.map(key => (
                <div key={key} className={`${styles.statInputCell} form-group`}>
                  <label>{STAT_LABELS[key].split(' ').slice(-1)[0]}</label>
                  <select
                    value={parent[key]}
                    onChange={e => onChange(key, e.target.value)}
                  >
                    <option value="">—</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GradeCell({ grade, highlight, muted }) {
  if (!grade) return <span className={styles.gradeEmpty}>—</span>
  return (
    <span className={`grade-badge ${getGradeClass(grade)} ${highlight ? styles.gradeHighlight : ''} ${muted ? styles.gradeMuted : ''}`}>
      {grade}
    </span>
  )
}

function SkinTag({ label, skin }) {
  return (
    <div className={styles.skinTag}>
      <span className={styles.skinTagLabel}>{label}</span>
      <span className={styles.skinTagValue}>{skin || '—'}</span>
      {skin && <span className={styles.skinTagRarity}>{skinRarityLabel(skin)}</span>}
    </div>
  )
}

function BroodStat({ label, value, color, big }) {
  return (
    <div className={`${styles.broodStat} ${big ? styles.broodStatBig : ''}`}>
      <span className={styles.broodStatValue} style={{ color }}>{value}</span>
      <span className={styles.broodStatLabel}>{label}</span>
    </div>
  )
}
