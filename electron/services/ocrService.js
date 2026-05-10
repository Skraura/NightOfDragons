/**
 * OCR Service — v6.0 (Patch 8.1.2)
 *
 * Key change: Stats and bloodline_quality are now read by COLOR-GUIDED GLYPH OCR:
 *   1. Isolate yellow pixels (dominant grade) from the crop
 *   2. Isolate white pixels (recessive grade) from the crop
 *   3. Match each isolated glyph against alphabet templates
 *   4. Clean the result through grade validators
 *
 * This replaces the old histogram/pHash template matching for stat fields,
 * which was unreliable because it compared full crops (including background)
 * across different screen sizes and UI scales.
 *
 * Icons (gender, species, growth) still use templateService pHash matching —
 * those ARE actual icons and histogram matching works well for them.
 *
 * Idea 4: Confidence gap flagging — if top two template scores are within
 * GAP_THRESHOLD of each other, the result is flagged as uncertain.
 */

const sharp   = require('sharp')
const path    = require('path')
const fs      = require('fs')
const { app } = require('electron')

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIES_LIST = ['FS','SS','ASD','IR','BS','BW','BIO']
const GRADE_LIST   = ['A++','A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E','F']
const BLOODLINE_GRADE_LIST = ['A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E','F']
const GROWTH_LIST  = ['Hatchling','Juvenile','Adult','Elder']

const ALL_STAT_KEYS = new Set([
  'stat_life_expectancy','stat_scale_thickness','stat_stamina',
  'stat_bile_production','stat_bite_force','stat_power','stat_strength',
  'stat_nutrient_absorption','stat_water_retention',
  'stat_toxin_tolerance','stat_impact_resistance','stat_pierce_resistance',
  'stat_fire_resistance','stat_frost_resistance','stat_plasma_resistance',
  'stat_lightning_resistance','stat_acid_resistance','stat_venom_resistance',
  'stat_agility','stat_growth_rate','stat_armor','stat_venom',
])

const NAME_FIELDS = new Set([
  'father_name','mother_name',
  'grandfather1_name','grandfather2_name',
  'grandmother1_name','grandmother2_name',
  'player_name',
])

const ALPHABET_FIELDS = new Set([
  ...NAME_FIELDS,
  'skin_dominant','skin_recessive','ticks',
])

// Icon fields — use templateService pHash (these are actual icons, not text)
const ICON_FIELDS = new Set(['gender','species','growth','elder_status'])

// Confidence gap: if top-2 template scores differ by less than this, flag as uncertain
const GAP_THRESHOLD = 0.06

// ─── Field cleaners ───────────────────────────────────────────────────────────

function cleanSpecies(raw) {
  if (!raw) return null
  const up = raw.toUpperCase().replace(/[^A-Z0-9]/g,'')
  for (const s of SPECIES_LIST) { if (up.includes(s)) return s }
  const fixes = { 'F5':'FS','S5':'SS','A5D':'ASD','BI0':'BIO','B10':'BIO' }
  return fixes[up] || null
}

function cleanGrade(raw) {
  if (!raw) return null
  const s = raw.trim().toUpperCase().replace(/\s+/g,'')
  if (GRADE_LIST.includes(s)) return s
  if (/^A\+\+/.test(s)) return 'A++'
  if (/^A\+/.test(s))   return 'A+'
  if (/^A-/.test(s))    return 'A-'
  if (/^A$/.test(s))    return 'A'
  if (/^B\+/.test(s))   return 'B+'
  if (/^B-/.test(s))    return 'B-'
  if (/^B$/.test(s))    return 'B'
  if (/^C\+/.test(s))   return 'C+'
  if (/^C-/.test(s))    return 'C-'
  if (/^C$/.test(s))    return 'C'
  if (/^D\+/.test(s))   return 'D+'
  if (/^D-/.test(s))    return 'D-'
  if (/^D$/.test(s))    return 'D'
  if (/^E$/.test(s))    return 'E'
  if (/^F$/.test(s))    return 'F'
  return null
}

