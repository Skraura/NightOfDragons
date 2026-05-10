/**
 * dragonData.js — v6.0
 *
 * Changes from v5.4:
 *  - Removed stat_agility, stat_armor (don't exist in-game)
 *  - Renamed stat_venom → still key 'stat_venom' but label = 'Venom Resistance'
 *  - Added SKINS_BY_RARITY for nesting calculator
 *  - Fixed SKINS_COMMON / SKINS_BY_SPECIES to match correct game names
 *  - Total stats: 18 (was 20)
 */

export const SPECIES_FULL = {
  FS:  'Flame Stalker',
  SS:  'Shadow Scale',
  ASD: 'Acid Spitter Drake',
  IR:  'Inferno Ravager',
  BS:  'Blitz Striker',
  BW:  'Broodwatcher',
  BIO: 'Bioluminescent',
}

export const SPECIES_CONFIG = {
  'Shadow Scale':       { color: '#7c5cbf', bg: 'rgba(124,92,191,0.12)', icon: '🌙', code: 'SS' },
  'Flame Stalker':      { color: '#e5713a', bg: 'rgba(229,113,58,0.12)',  icon: '🔥', code: 'FS' },
  'Acid Spitter Drake': { color: '#4caf50', bg: 'rgba(76,175,80,0.12)',   icon: '☣',  code: 'ASD' },
  'Blitz Striker':      { color: '#f5c542', bg: 'rgba(245,197,66,0.12)',  icon: '⚡', code: 'BS' },
  'Broodwatcher':       { color: '#4db6ac', bg: 'rgba(77,182,172,0.12)',  icon: '👁', code: 'BW' },
  'Inferno Ravager':        { color: '#ff6b2b', bg: 'rgba(255,107,43,0.12)',  icon: '🔥',  code: 'IR' },
  'Bioluminescent':     { color: '#9c27b0', bg: 'rgba(156,39,176,0.12)', icon: '✨', code: 'BIO' },
}

// ── Skins by RARITY (used in Nesting Calculator) ───────────────────────────────
export const SKINS_COMMON   = ['Crimson', 'Leucistic', 'Leumelan', 'Melanistic', 'Gold']
export const SKINS_UNCOMMON = ['Fracture', 'Monarch', 'Burning Ash', 'Thunderflash', 'Rosebud', 'Orchid Bloom']
export const SKINS_RARE     = ['Mythical', 'Ember Dawn', 'Lava Rock', 'Pack Hunter', 'Constrictor', 'Wild Savannah', 'Eclipse', 'Ashfall', 'Blue Flame', 'Iris Blossom', 'Broken', 'Bone Breaker', 'Tigerclaw', 'Vertigo', 'Copperhead', 'Violet Petals', 'Luna', 'Twilight', 'Lionfang', 'Sunset']
export const SKINS_EXOTIC   = ['Hyena', 'Aftershock', 'Stellar Nebula', 'Severed', 'Burnout', 'Hot Iron', 'Brindle']
export const SKINS_MUTATION = ['Albino']

export const SKIN_RARITY_MAP = (() => {
  const m = {}
  SKINS_COMMON.forEach(s   => { m[s] = 'Common' })
  SKINS_UNCOMMON.forEach(s => { m[s] = 'Uncommon' })
  SKINS_RARE.forEach(s     => { m[s] = 'Rare' })
  SKINS_EXOTIC.forEach(s   => { m[s] = 'Exotic' })
  SKINS_MUTATION.forEach(s => { m[s] = 'Mutation' })
  return m
})()

// Skins available to ALL species (union of common + base universal)
export const SKINS_UNIVERSAL = [
  'Crimson', 'Leucistic', 'Leumelan', 'Melanistic', 'Gold', 'Albino', 'Brindle',
]

// Species-specific skins (keyed by species code)
export const SKINS_BY_SPECIES = {
  SS:  ['Sunset', 'Eclipse', 'Twilight', 'Stellar Nebula'],
  IR:  ['Ember Dawn', 'Burning Ash', 'Tigerclaw', 'Hot Iron'],
  FS:  ['Lava Rock', 'Ashfall', 'Lionfang', 'Blue Flame', 'Burnout'],
  ASD: ['Pack Hunter', 'Wild Savannah', 'Hyena'],
  BIO: ['Mythical', 'Monarch', 'Iris Blossom', 'Violet Petals', 'Luna', 'Rosebud', 'Orchid Bloom'],
  BS:  ['Aftershock', 'Thunderflash', 'Copperhead', 'Vertigo', 'Constrictor'],
  BW:  ['Severed', 'Fracture', 'Broken', 'Bone Breaker'],
}

