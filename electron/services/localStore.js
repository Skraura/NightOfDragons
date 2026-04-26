/**
 * localStore.js — v5.3
 *
 * Handles all LOCAL-ONLY persistence (never synced to Firebase):
 *   - Box calibration configs
 *   - App settings (theme, API key, lineage prefs)
 *   - Crop / capture history
 *
 * Storage: JSON files in Electron's userData directory.
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

// ─── Default box calibration for 1920×1080 fullscreen ────────────────────────
// Coordinates are relative to the screenshot pixel space.
// These defaults target the typical DoD UI layout at 1080p fullscreen.
// Users with different resolutions or windowed mode should recalibrate.
const DEFAULT_BOX_CONFIGS = {
  '1920x1080': {
    species:              { x: 90,   y: 38,  w: 160, h: 28 },
    gender:               { x: 260,  y: 38,  w: 40,  h: 28 },
    skin_dominant:        { x: 90,   y: 70,  w: 240, h: 26 },
    skin_recessive:       { x: 90,   y: 100, w: 240, h: 26 },
    growth:               { x: 90,   y: 130, w: 160, h: 26 },
    ticks:                { x: 90,   y: 160, w: 80,  h: 26 },
    elder_status:         { x: 180,  y: 160, w: 80,  h: 26 },
    bloodline_quality:    { x: 90,   y: 190, w: 120, h: 26 },
    // Stats — right panel, stacked
    stat_life_expectancy:    { x: 1480, y: 80,  w: 80, h: 22 },
    stat_scale_thickness:    { x: 1480, y: 110, w: 80, h: 22 },
    stat_stamina:            { x: 1480, y: 140, w: 80, h: 22 },
    stat_agility:            { x: 1480, y: 170, w: 80, h: 22 },
    stat_strength:           { x: 1480, y: 200, w: 80, h: 22 },
    stat_growth_rate:        { x: 1480, y: 230, w: 80, h: 22 },
    stat_armor:              { x: 1480, y: 260, w: 80, h: 22 },
    stat_venom:              { x: 1480, y: 290, w: 80, h: 22 },
    stat_bite_force:         { x: 1480, y: 320, w: 80, h: 22 },
    stat_power:              { x: 1480, y: 350, w: 80, h: 22 },
    stat_nutrient_absorption:{ x: 1480, y: 380, w: 80, h: 22 },
    stat_water_retention:    { x: 1480, y: 410, w: 80, h: 22 },
    stat_toxin_tolerance:    { x: 1480, y: 440, w: 80, h: 22 },
    stat_impact_resistance:  { x: 1480, y: 470, w: 80, h: 22 },
    stat_pierce_resistance:  { x: 1480, y: 500, w: 80, h: 22 },
    stat_fire_resistance:    { x: 1480, y: 530, w: 80, h: 22 },
    stat_frost_resistance:   { x: 1480, y: 560, w: 80, h: 22 },
    stat_plasma_resistance:  { x: 1480, y: 590, w: 80, h: 22 },
    stat_lightning_resistance:{ x: 1480, y: 620, w: 80, h: 22 },
    stat_acid_resistance:    { x: 1480, y: 650, w: 80, h: 22 },
    stat_venom_resistance:   { x: 1480, y: 680, w: 80, h: 22 },
    stat_bile_production:    { x: 1480, y: 710, w: 80, h: 22 },
    // Lineage names
    father_name:       { x: 90,  y: 540, w: 240, h: 24 },
    mother_name:       { x: 90,  y: 570, w: 240, h: 24 },
    grandfather1_name: { x: 90,  y: 600, w: 240, h: 24 },
    grandfather2_name: { x: 90,  y: 630, w: 240, h: 24 },
    grandmother1_name: { x: 340, y: 600, w: 240, h: 24 },
    grandmother2_name: { x: 340, y: 630, w: 240, h: 24 },
    player_name:       { x: 90,  y: 660, w: 240, h: 24 },
  },
}

// ─── Box Config ───────────────────────────────────────────────────────────────

function getBoxConfig(resolution) {
  const file = path.join(getDir(), `boxconfig-${resolution}.json`)
  const saved = readJSON(file)
  if (saved) return saved
  // Return default if available, else null
  return DEFAULT_BOX_CONFIGS[resolution] || DEFAULT_BOX_CONFIGS['1920x1080'] || null
}

function saveBoxConfig(resolution, boxes) {
  const file = path.join(getDir(), `boxconfig-${resolution}.json`)
  writeJSON(file, boxes)
  return { ok: true }
}

function resetBoxConfig(resolution) {
  const file = path.join(getDir(), `boxconfig-${resolution}.json`)
  try { fs.unlinkSync(file) } catch {}
  return { ok: true }
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
  getBoxConfig, saveBoxConfig, resetBoxConfig,
  // Settings
  getSettings, saveSettings,
  // History
  getCropHistory, appendCropHistory, clearCropHistory,
}