function cleanBloodlineGrade(raw) {
  const grade = cleanGrade(raw)
  if (!grade || grade === 'A++' || grade === 'A+') return null
  if (!BLOODLINE_GRADE_LIST.includes(grade)) return null
  return grade
}

function cleanTicks(raw) {
  if (!raw) return null
  const m = raw.match(/\d+\.?\d*/)
  if (!m) return null
  const n = parseFloat(m[0])
  if (isNaN(n) || n < 0 || n > 300) return null
  return String(n)
}

function cleanGrowth(raw) {
  if (!raw) return null
  const lo = raw.trim().toLowerCase()
  for (const r of GROWTH_LIST) { if (lo.includes(r.toLowerCase())) return r }
  return null
}

function cleanGender(raw) {
  if (!raw) return null
  const s = raw.trim().toUpperCase()
  if (s === 'M' || s.includes('♂')) return 'M'
  if (s === 'F' || s.includes('♀')) return 'F'
  if (s.startsWith('M') && !s.includes('F')) return 'M'
  if (s.startsWith('F')) return 'F'
  return null
}

function cleanElderStatus(raw) {
  if (!raw) return 'NO'
  const up = raw.trim().toUpperCase()
  if (up.includes('ELDER')) return 'ELDER'
  const m = raw.match(/([4-6])\s*[Pp]oint/)
  if (m) return `${m[1]} Points`
  return 'NO'
}

function cleanSkin(raw) {
  if (!raw) return null
  return raw.trim()
    .replace(/[^a-zA-Z\s]/g,'')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .substring(0, 60) || null
}

function cleanName(raw) {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed || trimmed.toUpperCase() === 'UNKNOWN') return ''
  return trimmed
    .replace(/[^\x20-\x7E]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .substring(0, 32)
}

const FIELD_CLEANERS = {
  species:           cleanSpecies,
  gender:            cleanGender,
  skin_dominant:     cleanSkin,
  skin_recessive:    cleanSkin,
  growth:            cleanGrowth,
  ticks:             cleanTicks,
  elder_status:      cleanElderStatus,
  bloodline_quality: cleanBloodlineGrade,
  father_name:       cleanName,
  mother_name:       cleanName,
  grandfather1_name: cleanName,
  grandfather2_name: cleanName,
  grandmother1_name: cleanName,
  grandmother2_name: cleanName,
  player_name:       cleanName,
}
for (const key of ALL_STAT_KEYS) { FIELD_CLEANERS[key] = cleanGrade }

// ─── Training data path ───────────────────────────────────────────────────────

function getTrainingDataDir() {
  const isDev = !app.isPackaged
  return isDev
    ? path.join(__dirname, '..', '..', 'training-data')
    : path.join(process.resourcesPath, 'training-data')
}

// ─── Alphabet template cache ──────────────────────────────────────────────────

let _alphabetCache = null

async function loadAlphabetTemplates() {
  if (_alphabetCache) return _alphabetCache
  _alphabetCache = new Map()

  const alphabetDir = path.join(getTrainingDataDir(), 'alphabet')
  if (!fs.existsSync(alphabetDir)) {
    console.warn('[ocr-alpha] No alphabet training-data directory found')
    return _alphabetCache
  }

  for (const charFolder of fs.readdirSync(alphabetDir)) {
    const charDir = path.join(alphabetDir, charFolder)
    if (!fs.statSync(charDir).isDirectory()) continue

    let char = charFolder
    if (charFolder === 'HYPHEN') char = '-'
    else if (charFolder === 'SPACE') char = ' '
    else if (charFolder.length === 1) char = charFolder.toUpperCase()

    const files = fs.readdirSync(charDir).filter(f => /\.(png|jpg|jpeg)$/i.test(f))
    if (!files.length) continue

    try {
      const imgPath = path.join(charDir, files[0])
      const raw = await sharp(imgPath)
        .grayscale()
        .normalize()
        .raw()
        .toBuffer({ resolveWithObject: true })
      _alphabetCache.set(char, {
        data: raw.data,
        width: raw.info.width,
        height: raw.info.height,
      })
    } catch (err) {
      console.warn(`[ocr-alpha] Failed to load template for "${char}":`, err.message)
    }
  }

  console.log(`[ocr-alpha] Loaded ${_alphabetCache.size} alphabet templates`)
  return _alphabetCache
}

