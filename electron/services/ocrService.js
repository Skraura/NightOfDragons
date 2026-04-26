/**
 * OCR Service — v4
 *
 * MODE 1 (default, FREE):  Tesseract.js v5 — offline, no API key needed
 * MODE 2 (optional, PAID): Claude Vision (claude-haiku) — better on stylized fonts
 *
 * Routing:
 *   - Icon fields (gender, species, growth, elder_status) → template matching only
 *   - Stat grade fields (all 22 stats + bloodline_quality) → template matching first,
 *     then Claude Vision or Tesseract fallback
 *   - Name fields (father/mother/grandparents/player) → Tesseract with name whitelist
 *     (UNKNOWN result → stored as empty string, treated as "no info")
 *   - Text fields (skin, ticks) → Tesseract / Claude Vision
 */

const sharp = require('sharp')
const path  = require('path')
const { pathToFileURL } = require('url')
const { app } = require('electron')

// ─── Constants ────────────────────────────────────────────────────────────────
const SPECIES_LIST = ['FS','SS','ASD','IR','BS','BW','BIO']
const GRADE_LIST   = ['A++','A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E','F']
const BLOODLINE_GRADE_LIST = ['A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E','F']
const GROWTH_LIST  = ['Hatchling','Juvenile','Adult','Elder']

// All 22 stat field keys
const ALL_STAT_KEYS = new Set([
  'stat_life_expectancy', 'stat_scale_thickness', 'stat_stamina', 'stat_agility',
  'stat_strength', 'stat_growth_rate', 'stat_armor', 'stat_venom',
  'stat_bite_force', 'stat_power', 'stat_nutrient_absorption', 'stat_water_retention',
  'stat_toxin_tolerance', 'stat_impact_resistance', 'stat_pierce_resistance',
  'stat_fire_resistance', 'stat_frost_resistance', 'stat_plasma_resistance',
  'stat_lightning_resistance', 'stat_acid_resistance', 'stat_venom_resistance',
  'stat_bile_production',
])

// Name fields — use Tesseract text OCR with name whitelist
const NAME_FIELDS = new Set([
  'father_name', 'mother_name',
  'grandfather1_name', 'grandfather2_name',
  'grandmother1_name', 'grandmother2_name',
  'player_name',
])

// ─── Field cleaners ───────────────────────────────────────────────────────────

function cleanSpecies(raw) {
  if (!raw) return null
  const up = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  for (const s of SPECIES_LIST) {
    if (up.includes(s)) return s
  }
  const fixes = { 'F5':'FS', 'S5':'SS', 'A5D':'ASD', 'BI0':'BIO', 'B10':'BIO' }
  return fixes[up] || null
}

function cleanGrade(raw) {
  if (!raw) return null
  const s = raw.trim().toUpperCase().replace(/\s+/g, '')
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

/** Bloodline Quality: same as cleanGrade but rejects A+ and A++ */
function cleanBloodlineGrade(raw) {
  const grade = cleanGrade(raw)
  if (!grade) return null
  if (grade === 'A++' || grade === 'A+') return null // capped at A
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
  for (const r of GROWTH_LIST) {
    if (lo.includes(r.toLowerCase())) return r
  }
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
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .substring(0, 60) || null
}

/**
 * Clean a raw in-game name.
 * - Returns empty string "" for blank / UNKNOWN (spawned dragons with no lineage).
 * - Strips non-printable chars, limits to 32 chars.
 */
function cleanName(raw) {
  if (!raw) return ''
  const trimmed = raw.trim()
  // Blank or the literal word UNKNOWN → empty string (no lineage info)
  if (!trimmed || trimmed.toUpperCase() === 'UNKNOWN') return ''
  // Keep only printable ASCII (game names are alphanumeric + spaces + hyphens)
  return trimmed
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 32)
}

