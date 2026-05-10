/**
 * localStore.js — Beta1.1
 *
 * Handles all LOCAL-ONLY persistence (never synced to Firebase):
 *   - Box calibration configs (stored as PERCENTAGE-BASED ratios 0.0–1.0)
 *   - App settings (theme, API key, lineage prefs)
 *   - Crop / capture history
 *   - Dev-authored "bundled" calibration (written next to the executable,
 *     so it ships to users when the Dev builds a new release)
 *
 * Coordinate format (stored): { xPct, yPct, wPct, hPct } — all 0.0–1.0
 * Coordinate format (legacy / runtime): { x, y, w, h } — absolute pixels
 *
 * Helper functions toPixels() / toPct() convert between the two.
 */

const { app } = require('electron')
const path    = require('path')
const fs      = require('fs')

function getDir() {
  const dir = path.join(app.getPath('userData'), 'local-store')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/** Convert a pct-based box to absolute pixels for a given resolution string "WxH" */
function toPixels(pctBox, resolution) {
  const [w, h] = resolution.split('x').map(Number)
  return {
    x: Math.round(pctBox.xPct * w),
    y: Math.round(pctBox.yPct * h),
    w: Math.round(pctBox.wPct * w),
    h: Math.round(pctBox.hPct * h),
  }
}

/** Convert absolute-pixel box to pct-based for a given resolution string "WxH" */
function toPct(pixBox, resolution) {
  const [w, h] = resolution.split('x').map(Number)
  return {
    xPct: pixBox.x / w,
    yPct: pixBox.y / h,
    wPct: pixBox.w / w,
    hPct: pixBox.h / h,
  }
}

/** Detect if a config object uses the old pixel format (has .x) or new pct format (has .xPct) */
function isPctFormat(box) { return box && 'xPct' in box }

// ─── Default pct-based calibration (reference at 1920×1080 fullscreen) ────────
// These are the 1920×1080 pixel values divided by 1920/1080, giving ratios
// that adapt automatically to any screen resolution.
const DEFAULT_PCT_CONFIG = {
  species:              { xPct: 0.0469, yPct: 0.0352, wPct: 0.0833, hPct: 0.0259 },
  gender:               { xPct: 0.1354, yPct: 0.0352, wPct: 0.0208, hPct: 0.0259 },
  skin_dominant:        { xPct: 0.0469, yPct: 0.0648, wPct: 0.1250, hPct: 0.0241 },
  skin_recessive:       { xPct: 0.0469, yPct: 0.0926, wPct: 0.1250, hPct: 0.0241 },
  growth:               { xPct: 0.0469, yPct: 0.1204, wPct: 0.0833, hPct: 0.0241 },
  ticks:                { xPct: 0.0469, yPct: 0.1481, wPct: 0.0417, hPct: 0.0241 },
  elder_status:         { xPct: 0.0938, yPct: 0.1481, wPct: 0.0417, hPct: 0.0241 },
  bloodline_quality:    { xPct: 0.0469, yPct: 0.1759, wPct: 0.0625, hPct: 0.0241 },
  stat_life_expectancy:     { xPct: 0.7708, yPct: 0.0741, wPct: 0.0417, hPct: 0.0204 },
  stat_scale_thickness:     { xPct: 0.7708, yPct: 0.1019, wPct: 0.0417, hPct: 0.0204 },
  stat_stamina:             { xPct: 0.7708, yPct: 0.1296, wPct: 0.0417, hPct: 0.0204 },
  stat_agility:             { xPct: 0.7708, yPct: 0.1574, wPct: 0.0417, hPct: 0.0204 },
  stat_strength:            { xPct: 0.7708, yPct: 0.1852, wPct: 0.0417, hPct: 0.0204 },
  stat_growth_rate:         { xPct: 0.7708, yPct: 0.2130, wPct: 0.0417, hPct: 0.0204 },
  stat_armor:               { xPct: 0.7708, yPct: 0.2407, wPct: 0.0417, hPct: 0.0204 },
  stat_venom:               { xPct: 0.7708, yPct: 0.2685, wPct: 0.0417, hPct: 0.0204 },
  stat_bite_force:          { xPct: 0.7708, yPct: 0.2963, wPct: 0.0417, hPct: 0.0204 },
  stat_power:               { xPct: 0.7708, yPct: 0.3241, wPct: 0.0417, hPct: 0.0204 },
  stat_nutrient_absorption: { xPct: 0.7708, yPct: 0.3519, wPct: 0.0417, hPct: 0.0204 },
  stat_water_retention:     { xPct: 0.7708, yPct: 0.3796, wPct: 0.0417, hPct: 0.0204 },
  stat_toxin_tolerance:     { xPct: 0.7708, yPct: 0.4074, wPct: 0.0417, hPct: 0.0204 },
  stat_impact_resistance:   { xPct: 0.7708, yPct: 0.4352, wPct: 0.0417, hPct: 0.0204 },
  stat_pierce_resistance:   { xPct: 0.7708, yPct: 0.4630, wPct: 0.0417, hPct: 0.0204 },
  stat_fire_resistance:     { xPct: 0.7708, yPct: 0.4907, wPct: 0.0417, hPct: 0.0204 },
  stat_frost_resistance:    { xPct: 0.7708, yPct: 0.5185, wPct: 0.0417, hPct: 0.0204 },
  stat_plasma_resistance:   { xPct: 0.7708, yPct: 0.5463, wPct: 0.0417, hPct: 0.0204 },
  stat_lightning_resistance:{ xPct: 0.7708, yPct: 0.5741, wPct: 0.0417, hPct: 0.0204 },
  stat_acid_resistance:     { xPct: 0.7708, yPct: 0.6019, wPct: 0.0417, hPct: 0.0204 },
  stat_venom_resistance:    { xPct: 0.7708, yPct: 0.6296, wPct: 0.0417, hPct: 0.0204 },
  stat_bile_production:     { xPct: 0.7708, yPct: 0.6574, wPct: 0.0417, hPct: 0.0204 },
  father_name:       { xPct: 0.0469, yPct: 0.5000, wPct: 0.1250, hPct: 0.0222 },
  mother_name:       { xPct: 0.0469, yPct: 0.5278, wPct: 0.1250, hPct: 0.0222 },
  grandfather1_name: { xPct: 0.0469, yPct: 0.5556, wPct: 0.1250, hPct: 0.0222 },
  grandfather2_name: { xPct: 0.0469, yPct: 0.5833, wPct: 0.1250, hPct: 0.0222 },
  grandmother1_name: { xPct: 0.1771, yPct: 0.5556, wPct: 0.1250, hPct: 0.0222 },
  grandmother2_name: { xPct: 0.1771, yPct: 0.5833, wPct: 0.1250, hPct: 0.0222 },
  player_name:       { xPct: 0.0469, yPct: 0.6111, wPct: 0.1250, hPct: 0.0222 },
}

// ─── Bundled calibration path (dev-authored, ships with the build) ─────────────
// Stored next to the Electron resources so it survives userData wipes.
// On packed builds: <app>/resources/bundled-calibration.json
// On dev builds:    project root / bundled-calibration.json
function getBundledCalibrationPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bundled-calibration.json')
  }
  return path.join(app.getAppPath(), 'bundled-calibration.json')
}