// ─── Color-guided glyph isolation ─────────────────────────────────────────────
// Stats are rendered as:
//   • Yellow text (≈ R>180, G>140, B<80)  → dominant grade
//   • White text  (≈ R>200, G>200, B>200) → recessive grade (smaller, below dominant)
//
// We isolate each color plane to a binary mask, then run sliding-window
// alphabet matching on the mask only — ignoring background noise entirely.

/**
 * Extract a binary mask of pixels matching the target color.
 * Returns a grayscale Buffer (same W×H) where matched pixels = 255, others = 0.
 */
async function isolateColorMask(imageBuffer, colorTarget) {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels  // 3 (RGB) or 4 (RGBA)
  const out = Buffer.alloc(info.width * info.height, 0)

  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * channels]
    const g = data[i * channels + 1]
    const b = data[i * channels + 2]

    let match = false
    if (colorTarget === 'yellow') {
      // Yellow: high R, medium-high G, low B — the DoD dominant stat color
      match = r > 170 && g > 120 && b < 90 && r > g && r - b > 100
    } else if (colorTarget === 'white') {
      // White/light grey: all channels high and close together
      match = r > 190 && g > 190 && b > 190 && Math.max(r,g,b) - Math.min(r,g,b) < 40
    }

    out[i] = match ? 255 : 0
  }

  return { maskData: out, width: info.width, height: info.height }
}

/**
 * Score how well a character template fits a window in a binary mask.
 */
function scoreCharInMask(maskData, maskW, maskH, sx, winW, tmpl) {
  const tw = tmpl.width
  const th = tmpl.height
  const td = tmpl.data
  const sampleStep = 2

  let sum = 0, count = 0

  for (let py = 0; py < maskH; py += sampleStep) {
    const ty = Math.round((py / maskH) * th)
    if (ty >= th) continue
    for (let px = 0; px < winW; px += sampleStep) {
      const sx2 = sx + px
      if (sx2 >= maskW) continue
      const tx = Math.round((px / winW) * tw)
      if (tx >= tw) continue

      const mp = maskData[py * maskW + sx2] / 255   // 1 if colored pixel, 0 if not
      const tp = td[ty * tw + tx] / 255              // template grayscale
      sum += 1 - Math.abs(mp - tp)
      count++
    }
  }

  return count > 0 ? sum / count : 0
}

/**
 * Run sliding-window alphabet OCR on a binary mask image.
 * Returns the recognized string.
 */
async function readMaskWithAlphabet(maskData, maskW, maskH) {
  const templates = await loadAlphabetTemplates()
  if (templates.size === 0) return ''

  const charList = [...templates.entries()].sort((a, b) => b[1].width - a[1].width)
  const widths   = charList.map(([,t]) => t.width)
  const minW     = Math.max(3, Math.round(Math.min(...widths) * 0.5))
  const maxW     = Math.round(Math.max(...widths) * 1.5)

  const THRESHOLD = 0.60
  let result = ''
  let x = 0
  let consecutiveMisses = 0

  while (x < maskW && result.length < 8) {  // grades are max 3 chars (A++)
    let bestChar  = null
    let bestScore = THRESHOLD
    let bestWidth = 0

    for (const [char, tmpl] of charList) {
      for (const wMult of [1.0, 0.8, 1.2]) {
        const winW = Math.round(tmpl.width * wMult)
        if (winW < minW || winW > maxW || x + winW > maskW) continue
        const score = scoreCharInMask(maskData, maskW, maskH, x, winW, tmpl)
        if (score > bestScore) {
          bestScore = score
          bestChar  = char
          bestWidth = winW
        }
      }
    }

    if (bestChar !== null) {
      result += bestChar
      x += Math.max(1, bestWidth)
      consecutiveMisses = 0
    } else {
      x += Math.max(1, Math.round(minW * 0.4))
      consecutiveMisses++
      if (consecutiveMisses > 10) break
    }
  }

  return result.trim()
}