// Build FIELD_CLEANERS dynamically so new stat keys always get cleanGrade
const FIELD_CLEANERS = {
  species:           cleanSpecies,
  gender:            cleanGender,
  skin_dominant:     cleanSkin,
  skin_recessive:    cleanSkin,
  growth:            cleanGrowth,
  ticks:             cleanTicks,
  elder_status:      cleanElderStatus,
  bloodline_quality: cleanBloodlineGrade,
  // Name fields
  father_name:       cleanName,
  mother_name:       cleanName,
  grandfather1_name: cleanName,
  grandfather2_name: cleanName,
  grandmother1_name: cleanName,
  grandmother2_name: cleanName,
  player_name:       cleanName,
}
// All stat keys → cleanGrade
for (const key of ALL_STAT_KEYS) {
  FIELD_CLEANERS[key] = cleanGrade
}

// ─── Image pre-processing ─────────────────────────────────────────────────────
async function preprocessForOCR(inputBuffer) {
  const meta = await sharp(inputBuffer).metadata()
  const newW  = (meta.width  || 100) * 3
  const newH  = (meta.height || 30)  * 3

  return sharp(inputBuffer)
    .resize(newW, newH, { kernel: sharp.kernel.lanczos3 })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.2 })
    .png()
    .toBuffer()
}

// ─── Tesseract.js v5 (FREE, OFFLINE) ─────────────────────────────────────────
let _worker     = null
let _nameWorker = null

async function getWorker() {
  if (_worker) return _worker
  const { createWorker } = require('tesseract.js')
  const isDev = !app.isPackaged
  const tessdataDir = isDev
    ? path.join(__dirname, '..', 'tessdata')
    : path.join(process.resourcesPath, 'tessdata')

  const workerScriptPath = require.resolve('tesseract.js/src/worker-script/node/index.js')
  const wasmPath = require.resolve('tesseract.js-core/tesseract-core-simd-lstm.wasm')

  _worker = await createWorker('eng', 1, {
    langPath:   pathToFileURL(tessdataDir).href,
    workerPath: pathToFileURL(workerScriptPath).href,
    corePath:   pathToFileURL(wasmPath).href,
    gzip:       false,
    logger:     () => {},
  })
  await _worker.setParameters({
    tessedit_pageseg_mode: '7',
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.+- ',
  })
  return _worker
}

/** Dedicated worker for name fields — broader whitelist, no grade symbols */
async function getNameWorker() {
  if (_nameWorker) return _nameWorker
  const { createWorker } = require('tesseract.js')
  const isDev = !app.isPackaged
  const tessdataDir = isDev
    ? path.join(__dirname, '..', 'tessdata')
    : path.join(process.resourcesPath, 'tessdata')

  const workerScriptPath = require.resolve('tesseract.js/src/worker-script/node/index.js')
  const wasmPath = require.resolve('tesseract.js-core/tesseract-core-simd-lstm.wasm')

  _nameWorker = await createWorker('eng', 1, {
    langPath:   pathToFileURL(tessdataDir).href,
    workerPath: pathToFileURL(workerScriptPath).href,
    corePath:   pathToFileURL(wasmPath).href,
    gzip:       false,
    logger:     () => {},
  })
  await _nameWorker.setParameters({
    tessedit_pageseg_mode: '7',
    // Allow full alphabet + digits + hyphen + space (in-game names)
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- ',
  })
  return _nameWorker
}

async function readWithTesseract(imageBuffer, fieldName) {
  const processed = await preprocessForOCR(imageBuffer)

  let raw
  if (NAME_FIELDS.has(fieldName)) {
    const worker = await getNameWorker()
    const { data } = await worker.recognize(processed)
    raw = (data.text || '').trim()
  } else {
    const worker = await getWorker()
    const { data } = await worker.recognize(processed)
    raw = (data.text || '').trim()
  }

  const cleaner = FIELD_CLEANERS[fieldName]
  return cleaner ? cleaner(raw) : (raw || null)
}

