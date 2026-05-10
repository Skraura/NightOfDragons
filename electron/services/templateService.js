/**
 * Template Service — Image-based recognition for icon fields AND stat grades
 *
 * v4 changes:
 *   - All stat grade fields now share a single flat training-data/stats/ folder
 *     instead of one folder per stat (training-data/stat_stamina/A++/ etc.)
 *   - Bloodline Quality uses training-data/bloodline_quality/
 *   - 22 stat keys are all handled by the same image pool
 *
 * training-data/
 *   stats/           ← shared for ALL stat grades (A++, A+, A, A-, …, F)
 *   bloodline_quality/ ← separate because capped at A (no A+/A++)
 *   gender/  species/  growth/  elder_status/  (unchanged)
 */

const fs    = require('fs')
const path  = require('path')
const sharp = require('sharp')
const { app } = require('electron')

// ─── Field sets ───────────────────────────────────────────────────────────────

const ICON_FIELDS = new Set(['gender', 'species', 'growth', 'elder_status'])

// All 22 stat fields — they all read from the shared 'stats' folder
const ALL_STAT_KEYS = [
  'stat_life_expectancy', 'stat_scale_thickness', 'stat_stamina', 'stat_agility',
  'stat_strength', 'stat_growth_rate', 'stat_armor', 'stat_venom',
  'stat_bite_force', 'stat_power', 'stat_nutrient_absorption', 'stat_water_retention',
  'stat_toxin_tolerance', 'stat_impact_resistance', 'stat_pierce_resistance',
  'stat_fire_resistance', 'stat_frost_resistance', 'stat_plasma_resistance',
  'stat_lightning_resistance', 'stat_acid_resistance', 'stat_venom_resistance',
  'stat_bile_production',
]
const STAT_FIELDS = new Set(ALL_STAT_KEYS)

// Bloodline Quality uses its own folder (grades capped at A)
const BLOODLINE_FIELD = 'bloodline_quality'

const ALL_TEMPLATE_FIELDS = new Set([...ICON_FIELDS, ...STAT_FIELDS, BLOODLINE_FIELD])

// Internal name used to key the cache for stats (they all share one folder)
const STATS_FOLDER = 'stats'

// ─── Paths ────────────────────────────────────────────────────────────────────
function getTrainingDataDir() {
  const isDev = !app.isPackaged
  if (isDev) return path.join(__dirname, '..', '..', 'training-data')
  // In production training-data is bundled as an extraResource (read-only)
  return path.join(process.resourcesPath, 'training-data')
}

/** Resolve the actual folder name on disk for a given field */
function folderForField(fieldName) {
  if (STAT_FIELDS.has(fieldName)) return STATS_FOLDER
  return fieldName // icon fields and bloodline_quality use their own name
}

/** Cache key for a given field */
function cacheKeyForField(fieldName) {
  if (STAT_FIELDS.has(fieldName)) return STATS_FOLDER
  return fieldName
}

// ─── Template cache ───────────────────────────────────────────────────────────
const _cache = new Map()

// ─── Feature extraction ───────────────────────────────────────────────────────