/** Returns all skins valid for a given species code, sorted */
export function getSkinsForSpecies(speciesCode) {
  const specific = SKINS_BY_SPECIES[speciesCode] || []
  return [...SKINS_UNIVERSAL, ...specific].sort()
}

export const ALL_SKINS = [
  ...SKINS_UNIVERSAL,
  ...Object.values(SKINS_BY_SPECIES).flat(),
].filter((v, i, a) => a.indexOf(v) === i).sort()

export const SKIN_COLORS = {
  'Crimson':       '#c0392b',
  'Gold':          '#d4ac0d',
  'Leucistic':     '#a8c4d0',
  'Leumelan':      '#7f8c8d',
  'Melanistic':    '#2c3e50',
  'Brindle':       '#6b4c2a',
  'Albino':        '#f0ece8',
  'Ember Dawn':    '#e8722a',
  'Burning Ash':   '#34495e',
  'Tigerclaw':     '#c4873a',
  'Hot Iron':      '#b84020',
  'Lava Rock':     '#8b3a2a',
  'Ashfall':       '#6a6a6a',
  'Lionfang':      '#c4a040',
  'Blue Flame':    '#4080d0',
  'Burnout':       '#d04020',
  'Pack Hunter':   '#607850',
  'Wild Savannah': '#a08040',
  'Hyena':         '#9a8060',
  'Mythical':      '#9c27b0',
  'Monarch':       '#f39c12',
  'Iris Blossom':  '#8060b0',
  'Violet Petals': '#9050a0',
  'Luna':          '#a0b0d0',
  'Rosebud':       '#e91e63',
  'Orchid Bloom':  '#9c27b0',
  'Aftershock':    '#c0c030',
  'Thunderflash':  '#f1c40f',
  'Copperhead':    '#c47a30',
  'Vertigo':       '#6050a0',
  'Constrictor':   '#507840',
  'Severed':       '#802020',
  'Fracture':      '#e67e22',
  'Broken':        '#607080',
  'Bone Breaker':  '#c0b090',
  'Sunset':        '#d4703a',
  'Eclipse':       '#302850',
  'Twilight':      '#4a3060',
  'Stellar Nebula':'#4060c0',
}