// ─── Claude Vision (OPTIONAL, PAID) ──────────────────────────────────────────
const CLAUDE_PROMPTS = {
  species:      'What dragon species code is shown? Reply ONLY with: FS, SS, ASD, IR, BS, BW, or BIO.',
  gender:       'What gender symbol is shown? Reply ONLY with: M or F.',
  skin_dominant:  'What is the dominant skin name shown? Reply ONLY the skin name.',
  skin_recessive: 'What is the recessive skin name shown? Reply ONLY the skin name.',
  growth:       'What growth stage is shown? Reply ONLY with: Hatchling, Juvenile, Adult, or Elder.',
  ticks:        'What decimal tick number is shown? Reply ONLY the number, e.g. 0.27.',
  elder_status: 'What elder status is shown? Reply ONLY with: NO, ELDER, "4 Points", "5 Points", or "6 Points".',
  bloodline_quality: 'What bloodline quality grade is shown? Reply ONLY with one of: A, A-, B+, B, B-, C+, C, C-, D+, D, D-, E, or F.',
}

const GRADE_PROMPT =
  'What stat grade is shown? Reply ONLY with one of: A++, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, E, or F.'

const NAME_PROMPT =
  'What name is displayed in this image? Reply ONLY with the name text, or UNKNOWN if no name is shown.'

async function readWithClaude(imageBuffer, fieldName, apiKey) {
  const b64 = imageBuffer.toString('base64')
  let prompt
  if (NAME_FIELDS.has(fieldName)) {
    prompt = NAME_PROMPT
  } else if (fieldName === 'bloodline_quality') {
    prompt = CLAUDE_PROMPTS.bloodline_quality
  } else if (ALL_STAT_KEYS.has(fieldName)) {
    prompt = GRADE_PROMPT
  } else {
    prompt = CLAUDE_PROMPTS[fieldName] || GRADE_PROMPT
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
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

  const data  = await res.json()
  const raw   = (data.content?.[0]?.text || '').trim()
  const cleaner = FIELD_CLEANERS[fieldName]
  return cleaner ? cleaner(raw) : (raw || null)
}

// ─── Template matching ────────────────────────────────────────────────────────
let _templateService = null

function getTemplateService() {
  if (!_templateService) _templateService = require('./templateService')
  return _templateService
}

async function tryTemplateMatch(imageBuffer, fieldName) {
  // Name fields never go through template matching
  if (NAME_FIELDS.has(fieldName)) return null
  try {
    const svc    = getTemplateService()
    const result = await svc.matchTemplate(imageBuffer, fieldName)
    if (result) {
      console.log(`[ocr] template "${fieldName}" → "${result.label}" (${result.confidence.toFixed(2)})`)
      return result.label
    }
  } catch (err) {
    console.warn(`[ocr] templateService error for "${fieldName}":`, err.message)
  }
  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────
async function readField(imageBuffer, fieldName, options = {}) {
  const { useClaudeVision = false, apiKey = null } = options

  // Name fields: skip template matching entirely, go straight to text OCR
  if (NAME_FIELDS.has(fieldName)) {
    if (useClaudeVision && apiKey) {
      try { return await readWithClaude(imageBuffer, fieldName, apiKey) }
      catch (err) { console.warn(`[ocr] Claude name OCR failed for ${fieldName}:`, err.message) }
    }
    return readWithTesseract(imageBuffer, fieldName)
  }

  // 1. Template matching (icons + stat grades + bloodline quality)
  const tmpl = await tryTemplateMatch(imageBuffer, fieldName)
  if (tmpl !== null) return tmpl

  // 2. Claude Vision (paid, optional)
  if (useClaudeVision && apiKey) {
    try { return await readWithClaude(imageBuffer, fieldName, apiKey) }
    catch (err) { console.warn(`[ocr] Claude failed for ${fieldName}, falling back:`, err.message) }
  }

  // 3. Tesseract fallback
  return readWithTesseract(imageBuffer, fieldName)
}

function destroyWorker() {
  if (_worker)     { _worker.terminate().catch(() => {}); _worker = null }
  if (_nameWorker) { _nameWorker.terminate().catch(() => {}); _nameWorker = null }
}

module.exports = { readField, destroyWorker }
