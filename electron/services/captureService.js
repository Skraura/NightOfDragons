/**
 * captureService.js — Beta1.1
 *
 * Changes from Beta1.0:
 *  - Box config is now stored as percentage ratios; this service resolves them
 *    to absolute pixels using the actual screenshot dimensions at capture time,
 *    so no calibration is needed per-resolution.
 */
const sharp          = require('sharp')
const { v4: uuidv4 } = require('uuid')
const localStore     = require('./localStore')
const screenshotSvc  = require('./screenshotService')
const ocrService     = require('./ocrService')
const firebase       = require('./firebaseService')

// ─── Dev training: last crop cache ───────────────────────────────────────────
let _lastCrops = null

function getLastCrops() {
  if (!_lastCrops) return { ok: false, error: 'No capture has been performed yet' }
  return { ok: true, crops: _lastCrops }
}

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

  const b64    = await screenshotSvc.takeScreenshot()
  const pngBuf = Buffer.from(b64, 'base64')

  // Resolve actual pixel dimensions from the screenshot itself
  const meta       = await sharp(pngBuf).metadata()
  const resolution = `${meta.width}x${meta.height}`

  // getBoxConfig now uses the pct config and converts to pixels for this resolution
  const boxes = localStore.getBoxConfig(resolution)
  if (!boxes || !Object.keys(boxes).length) {
    return { ok: false, error: 'No calibration config found. Please recalibrate in Settings.' }
  }

  const settings        = localStore.getSettings()
  const useClaudeVision = !!(apiKey && settings.highAccuracyMode)

  const extractedData = {}
  const cropCache     = {}
  for (const [fieldName, box] of Object.entries(boxes)) {
    try {
      const cropped = await cropRegion(pngBuf, box)
      cropCache[fieldName] = cropped.toString('base64')
      const result  = await ocrService.readField(cropped, fieldName, { useClaudeVision, apiKey })

      if (result && typeof result === 'object' && 'dominant' in result) {
        if (result.dominant) extractedData[fieldName] = result.dominant
        if (result.recessive) extractedData[`r_${fieldName}`] = result.recessive
      } else {
        extractedData[fieldName] = result
      }
    } catch (err) {
      console.error(`[capture] field "${fieldName}" failed:`, err.message)
      extractedData[fieldName] = null
    }
  }

  // Auto-derive elder/ticks from growth field
  if (extractedData.growth) {
    const g = extractedData.growth
    if (g === 'Elder') {
      extractedData.is_elder     = 1
      extractedData.elder_status = 'ELDER'
      extractedData.ticks        = 1.0
    } else if (g === 'Hatchling' || g === 'Juvenile') {
      extractedData.is_elder     = 0
      extractedData.elder_status = 'NO'
      extractedData.ticks        = 0.0
    } else {
      extractedData.is_elder     = 0
      extractedData.elder_status = 'NO'
    }
  }

  const hasRecessive = Object.values(extractedData).some(v =>
    v && typeof v === 'object' && v.recessive
  )
  if (hasRecessive && !extractedData.trait_dominant) {
    extractedData.trait_dominant = 4
  }

  // ── OCR lineage name matching ──────────────────────────────────────────────
  try {
    const allDragons = await firebase.getAllDragons(userId)
    const species    = extractedData.species

    const nameFields = [
      { nameKey: 'father_name', idKey: 'father_id', gender: 'M' },
      { nameKey: 'mother_name', idKey: 'mother_id', gender: 'F' },
    ]

    for (const { nameKey, idKey, gender } of nameFields) {
      const ocrName = extractedData[nameKey]
      if (!ocrName || ocrName === 'UNKNOWN') continue

      const match = allDragons.find(d => {
        if (d.is_dead) return true
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
  _lastCrops = cropCache
  localStore.appendCropHistory({ captureId, userId, data: extractedData })

  return {
    ok: true,
    captureId,
    data: extractedData,
    ocrMode: useClaudeVision ? 'claude-vision' : 'tesseract',
    needsConfirmation: true,
  }
}

module.exports = { takeScreenshot, captureAndProcess, getLastCrops }
