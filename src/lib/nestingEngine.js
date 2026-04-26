// ─────────────────────────────────────────────────────────────────────────────
// Grade system
// A++ = 12, A+ = 12 (tied), A = 11, A- = 10, B+ = 9, B = 8, B- = 7,
// C+ = 6, C = 5, C- = 4, D+ = 3, D = 2, D- = 1, E = 0, F = -1
// ─────────────────────────────────────────────────────────────────────────────

export const GRADE_TO_NUM = {
  'A++': 12, 'A+': 12, 'A': 11, 'A-': 10,
  'B+': 9, 'B': 8, 'B-': 7,
  'C+': 6, 'C': 5, 'C-': 4,
  'D+': 3, 'D': 2, 'D-': 1,
  'E': 0, 'F': -1,
}

export const NUM_TO_GRADE = {
  12: 'A+', 11: 'A', 10: 'A-', 9: 'B+', 8: 'B', 7: 'B-',
  6: 'C+', 5: 'C', 4: 'C-', 3: 'D+', 2: 'D', 1: 'D-', 0: 'E',
}

// Special: both parents A++ → child can be A++
export function gradeToNum(grade) { return GRADE_TO_NUM[grade] ?? 5 }
export function numToGrade(n) {
  if (n >= 12) return 'A+'
  if (n <= -1) return 'F'
  return NUM_TO_GRADE[n] ?? 'E'
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat inheritance
// Rules (from spreadsheet):
//   - Each parent contributes Dom (dominant) and Recc (recessive) genes
//   - Child gets the higher of (mom_dom, dad_dom) as dominant
//   - Child's recessive = average of both recessives, OR one parent's dominant
//     if it's lower. The spreadsheet basically shows the best possible dominant
//     outcome and a typical recessive outcome.
//   - If mom_dom == dad_dom, child dom = that grade (or A++ if both A++)
//   - Child dom = max(mom_dom, dad_dom) in numeric terms
//   - Child recc = mid value between the two recessives
// ─────────────────────────────────────────────────────────────────────────────
export function calcStatOutcome(momDom, momRecc, dadDom, dadRecc) {
  const md = gradeToNum(momDom)
  const mr = gradeToNum(momRecc)
  const dd = gradeToNum(dadDom)
  const dr = gradeToNum(dadRecc)

  // Dominant child grade: best of both dominants
  const childDomNum = Math.max(md, dd)
  // Special A++ case: if both parents have A++ dom, child dom can be A++
  const bothAxx = momDom === 'A++' && dadDom === 'A++'
  const childDom = bothAxx ? 'A++' : numToGrade(childDomNum)

  // Recessive: typically the average, rounded to nearest grade step
  const childReccNum = Math.round((mr + dr) / 2)
  const childRecc = numToGrade(Math.max(-1, childReccNum))

  // Possible upgrade via crit (+1 grade to dom)
  const critDomNum = Math.min(childDomNum + 1, 12)
  const critDom = bothAxx ? 'A++' : numToGrade(critDomNum)

  // Super crit (+2 grades)
  const superCritDomNum = Math.min(childDomNum + 2, 12)
  const superCritDom = numToGrade(superCritDomNum)

  return { childDom, childRecc, critDom, superCritDom }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skin rarity system (from SkinMagic sheet)
// Common=5, Uncommon=4, Rare=3, Hybrid/Exotic=2, Mutation=1
// Child skin = higher rarity parent's dominant → goes to child dominant
// Lower rarity → goes to child recessive
// If same rarity → both possible outcomes listed
// ─────────────────────────────────────────────────────────────────────────────
import {
  SKINS_COMMON, SKINS_UNCOMMON, SKINS_RARE, SKINS_EXOTIC, SKINS_MUTATION
} from './dragonData'

export const SKIN_RARITY = {}
SKINS_COMMON.forEach(s   => { SKIN_RARITY[s] = 1 })
SKINS_UNCOMMON.forEach(s => { SKIN_RARITY[s] = 2 })
SKINS_RARE.forEach(s     => { SKIN_RARITY[s] = 3 })
SKINS_EXOTIC.forEach(s   => { SKIN_RARITY[s] = 4 })
SKINS_MUTATION.forEach(s => { SKIN_RARITY[s] = 5 })

export function skinRarity(skin) { return SKIN_RARITY[skin] ?? 1 }

export function skinRarityLabel(skin) {
  const r = skinRarity(skin)
  return ['', 'Common', 'Uncommon', 'Rare', 'Exotic', 'Mutation'][r] ?? 'Unknown'
}

export function calcSkinOutcome(momDom, momRecc, dadDom, dadRecc) {
  const skins = [momDom, momRecc, dadDom, dadRecc].filter(Boolean)
  if (!skins.length) return { outcomes: [], note: 'No skins provided' }

  // Sort by rarity descending; rarer skins push to child dominant
  const ranked = skins.map(s => ({ skin: s, rarity: skinRarity(s) }))
    .sort((a, b) => b.rarity - a.rarity)

  const outcomes = []

  // Dom/Dom combination (highest rarity pair)
  const topTwoDoms = [momDom, dadDom].filter(Boolean)
  const topTwoAll  = [momDom, momRecc, dadDom, dadRecc].filter(Boolean)

  // Possible child dominants: the two parental dominants
  const possibleDoms = [...new Set([momDom, dadDom].filter(Boolean))]
  // Possible child recessives: the two parental recessives, or a parental dominant if lower rarity
  const possibleReccs = [...new Set([momRecc, dadRecc, momDom, dadDom].filter(Boolean))]

  // Build outcome table: each possible (dom, recc) pairing
  for (const dom of possibleDoms) {
    for (const recc of possibleReccs) {
      if (dom === recc) continue
      const domR  = skinRarity(dom)
      const reccR = skinRarity(recc)
      // Valid: dom rarity >= recc rarity (dominant should be at least as rare)
      if (domR >= reccR) {
        // Weight: higher rarity combos are less common
        const weight = domR + reccR <= 4 ? 'Common' : domR + reccR <= 6 ? 'Possible' : 'Rare'
        outcomes.push({ dom, recc, weight, domRarity: skinRarityLabel(dom), reccRarity: skinRarityLabel(recc) })
      }
    }
  }

  // Deduplicate
  const seen = new Set()
  const deduped = outcomes.filter(o => {
    const k = `${o.dom}|${o.recc}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return { outcomes: deduped.length ? deduped : outcomes, allSkins: ranked }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brood crit rates (from BroodCrits sheet)
// tries → { ingame%, crit, superCrit, fail, superFail }
// ─────────────────────────────────────────────────────────────────────────────
export const BROOD_CRITS = [
  { tries: 1,  ingame: 1.00,  crit: 0,      superCrit: 0,     fail: 0,      superFail: 0 },
  { tries: 2,  ingame: 0.50,  crit: 0.375,  superCrit: 0.125, fail: 0.4375, superFail: 0.0625 },
  { tries: 3,  ingame: 0.24,  crit: 0.18,   superCrit: 0.06,  fail: 0.665,  superFail: 0.095 },
  { tries: 4,  ingame: 0.23,  crit: 0.1725, superCrit: 0.0575,fail: 0.67375,superFail: 0.09625 },
  { tries: 5,  ingame: 0.22,  crit: 0.165,  superCrit: 0.055, fail: 0.6825, superFail: 0.0975 },
  { tries: 6,  ingame: 0.21,  crit: 0.1575, superCrit: 0.0525,fail: 0.69125,superFail: 0.09875 },
  { tries: 7,  ingame: 0.20,  crit: 0.15,   superCrit: 0.05,  fail: 0.70,   superFail: 0.10 },
  { tries: 10, ingame: 0.20,  crit: 0.15,   superCrit: 0.05,  fail: 0.70,   superFail: 0.10 },
]

export function getBroodCrit(tries) {
  const t = Math.max(1, Math.min(tries, 10))
  return BROOD_CRITS.find(r => r.tries >= t) || BROOD_CRITS[BROOD_CRITS.length - 1]
}

// ─────────────────────────────────────────────────────────────────────────────
// Elder ticks data (from Elder_Ticks.xlsx)
// ─────────────────────────────────────────────────────────────────────────────
export const ELDER_DATA = {
  ASD: {
    class: 3, mass: '160 kg',
    elderTicks: 49,
    ticksPerDay: 4,
    daysToElder: 13,
    mutationPoints: [
      { ticks: 13, pct: 0.271, days: 4 },
      { ticks: 25, pct: 0.521, days: 7 },
      { ticks: 37, pct: 0.771, days: 10 },
    ],
  },
  BS: {
    class: 4, mass: '246 kg',
    elderTicks: 75,
    ticksPerDay: 2,
    daysToElder: 38,
    mutationPoints: [
      { ticks: 19, pct: 0.253, days: 10 },
      { ticks: 38, pct: 0.507, days: 19 },
      { ticks: 57, pct: 0.760, days: 29 },
    ],
  },
  SS: {
    class: 4, mass: '286 kg',
    elderTicks: 80,
    ticksPerDay: 2,
    daysToElder: 40,
    mutationPoints: [
      { ticks: 20, pct: 0.250, days: 10 },
      { ticks: 40, pct: 0.500, days: 20 },
      { ticks: 60, pct: 0.750, days: 30 },
    ],
  },
  FS: {
    class: 5, mass: '592 kg',
    elderTicks: 110,
    ticksPerDay: 3,
    daysToElder: 37,
    mutationPoints: [
      { ticks: 28, pct: 0.255, days: 10 },
      { ticks: 56, pct: 0.509, days: 19 },
      { ticks: 83, pct: 0.755, days: 28 },
    ],
  },
  IR: {
    class: 5, mass: '592 kg',
    elderTicks: 110,
    ticksPerDay: 3,
    daysToElder: 37,
    mutationPoints: [
      { ticks: 28, pct: 0.255, days: 10 },
      { ticks: 56, pct: 0.509, days: 19 },
      { ticks: 83, pct: 0.755, days: 28 },
    ],
  },
  BW: {
    class: 6, mass: '900 kg',
    elderTicks: 181,
    ticksPerDay: 4,
    daysToElder: 46,
    mutationPoints: [
      { ticks: 38, pct: null, days: null },
      { ticks: 57, pct: null, days: null },
    ],
  },
  BIO: {
    class: 3, mass: '~160 kg',
    elderTicks: 49,
    ticksPerDay: 4,
    daysToElder: 13,
    mutationPoints: [
      { ticks: 13, pct: 0.271, days: 4 },
      { ticks: 25, pct: 0.521, days: 7 },
      { ticks: 37, pct: 0.771, days: 10 },
    ],
  },
}

// Calculate current progress for a dragon
export function calcElderProgress(species, currentTicks) {
  const data = ELDER_DATA[species]
  if (!data) return null

  const ticks = parseFloat(currentTicks) || 0
  const elderTicks = data.elderTicks
  const pct = Math.min(ticks / elderTicks, 1)
  const ticksRemaining = Math.max(elderTicks - ticks, 0)
  const daysRemaining = data.ticksPerDay > 0
    ? Math.ceil(ticksRemaining / data.ticksPerDay)
    : null

  // Which mutation point are we at/approaching?
  let currentMutPt = null
  let nextMutPt = null
  for (const mp of data.mutationPoints) {
    if (ticks >= mp.ticks) {
      currentMutPt = mp
    } else if (!nextMutPt) {
      nextMutPt = mp
    }
  }

  const ticksToNextMut = nextMutPt ? Math.max(nextMutPt.ticks - ticks, 0) : null
  const daysToNextMut = (ticksToNextMut !== null && data.ticksPerDay > 0)
    ? Math.ceil(ticksToNextMut / data.ticksPerDay)
    : null

  return {
    species, ticks, elderTicks, pct,
    ticksRemaining, daysRemaining,
    ticksPerDay: data.ticksPerDay,
    currentMutPt, nextMutPt,
    ticksToNextMut, daysToNextMut,
    isElder: ticks >= elderTicks,
    mutationPoints: data.mutationPoints,
    class: data.class, mass: data.mass,
  }
}