function readBundledCalibration() {
  try { return readJSON(getBundledCalibrationPath()) } catch { return null }
}

function writeBundledCalibration(pctConfig) {
  writeJSON(getBundledCalibrationPath(), pctConfig)
  return { ok: true }
}

// ─── Box Config ───────────────────────────────────────────────────────────────

/**
 * Returns a pixel-based box config for the given resolution.
 * Priority: user-saved pct config > bundled dev config > built-in default.
 */
function getBoxConfig(resolution) {
  // 1. User-overridden pct config saved in userData
  const file  = path.join(getDir(), 'boxconfig-pct.json')
  const saved = readJSON(file)
  if (saved) {
    return _pctConfigToPixels(saved, resolution)
  }

  // 2. Dev-authored bundled calibration (ships with the build)
  const bundled = readBundledCalibration()
  if (bundled) {
    return _pctConfigToPixels(bundled, resolution)
  }

  // 3. Built-in default
  return _pctConfigToPixels(DEFAULT_PCT_CONFIG, resolution)
}

/** Convert a full pct config object → pixel-based for a given resolution */
function _pctConfigToPixels(pctConfig, resolution) {
  const result = {}
  for (const [field, box] of Object.entries(pctConfig)) {
    result[field] = toPixels(box, resolution)
  }
  return result
}

/**
 * Save calibration as pct-based.
 * Always writes to bundled-calibration.json (Dev-only operation).
 * `boxes` may arrive as pixel coords (from CalibratePage) — converted to pct.
 * @param {string} resolution  "1920x1080"
 * @param {object} boxes       pixel-based OR pct-based per-field boxes
 */
function saveBoxConfig(resolution, boxes) {
  const pctConfig = {}
  for (const [field, box] of Object.entries(boxes)) {
    pctConfig[field] = isPctFormat(box) ? box : toPct(box, resolution)
  }
  return writeBundledCalibration(pctConfig)
}

function resetBoxConfig() {
  const file = path.join(getDir(), 'boxconfig-pct.json')
  try { fs.unlinkSync(file) } catch {}
  return { ok: true }
}

/** Returns the raw pct config (for the calibration UI to display) */
function getBoxConfigPct() {
  const file   = path.join(getDir(), 'boxconfig-pct.json')
  const saved  = readJSON(file)
  if (saved) return saved
  const bundled = readBundledCalibration()
  if (bundled) return bundled
  return DEFAULT_PCT_CONFIG
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function getSettings() {
  const file = path.join(getDir(), 'settings.json')
  return readJSON(file) || {}
}

function saveSettings(settings) {
  const file = path.join(getDir(), 'settings.json')
  const current = readJSON(file) || {}
  writeJSON(file, { ...current, ...settings })
  return { ok: true }
}

// ─── Crop / Capture History ───────────────────────────────────────────────────

const HISTORY_MAX = 50

function getCropHistory() {
  const file = path.join(getDir(), 'crop-history.json')
  return readJSON(file) || []
}

function appendCropHistory(entry) {
  const file    = path.join(getDir(), 'crop-history.json')
  const history = getCropHistory()
  history.unshift({ ...entry, ts: Date.now() })
  if (history.length > HISTORY_MAX) history.splice(HISTORY_MAX)
  writeJSON(file, history)
  return { ok: true }
}

function clearCropHistory() {
  const file = path.join(getDir(), 'crop-history.json')
  writeJSON(file, [])
  return { ok: true }
}

module.exports = {
  // Box config
  getBoxConfig, saveBoxConfig, resetBoxConfig, getBoxConfigPct,
  // Bundled calibration
  writeBundledCalibration, readBundledCalibration,
  // Settings
  getSettings, saveSettings,
  // History
  getCropHistory, appendCropHistory, clearCropHistory,
  // Helpers (exported for captureService)
  toPixels, toPct,
}
