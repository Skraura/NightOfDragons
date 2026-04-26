/**
 * captureService.js — v5.3
 * Removed: SQLite capture_history; now uses localStore
 * Added:   localStore for box config + history logging
 */
const sharp          = require('sharp')
const { v4: uuidv4 } = require('uuid')
const localStore     = require('./localStore')
const screenshotSvc  = require('./screenshotService')
const ocrService     = require('./ocrService')
const firebase       = require('./firebaseService')

async function cropRegion(pngBuffer, box) {
  return sharp(pngBuffer)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .png()
    .toBuffer()
}

async function takeScreenshot() {
  return screenshotSvc.takeScreenshot()
}

async function captureAndProcess(userId, apiKey) {
  if (!userId) return { ok: false, error: 'No user is logged in.' }

  const { screen } = require('electron')
  const display    = screen.getPrimaryDisplay()
  const resolution = `${display.bounds.width}x${display.bounds.height}`

  const boxes = localStore.getBoxConfig(resolution)
  if (!boxes || !Object.keys(boxes).length) {
    return { ok: false, error: `No calibration found for ${resolution}. Go to Settings → Calibrate.` }
  }

  // Check high-accuracy mode from local settings
  const settings      = localStore.getSettings()
  const useClaudeVision = !!(apiKey && settings.highAccuracyMode)

  const b64    = await screenshotSvc.takeScreenshot()
  const pngBuf = Buffer.from(b64, 'base64')

  const extractedData = {}
  for (const [fieldName, box] of Object.entries(boxes)) {
    try {
      const cropped = await cropRegion(pngBuf, box)
      extractedData[fieldName] = await ocrService.readField(cropped, fieldName, { useClaudeVision, apiKey })
    } catch (err) {
      console.error(`[capture] field "${fieldName}" failed:`, err.message)
      extractedData[fieldName] = null
    }
  }

  // Auto-derive elder/ticks from growth field
  if (extractedData.growth) {
    const g = extractedData.growth
    if (g === 'Elder') {
      extractedData.is_elder    = 1
      extractedData.elder_status = 'ELDER'
      extractedData.ticks        = 1.0
    } else if (g === 'Hatchling' || g === 'Juvenile') {
      extractedData.is_elder    = 0
      extractedData.elder_status = 'NO'
      extractedData.ticks        = 0.0
    } else {
      extractedData.is_elder    = 0
      extractedData.elder_status = 'NO'
    }
  }

  // Auto-detect Dominant trait from recessive stats
  const hasRecessive = Object.values(extractedData).some(v =>
    v && typeof v === 'object' && v.recessive
  )
  if (hasRecessive && !extractedData.trait_dominant) {
    extractedData.trait_dominant = 4
  }

  // ── OCR lineage name matching ────────────────────────────────────────────────
  // If OCR read a parent/grandparent name that matches a registered dragon
  // of the same species, auto-link the dragon ID.
  try {
    const allDragons = await firebase.getAllDragons(userId)
    const species    = extractedData.species

    const nameFields = [
      { nameKey: 'father_name',       idKey: 'father_id',  gender: 'M' },
      { nameKey: 'mother_name',       idKey: 'mother_id',  gender: 'F' },
    ]

    for (const { nameKey, idKey, gender } of nameFields) {
      const ocrName = extractedData[nameKey]
      if (!ocrName || ocrName === 'UNKNOWN') continue

      // Find a dragon with matching player_name (case-insensitive) and same species
      const match = allDragons.find(d => {
        if (d.is_dead) return true  // dead dragons can still be parents
        if (species && d.species !== species) return false
        if (gender  && d.gender  !== gender)  return false
        const pn = (d.player_name || '').trim().toLowerCase()
        return pn && pn === ocrName.trim().toLowerCase()
      })

      if (match) {
        extractedData[idKey] = match.id
        console.log(`[capture] Auto-linked ${nameKey} "${ocrName}" → dragon ${match.id}`)
      }
    }
  } catch (err) {
    console.warn('[capture] Lineage auto-match failed:', err.message)
  }

  const captureId = uuidv4()

  // Log to local crop history (local only, per spec)
  localStore.appendCropHistory({ captureId, userId, data: extractedData })

  return {
    ok: true,
    captureId,
    data: extractedData,
    ocrMode: useClaudeVision ? 'claude-vision' : 'tesseract',
    needsConfirmation: true,
  }
}

module.exports = { takeScreenshot, captureAndProcess }