/**
 * Normalize a crop to a standard size before color isolation.
 * Idea 3: canonical size + ensure we handle varying crop sizes uniformly.
 */
async function normalizeCrop(imageBuffer, targetW = 120, targetH = 60) {
  return sharp(imageBuffer)
    .resize(targetW, targetH, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()
}

/**
 * Read a stat grade from a crop using color-guided glyph OCR.
 * Returns { dominant, recessive, uncertain }
 */
async function readStatGrade(imageBuffer) {
  const normalized = await normalizeCrop(imageBuffer, 120, 60)

  // Extract yellow (dominant) and white (recessive) masks
  const { maskData: yellowMask, width: mW, height: mH } = await isolateColorMask(normalized, 'yellow')
  const { maskData: whiteMask }                          = await isolateColorMask(normalized, 'white')

  // Check if there are enough colored pixels to bother matching
  const yellowPixels = yellowMask.reduce((s, v) => s + (v > 0 ? 1 : 0), 0)
  const whitePixels  = whiteMask.reduce((s,  v) => s + (v > 0 ? 1 : 0), 0)

  let dominant  = null
  let recessive = null

  if (yellowPixels > 20) {
    const raw = await readMaskWithAlphabet(yellowMask, mW, mH)
    dominant  = cleanGrade(raw)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ocr-stat] yellow → raw="${raw}" → "${dominant}" (${yellowPixels}px)`)
    }
  }

  if (whitePixels > 15) {
    const raw = await readMaskWithAlphabet(whiteMask, mW, mH)
    recessive = cleanGrade(raw)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ocr-stat] white  → raw="${raw}" → "${recessive}" (${whitePixels}px)`)
    }
  }

  return { dominant, recessive }
}

/**
 * Read bloodline quality — same color approach, only yellow channel,
 * constrained to bloodline grade list.
 */
async function readBloodlineGrade(imageBuffer) {
  const normalized = await normalizeCrop(imageBuffer, 80, 50)
  const { maskData, width: mW, height: mH } = await isolateColorMask(normalized, 'yellow')
  const yellowPixels = maskData.reduce((s, v) => s + (v > 0 ? 1 : 0), 0)

  if (yellowPixels < 15) return { value: null, uncertain: false }

  const raw   = await readMaskWithAlphabet(maskData, mW, mH)
  const grade = cleanBloodlineGrade(raw)
  return { value: grade, uncertain: false }
}

// ─── Alphabet OCR (for names/skin/ticks) ─────────────────────────────────────