// ── Stat grades ────────────────────────────────────────────────────────────────
export const GRADES = ['A++', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E', 'F']
export const BLOODLINE_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E', 'F']

// ── Growth stages ──────────────────────────────────────────────────────────────
export const GROWTH_STAGES = ['Hatchling', 'Juvenile', 'Adult', 'Elder']

// ── Clan roles ─────────────────────────────────────────────────────────────────
export const CLAN_ROLES = ['Fighter', 'Breeder']

// ── Traits ─────────────────────────────────────────────────────────────────────
export const TRAIT_POINTS = [1, 2, 3, 4]
export const TRAIT_DEFS = {
  dominant:   { label: 'Social',    evolved: 'Nesting',   levelNames: ['', 'Social', 'Social', 'Social', 'Nesting'],   icon: '👑' },
  scavenger:  { label: 'Scavenger', evolved: 'Survivor',  levelNames: ['', 'Scavenger', 'Scavenger', 'Scavenger', 'Survivor'], icon: '🌿' },
  fast:       { label: 'Fast',      evolved: 'Fast',      levelNames: ['', 'Movement', 'Movement', 'Movement', 'Fast'], icon: '⚡' },
}
export const TRAIT_KEYS = ['dominant', 'scavenger', 'fast']

// ── Gender ─────────────────────────────────────────────────────────────────────
export const GENDERS = [
  { value: 'M', label: '♂ Male',   searchKey: 'Male' },
  { value: 'F', label: '♀ Female', searchKey: 'Female' },
]

// ── Stat groups — 18 total ─────────────────────────────────────────────────────
// Removed from v5.4 (22 → 18):
//   stat_agility, stat_armor          — don't exist in-game
//   stat_venom (biological)           — consolidated into stat_venom_resistance
//   Stat layout matches in-game order as of v7.3.0
//   Removed: stat_growth_rate
//   Added:   stat_bile_production
export const STAT_GROUPS = {
  body: {
    label: 'Body',
    stats: [
      { key: 'stat_life_expectancy',     label: 'Life Expectancy' },
      { key: 'stat_scale_thickness',     label: 'Scale Thickness' },
      { key: 'stat_stamina',             label: 'Endurance' },
      { key: 'stat_bile_production',     label: 'Bile Production' },
      { key: 'stat_bite_force',          label: 'Bite Force' },
      { key: 'stat_power',               label: 'Power' },
      { key: 'stat_strength',            label: 'Strength' },
      { key: 'stat_nutrient_absorption', label: 'Nutrient Absorption' },
      { key: 'stat_water_retention',     label: 'Water Retention' },
    ],
  },
  resistances: {
    label: 'Resistances',
    stats: [
      { key: 'stat_toxin_tolerance',      label: 'Toxin Tolerance' },
      { key: 'stat_impact_resistance',    label: 'Impact Resistance' },
      { key: 'stat_pierce_resistance',    label: 'Pierce Resistance' },
      { key: 'stat_fire_resistance',      label: 'Fire Resistance' },
      { key: 'stat_frost_resistance',     label: 'Frost Resistance' },
      { key: 'stat_plasma_resistance',    label: 'Plasma Resistance' },
      { key: 'stat_lightning_resistance', label: 'Lightning Resistance' },
      { key: 'stat_acid_resistance',      label: 'Acid Resistance' },
      { key: 'stat_venom_resistance',     label: 'Venom Resistance' },
    ],
  },
}

export const ALL_STAT_KEYS = Object.values(STAT_GROUPS).flatMap(g => g.stats.map(s => s.key))
// Recessive variants — same keys prefixed with 'r_'
export const ALL_RSTAT_KEYS = ALL_STAT_KEYS.map(k => `r_${k}`)
export const STAT_LABELS   = Object.fromEntries(Object.values(STAT_GROUPS).flatMap(g => g.stats.map(s => [s.key, s.label])))
export const SPECIES_LIST  = Object.entries(SPECIES_FULL).map(([code, name]) => ({ code, name }))

// ── OCR capture fields (calibration boxes) ────────────────────────────────────
export const CAPTURE_FIELDS = [
  { key: 'species',  label: 'Species' },
  { key: 'gender',   label: 'Gender' },
  { key: 'growth',   label: 'Growth Stage' },
  ...ALL_STAT_KEYS.map(key => ({ key, label: STAT_LABELS[key] })),
  { key: 'bloodline_quality', label: 'Bloodline Quality' },
  { key: 'father_name',       label: 'Father Name' },
  { key: 'mother_name',       label: 'Mother Name' },
  { key: 'grandfather1_name', label: 'Grandfather (paternal)' },
  { key: 'grandfather2_name', label: 'Grandfather (maternal)' },
  { key: 'grandmother1_name', label: 'Grandmother (paternal)' },
  { key: 'grandmother2_name', label: 'Grandmother (maternal)' },
  { key: 'player_name',       label: 'Player Name' },
]

// ── Grade helpers ──────────────────────────────────────────────────────────────
export function getStatsColor(grade) {
  const i = GRADES.indexOf(grade)
  if (i < 0) return '#888'
  const t = (GRADES.length - 1 - i) / (GRADES.length - 1)
  return `rgb(${Math.round(220 - t * 160)},${Math.round(60 + t * 160)},60)`
}

export function getStatsWidth(grade) {
  const i = GRADES.indexOf(grade)
  if (i < 0) return 5
  return Math.round(((GRADES.length - i) / GRADES.length) * 100)
}

export function getGradeClass(grade) {
  if (!grade) return ''
  const map = {
    'A++': 'grade-axx', 'A+': 'grade-ax',
    'A': 'grade-a', 'A-': 'grade-a',
    'B+': 'grade-bx', 'B': 'grade-b', 'B-': 'grade-bm',
    'C+': 'grade-c', 'C': 'grade-c', 'C-': 'grade-c',
    'D+': 'grade-d', 'D': 'grade-d', 'D-': 'grade-d',
    'E': 'grade-e', 'F': 'grade-f',
  }
  return map[grade] || 'grade-e'
}

/** Derive ticks from growth stage */
export function ticksFromGrowth(growth) {
  if (growth === 'Elder')    return 1.0
  if (growth === 'Hatchling' || growth === 'Juvenile') return 0.0
  return null
}

// ─── Map locations (extracted from the in-game map) ──────────────────────────
// Each entry: { id, label, x, y }  where x/y are 0-1 fractions of the map image
export const MAP_LOCATIONS = [
  // Major biomes / landmarks
  { id: 'elder_forest',   label: 'Elder Forest',    x: 0.12, y: 0.52 },
  { id: 'lime',           label: 'Lime',             x: 0.11, y: 0.33 },
  { id: 'misty',          label: 'Misty',            x: 0.10, y: 0.08 },
  { id: 'north_open',     label: 'North Open',       x: 0.42, y: 0.05 },
  { id: 'big_snowy',      label: 'Big Snowy',        x: 0.65, y: 0.12 },
  { id: 'bacon',          label: 'Bacon',            x: 0.85, y: 0.08 },
  { id: 'east_redwood',   label: 'East Redwood',     x: 0.80, y: 0.40 },
  { id: 'west_redwood',   label: 'West Redwood',     x: 0.38, y: 0.22 },
  { id: 'middle_redwood', label: 'Middle Redwood',   x: 0.55, y: 0.38 },
  { id: 'arch',           label: 'Arch',             x: 0.52, y: 0.30 },
  { id: 'lake',           label: 'Lake',             x: 0.60, y: 0.43 },
  { id: 'big_rock',       label: 'Big Rock',         x: 0.62, y: 0.50 },
  { id: 'world_tree',     label: 'World Tree',       x: 0.47, y: 0.55 },
  { id: 'waterfall',      label: 'Waterfall',        x: 0.38, y: 0.58 },
  { id: 'four_ponds',     label: 'Four Ponds',       x: 0.35, y: 0.63 },
  { id: 'river',          label: 'River',            x: 0.44, y: 0.68 },
  { id: 'pride_rock',     label: 'Pride Rock',       x: 0.59, y: 0.63 },
  { id: 'throne',         label: 'Throne',           x: 0.71, y: 0.65 },
  { id: 'ravine',         label: 'Ravine',           x: 0.72, y: 0.72 },
  { id: 'south_east_open',label: 'South-East Open',  x: 0.73, y: 0.78 },
  { id: 'swamp',          label: 'Swamp',            x: 0.45, y: 0.90 },
  { id: 'swamp_west',     label: 'Swamp West',       x: 0.38, y: 0.93 },
  { id: 'swamp_east',     label: 'Swamp East',       x: 0.55, y: 0.93 },
  { id: 'ancient_forest', label: 'Ancient Forest',   x: 0.86, y: 0.90 },
  { id: 'croissant',      label: 'Croissant',        x: 0.17, y: 0.92 },
  // Sub-locations
  { id: 'paradise',       label: 'Paradise',         x: 0.34, y: 0.38 },
  { id: 'golf_course',    label: 'Golf Course',      x: 0.33, y: 0.52 },
  { id: 'river_ridge',    label: 'River Ridge',      x: 0.25, y: 0.66 },
  { id: 'titan',          label: 'Titan',            x: 0.21, y: 0.68 },
  { id: 'bunker',         label: 'Bunker',           x: 0.13, y: 0.60 },
  { id: 'pixel',          label: 'Pixel',            x: 0.20, y: 0.62 },
  { id: 'elder_tree',     label: 'Elder Tree',       x: 0.16, y: 0.78 },
  { id: 'mesh',           label: 'Mesh',             x: 0.12, y: 0.88 },
  { id: 'bio_island',     label: 'Bio Island',       x: 0.57, y: 0.43 },
  { id: 'ramp_rock',      label: 'Ramp Rock',        x: 0.80, y: 0.36 },
  { id: 'crater_pond',    label: 'Crater Pond',      x: 0.82, y: 0.64 },
  { id: 'brood_pond',     label: 'Brood Pond',       x: 0.85, y: 0.76 },
  { id: 'little_snow',    label: 'Little Snow',      x: 0.22, y: 0.38 },
  { id: 'lime_ridge',     label: 'Lime Ridge',       x: 0.09, y: 0.43 },
  { id: 'lime_forest',    label: 'Lime Forest',      x: 0.23, y: 0.20 },
  { id: 'craters',        label: 'Craters',          x: 0.13, y: 0.17 },
  { id: 'se_pond',        label: 'SE Pond',          x: 0.72, y: 0.50 },
  { id: 'stadium_pond',   label: 'Stadium Pond',     x: 0.61, y: 0.73 },
  { id: 'lotus',          label: 'Lotus',            x: 0.48, y: 0.68 },
  { id: 'snapper_pond',   label: 'Snapper Pond',     x: 0.46, y: 0.72 },
  { id: 'rivers_end',     label: "River's End",      x: 0.38, y: 0.78 },
  { id: 'swamp_falls',    label: 'Swamp Falls',      x: 0.43, y: 0.85 },
  { id: 'brood_quest',    label: 'Brood Quest',      x: 0.78, y: 0.93 },
  { id: 'ancient_pond',   label: 'Ancient Pond',     x: 0.89, y: 0.84 },
  { id: 'custom',         label: '📍 Custom coords…', x: null, y: null },
]