async function buildHistogram(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .resize(64, 64, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const bins   = new Float32Array(64)
  const pixels = info.width * info.height

  for (let i = 0; i < data.length; i += 3) {
    const r = Math.floor(data[i]     / 64)
    const g = Math.floor(data[i + 1] / 64)
    const b = Math.floor(data[i + 2] / 64)
    bins[r * 16 + g * 4 + b]++
  }
  for (let i = 0; i < bins.length; i++) bins[i] /= pixels
  return bins
}

async function buildPHash(pngBuffer) {
  const { data } = await sharp(pngBuffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const mean = data.reduce((s, v) => s + v, 0) / data.length
  const bits = new Uint8Array(64)
  for (let i = 0; i < 64; i++) bits[i] = data[i] >= mean ? 1 : 0
  return bits
}

function histogramDistance(h1, h2) {
  let d = 0
  for (let i = 0; i < h1.length; i++) {
    const sum = h1[i] + h2[i]
    if (sum > 0) d += ((h1[i] - h2[i]) ** 2) / sum
  }
  return d
}

function hammingDistance(a, b) {
  let d = 0
  for (let i = 0; i < 64; i++) if (a[i] !== b[i]) d++
  return d
}

function combinedScore(tmpl, queryHist, queryPHash) {
  const histScore = Math.max(0, 1 - histogramDistance(tmpl.histogram, queryHist) / 0.5)
  const hashScore = Math.max(0, 1 - hammingDistance(tmpl.pHash, queryPHash) / 32)
  return (histScore + hashScore) / 2
}

// ─── Cache management ─────────────────────────────────────────────────────────

async function loadFolder(folderName) {
  const dir = path.join(getTrainingDataDir(), folderName)
  if (!fs.existsSync(dir)) {
    _cache.set(folderName, [])
    return
  }

  const entries = []
  for (const label of fs.readdirSync(dir)) {
    const labelDir = path.join(dir, label)
    if (!fs.statSync(labelDir).isDirectory()) continue
    for (const file of fs.readdirSync(labelDir)) {
      if (!/\.(png|jpg|jpeg|webp)$/i.test(file)) continue
      try {
        const buf       = fs.readFileSync(path.join(labelDir, file))
        const histogram = await buildHistogram(buf)
        const pHash     = await buildPHash(buf)

        // Parse recessive grade from filename convention:
        // "A.png"      → dominant=A (folder label), recessive=null
        // "Ax.png"     → dominant=A, recessive=null  (x = visual variant)
        // "A_B+.png"   → dominant=A, recessive=B+
        // "Ax_A.png"   → dominant=A, recessive=A
        const baseName = path.basename(file, path.extname(file))
        let recessive = null
        if (baseName.includes('_')) {
          // Everything after the first underscore is the recessive grade
          const parts = baseName.split('_')
          const rPart = parts.slice(1).join('_').replace(/[^A-Za-z+\-]/g, '')
          if (rPart) recessive = rPart
        }

        entries.push({ label, recessive, histogram, pHash, file })
      } catch (err) {
        console.warn(`[template] Could not load ${folderName}/${label}/${file}:`, err.message)
      }
    }
  }
  _cache.set(folderName, entries)
  if (process.env.NODE_ENV !== "production") console.log(`[template] Loaded ${entries.length} templates for "${folderName}"`)
}

async function loadField(fieldName) {
  const folder = cacheKeyForField(fieldName)
  // Only load once per unique folder
  if (!_cache.has(folder)) {
    await loadFolder(folder)
  }
}

async function loadAllTemplates() {
  // Load icon fields individually
  for (const field of ICON_FIELDS) {
    await loadFolder(field)
  }
  // Load shared stats folder once
  await loadFolder(STATS_FOLDER)
  // Load bloodline quality
  await loadFolder(BLOODLINE_FIELD)
}

// ─── Matching ─────────────────────────────────────────────────────────────────

async function matchTemplate(imageBuffer, fieldName) {
  if (!ALL_TEMPLATE_FIELDS.has(fieldName)) return null

  const cacheKey = cacheKeyForField(fieldName)
  if (!_cache.has(cacheKey)) {
    await loadFolder(cacheKey === STATS_FOLDER ? STATS_FOLDER : fieldName)
  }

  const templates = _cache.get(cacheKey) || []
  if (templates.length === 0) return null

  const queryHist  = await buildHistogram(imageBuffer)
  const queryPHash = await buildPHash(imageBuffer)

  let bestLabel     = null
  let bestRecessive = null
  let bestScore     = -Infinity
  let secondScore   = -Infinity

  for (const tmpl of templates) {
    const score = combinedScore(tmpl, queryHist, queryPHash)
    if (score > bestScore) {
      secondScore   = bestScore
      bestScore     = score
      bestLabel     = tmpl.label
      bestRecessive = tmpl.recessive || null
    } else if (score > secondScore) {
      secondScore = score
    }
  }

  if (!bestLabel) return null

  const MIN_CONFIDENCE = 0.35
  if (bestScore < MIN_CONFIDENCE) {
    console.warn(`[template] ${fieldName}: best match "${bestLabel}" confidence too low (${bestScore.toFixed(2)})`)
    return null
  }

  const gap = bestScore - Math.max(secondScore, 0)
  return { label: bestLabel, recessive: bestRecessive, confidence: bestScore, gap }
}

// ─── Training data management ─────────────────────────────────────────────────

/**
 * In production, training-data inside the asar is read-only.
 * We write new samples to userData/training-data/ instead, then
 * the loader checks both locations (bundled first, then user).
 */
function getWritableTrainingDataDir() {
  if (!app.isPackaged) return path.join(__dirname, '..', '..', 'training-data')
  return path.join(app.getPath('userData'), 'training-data')
}

async function saveTrainingSample(imageBuffer, fieldName, label) {
  const folder   = folderForField(fieldName)
  const labelDir = path.join(getWritableTrainingDataDir(), folder, label)
  fs.mkdirSync(labelDir, { recursive: true })

  const fname = `sample_${Date.now()}.png`
  await sharp(imageBuffer).png().toFile(path.join(labelDir, fname))

  // Invalidate cache so next match uses updated templates
  _cache.delete(cacheKeyForField(fieldName))

  return { ok: true, path: path.join(labelDir, fname) }
}

/**
 * Save multiple training samples at once (used by dev capture tool).
 * entries: Array<{ imageBuffer: Buffer, fieldName: string, label: string }>
 */
async function saveBatchSamples(entries) {
  const results = []
  for (const { imageBuffer, fieldName, label } of entries) {
    try {
      const r = await saveTrainingSample(imageBuffer, fieldName, label)
      results.push({ fieldName, label, ok: true, path: r.path })
    } catch (err) {
      results.push({ fieldName, label, ok: false, error: err.message })
    }
  }
  return results
}

function listTrainingSamples() {
  const rootDir = getTrainingDataDir()
  const result  = {}

  // Icon fields (their own folder)
  for (const field of ICON_FIELDS) {
    result[field] = {}
    const fieldDir = path.join(rootDir, field)
    if (!fs.existsSync(fieldDir)) continue
    for (const label of fs.readdirSync(fieldDir)) {
      const labelDir = path.join(fieldDir, label)
      try {
        if (!fs.statSync(labelDir).isDirectory()) continue
        const files = fs.readdirSync(labelDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        if (files.length > 0) result[field][label] = files.length
      } catch {}
    }
  }

  // Shared stats folder
  result[STATS_FOLDER] = {}
  const statsDir = path.join(rootDir, STATS_FOLDER)
  if (fs.existsSync(statsDir)) {
    for (const label of fs.readdirSync(statsDir)) {
      const labelDir = path.join(statsDir, label)
      try {
        if (!fs.statSync(labelDir).isDirectory()) continue
        const files = fs.readdirSync(labelDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        if (files.length > 0) result[STATS_FOLDER][label] = files.length
      } catch {}
    }
  }

  // Bloodline quality
  result[BLOODLINE_FIELD] = {}
  const bqDir = path.join(rootDir, BLOODLINE_FIELD)
  if (fs.existsSync(bqDir)) {
    for (const label of fs.readdirSync(bqDir)) {
      const labelDir = path.join(bqDir, label)
      try {
        if (!fs.statSync(labelDir).isDirectory()) continue
        const files = fs.readdirSync(labelDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        if (files.length > 0) result[BLOODLINE_FIELD][label] = files.length
      } catch {}
    }
  }

  return result
}

// Training data is now bundled and read-only — deletion is not supported
function deleteTrainingLabel(_fieldName, _label) {
  return { ok: false, reason: 'Training data is read-only in this version' }
}

async function reloadField(fieldName) {
  const key = cacheKeyForField(fieldName)
  _cache.delete(key)
  await loadFolder(key)
  return { ok: true, count: (_cache.get(key) || []).length }
}

module.exports = {
  saveBatchSamples,
  ICON_FIELDS,
  STAT_FIELDS,
  ALL_TEMPLATE_FIELDS,
  STATS_FOLDER,
  loadAllTemplates,
  loadField,
  reloadField,
  matchTemplate,
  saveTrainingSample,
  listTrainingSamples,
  deleteTrainingLabel,
  getTrainingDataDir,
}