async function readWithAlphabetOCR(imageBuffer) {
  const templates = await loadAlphabetTemplates()
  if (templates.size === 0) return ''

  const TARGET_H = 36
  const meta     = await sharp(imageBuffer).metadata()
  const targetW  = Math.round((meta.width / meta.height) * TARGET_H) || 200

  const { data, info } = await sharp(imageBuffer)
    .resize(targetW, TARGET_H, { fit: 'fill', kernel: 'lanczos3' })
    .grayscale()
    .normalize()
    .threshold(140)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const W = info.width
  const H = info.height

  const charList = [...templates.entries()].sort((a, b) => b[1].width - a[1].width)
  const widths   = charList.map(([,t]) => t.width)
  const minW     = Math.max(3, Math.round(Math.min(...widths) * 0.6))
  const maxW     = Math.round(Math.max(...widths) * 1.4)

  const THRESHOLD = 0.58
  let result = ''
  let x = 0
  let consecutiveMisses = 0

  while (x < W && result.length < 40) {
    let bestChar  = null
    let bestScore = THRESHOLD
    let bestWidth = 0

    for (const [char, tmpl] of charList) {
      for (const wMult of [1.0, 0.85, 1.15]) {
        const winW = Math.round(tmpl.width * wMult)
        if (winW < minW || winW > maxW || x + winW > W) continue
        const score = scoreCharInMask(data, W, H, x, winW, tmpl)
        if (score > bestScore) {
          bestScore = score
          bestChar  = char
          bestWidth = winW
        }
      }
    }

    if (bestChar !== null) {
      result += bestChar
      x += Math.max(1, bestWidth)
      consecutiveMisses = 0
    } else {
      x += Math.max(1, Math.round(minW * 0.5))
      consecutiveMisses++
      if (consecutiveMisses > 8) break
    }
  }

  return result.trim()
}

// ─── Icon template matching (gender / species / growth) ──────────────────────

let _templateService = null
function getTemplateService() {
  if (!_templateService) _templateService = require('./templateService')
  return _templateService
}

async function tryIconMatch(imageBuffer, fieldName) {
  if (!ICON_FIELDS.has(fieldName)) return null
  try {
    const svc    = getTemplateService()
    const result = await svc.matchTemplate(imageBuffer, fieldName)
    if (result) {
      const uncertain = result.gap !== undefined && result.gap < GAP_THRESHOLD
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[ocr] icon "${fieldName}" → "${result.label}"` +
          ` (conf=${result.confidence.toFixed(2)}, gap=${(result.gap||0).toFixed(2)})` +
          (uncertain ? ' ⚠ uncertain' : '')
        )
      }
      return { label: result.label, uncertain }
    }
  } catch (err) {
    console.warn(`[ocr] icon match error for "${fieldName}":`, err.message)
  }
  return null
}

// ─── Claude Vision (optional, paid) ──────────────────────────────────────────

const CLAUDE_PROMPTS = {
  species:           'What dragon species code is shown? Reply ONLY with: FS, SS, ASD, IR, BS, BW, or BIO.',
  gender:            'What gender symbol is shown? Reply ONLY with: M or F.',
  skin_dominant:     'What is the dominant skin name shown? Reply ONLY the skin name.',
  skin_recessive:    'What is the recessive skin name shown? Reply ONLY the skin name.',
  growth:            'What growth stage is shown? Reply ONLY with: Hatchling, Juvenile, Adult, or Elder.',
  ticks:             'What decimal tick number is shown? Reply ONLY the number, e.g. 0.27.',
  elder_status:      'What elder status is shown? Reply ONLY with: NO, ELDER, "4 Points", "5 Points", or "6 Points".',
  bloodline_quality: 'What bloodline quality grade is shown? Reply ONLY with one of: A, A-, B+, B, B-, C+, C, C-, D+, D, D-, E, or F.',
}
const GRADE_PROMPT = 'What stat grade is shown? Reply ONLY with one of: A++, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, E, or F. The dominant grade is shown in yellow and larger. If there is a smaller white grade below it, also state it separated by a slash, e.g. "A/B+".'
const NAME_PROMPT  = 'What name is displayed in this image? Reply ONLY with the name text, or UNKNOWN if no name is shown.'

async function readWithClaude(imageBuffer, fieldName, apiKey) {
  const b64 = imageBuffer.toString('base64')
  let prompt
  if (NAME_FIELDS.has(fieldName))             prompt = NAME_PROMPT
  else if (fieldName === 'bloodline_quality') prompt = CLAUDE_PROMPTS.bloodline_quality
  else if (ALL_STAT_KEYS.has(fieldName))      prompt = GRADE_PROMPT
  else                                         prompt = CLAUDE_PROMPTS[fieldName] || GRADE_PROMPT

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
          { type: 'text',  text: prompt },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`)
  }

  const respData = await res.json()
  const raw      = (respData.content?.[0]?.text || '').trim()

  // For stat fields with Claude, parse "A/B+" format → dominant/recessive
  if (ALL_STAT_KEYS.has(fieldName) && raw.includes('/')) {
    const [dom, rec] = raw.split('/').map(s => s.trim())
    return { dominant: cleanGrade(dom), recessive: cleanGrade(rec), uncertain: false }
  }

  const cleaner = FIELD_CLEANERS[fieldName]
  return cleaner ? cleaner(raw) : (raw || null)
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function readField(imageBuffer, fieldName, options = {}) {
  const { useClaudeVision = false, apiKey = null } = options

  // 1. Stats + bloodline: color-guided glyph OCR
  if (ALL_STAT_KEYS.has(fieldName)) {
    if (useClaudeVision && apiKey) {
      try {
        const r = await readWithClaude(imageBuffer, fieldName, apiKey)
        if (r && typeof r === 'object') return r
      } catch (err) { console.warn(`[ocr] Claude failed for ${fieldName}:`, err.message) }
    }
    const { dominant, recessive } = await readStatGrade(imageBuffer)
    return { dominant, recessive, uncertain: !dominant }
  }

  if (fieldName === 'bloodline_quality') {
    if (useClaudeVision && apiKey) {
      try {
        const r = await readWithClaude(imageBuffer, fieldName, apiKey)
        if (r) return r
      } catch (err) { console.warn(`[ocr] Claude failed for bloodline:`, err.message) }
    }
    const { value, uncertain } = await readBloodlineGrade(imageBuffer)
    return value  // captureService expects plain string for non-stat fields
  }

  // 2. Icons: pHash template matching
  if (ICON_FIELDS.has(fieldName)) {
    if (useClaudeVision && apiKey) {
      try {
        const r = await readWithClaude(imageBuffer, fieldName, apiKey)
        if (r) return r
      } catch (err) { console.warn(`[ocr] Claude failed for ${fieldName}:`, err.message) }
    }
    const match = await tryIconMatch(imageBuffer, fieldName)
    return match ? match.label : null
  }

  // 3. Claude Vision for text fields (paid, optional)
  if (useClaudeVision && apiKey) {
    try { return await readWithClaude(imageBuffer, fieldName, apiKey) }
    catch (err) { console.warn(`[ocr] Claude failed for ${fieldName}, using alphabet OCR:`, err.message) }
  }

  // 4. Alphabet OCR for names / skin / ticks
  if (ALPHABET_FIELDS.has(fieldName)) {
    try {
      const raw     = await readWithAlphabetOCR(imageBuffer)
      const cleaner = FIELD_CLEANERS[fieldName]
      const cleaned = cleaner ? cleaner(raw) : (raw || null)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ocr] alphabet "${fieldName}" → "${cleaned}" (raw: "${raw}")`)
      }
      return cleaned
    } catch (err) {
      console.warn(`[ocr] alphabet OCR failed for ${fieldName}:`, err.message)
      return NAME_FIELDS.has(fieldName) ? '' : null
    }
  }

  return null
}

async function readAllStats(fieldBuffers, options = {}) {
  const stats  = {}
  const rStats = {}

  for (const [fieldName, buffer] of fieldBuffers.entries()) {
    if (!ALL_STAT_KEYS.has(fieldName)) continue
    try {
      const result = await readField(buffer, fieldName, options)
      if (result && typeof result === 'object') {
        if (result.dominant)  stats[fieldName]          = result.dominant
        if (result.recessive) rStats[`r_${fieldName}`]  = result.recessive
      } else if (typeof result === 'string' && result) {
        stats[fieldName] = result
      }
    } catch (err) {
      console.warn(`[ocr] readAllStats failed for ${fieldName}:`, err.message)
    }
  }

  return { stats, rStats }
}

function destroyWorker() {}

module.exports = { readField, readAllStats, destroyWorker, getTrainingDataDir }
