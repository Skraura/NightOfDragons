/**
 * main.js — v5.4
 *
 * Changes from v5.3:
 *  - Capture hotkey is now user-configurable (stored in local settings, default F8)
 *  - Calibration: screenshot is taken BEFORE minimizing so it captures DoD, not our app
 *  - growth='Elder' auto-sets ticks=1, is_elder=1 in capture pipeline
 */

const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const session = { userId: null, apiKey: null, role: 'member' }

// Helper: admin rights = 'admin' or 'dev' role
function sessionIsAdmin() { return session.role === 'admin' || session.role === 'dev' }

let firebase, localStore, captureService, templateService
let mainWindow = null, calibrationWindow = null
let registeredHotkey = null   // currently registered shortcut string

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 600,
    frame: false, backgroundColor: '#0d0f14',
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  isDev ? mainWindow.loadURL('http://localhost:5173') : mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  mainWindow.on('closed', () => { mainWindow = null })
}

function createCalibrationWindow(displayId) {
  const target = screen.getAllDisplays().find(d => d.id === displayId) || screen.getPrimaryDisplay()
  const { x, y, width, height } = target.bounds
  calibrationWindow = new BrowserWindow({
    x, y, width, height, frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  const url = isDev ? 'http://localhost:5173/#/calibrate' : `file://${path.join(__dirname, '../dist/index.html')}#/calibrate`
  calibrationWindow.loadURL(url)
  calibrationWindow.on('closed', () => {
    calibrationWindow = null
    if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus() }
  })
  return calibrationWindow
}

// ── Hotkey management ──────────────────────────────────────────────────────────
function registerCaptureHotkey(accelerator) {
  if (registeredHotkey) {
    try { globalShortcut.unregister(registeredHotkey) } catch {}
    registeredHotkey = null
  }
  const key = accelerator || 'F8'
  try {
    const ok = globalShortcut.register(key, async () => {
      if (!session.userId) {
        mainWindow?.webContents.send('capture:error', 'No user logged in.')
        return
      }
      try {
        const result = await captureService.captureAndProcess(session.userId, session.apiKey)
        mainWindow?.webContents.send('capture:result', result)
      } catch (err) {
        mainWindow?.webContents.send('capture:error', err.message)
      }
    })
    if (ok) {
      registeredHotkey = key
      console.log(`[hotkey] Registered capture key: ${key}`)
    } else {
      console.warn(`[hotkey] Could not register ${key} — key may be in use`)
      mainWindow?.webContents.send('capture:error', `Could not register hotkey ${key} — it may be in use by another app.`)
    }
  } catch (err) {
    console.warn(`[hotkey] Error registering ${key}:`, err.message)
  }
}

app.whenReady().then(async () => {
  firebase       = require('./services/firebaseService')
  localStore     = require('./services/localStore')
  captureService = require('./services/captureService')
  templateService = require('./services/templateService')

  // MUST await — restoreSession re-authenticates with Firebase.
  // If we don't wait, Firestore calls from the renderer will have no auth token.
  const saved = await firebase.restoreSession()
  if (saved) { session.userId = saved.id; session.role = saved.role || 'member' }

  templateService.loadAllTemplates().catch(err => console.warn('[main] Template preload failed:', err.message))
  createMainWindow()

  // Register capture hotkey from saved settings (default F8)
  const settings = localStore.getSettings()
  registerCaptureHotkey(settings.captureKey || 'F8')

  // ── Dev capture hotkeys (Ctrl+F5 and Ctrl+Shift+F5) ──────────────────────
  // Both trigger the dev data-store window. Ctrl+F5 = quick capture+label.
  // Ctrl+Shift+F5 = alternate (in case Ctrl+F5 is taken by browser/OS).
  // Both are no-ops unless the session role is dev or admin.
  async function fireDevCapture() {
    if (!session.userId) return
    if (session.role !== 'dev' && session.role !== 'admin') return
    try {
      const result = await captureService.captureAndProcess(session.userId, session.apiKey)
      mainWindow?.webContents.send('devCapture:result', result)
    } catch (err) {
      mainWindow?.webContents.send('devCapture:error', err.message)
    }
  }

  const devHotkeys = ['CommandOrControl+F5', 'CommandOrControl+Shift+F5']
  for (const key of devHotkeys) {
    try {
      const ok = globalShortcut.register(key, fireDevCapture)
      if (ok) console.log(`[hotkey] Registered dev capture key: ${key}`)
      else    console.warn(`[hotkey] Could not register ${key} — key may be in use`)
    } catch (err) {
      console.warn(`[hotkey] Error registering ${key}:`, err.message)
    }
  }

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  try { require('./services/ocrService').destroyWorker() } catch {}
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', () => { try { require('./services/ocrService').destroyWorker() } catch {} })

// ── IPC: Session ──────────────────────────────────────────────────────────────
ipcMain.handle('session:setUser',      (_, { userId, role }) => { session.userId = userId || null; session.role = role || 'member'; return { ok: true } })
ipcMain.handle('session:setApiKey',    (_, { apiKey })       => { session.apiKey = apiKey || null; return { ok: true } })
ipcMain.handle('session:get',          ()                    => ({ userId: session.userId, hasApiKey: !!session.apiKey, role: session.role }))
ipcMain.handle('session:saveSettings', (_, s)                  => {
  const res = localStore.saveSettings(s)
  // If captureKey changed, re-register hotkey
  if (s.captureKey !== undefined) registerCaptureHotkey(s.captureKey || 'F8')
  return res
})
ipcMain.handle('session:loadSettings', () => localStore.getSettings())

// ── IPC: Window ───────────────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.handle('window:close',    () => mainWindow?.close())

// ── IPC: Auth ─────────────────────────────────────────────────────────────────
ipcMain.handle('auth:register', async (_, { email, password, displayName }) => {
  try { const r = await firebase.register(email, password, displayName); if (r.ok) { session.userId = r.user.id; session.role = r.user.role || 'member' } return r }
  catch (e) { return { ok: false, error: e.message } }
})
ipcMain.handle('auth:login', async (_, { email, password }) => {
  try { const r = await firebase.login(email, password); if (r.ok) { session.userId = r.user.id; session.role = r.user.role || 'member' } return r }
  catch (e) { return { ok: false, error: e.message } }
})
ipcMain.handle('auth:logout',         async ()                           => { const r = await firebase.logout(); session.userId = null; session.role = 'member'; return r })
ipcMain.handle('auth:restoreSession', async () => {
  try {
    const saved = await firebase.restoreSession()
    if (saved) { session.userId = saved.id; session.role = saved.role || 'member'; return { ok: true, user: saved } }
    return { ok: false }
  } catch { return { ok: false } }
})
ipcMain.handle('auth:listUsers',      async ()                           => { try { return await firebase.listUsers() } catch { return [] } })
ipcMain.handle('auth:updateRole',     async (_, { userId, role })        => { if (!sessionIsAdmin()) return { ok: false, error: 'Not authorized' }; return firebase.updateRole(userId, role) })
ipcMain.handle('auth:updatePassword', async (_, { userId, newPassword }) => { if (!sessionIsAdmin()) return { ok: false, error: 'Not authorized' }; return firebase.updatePassword(userId, newPassword) })
ipcMain.handle('auth:getCloudSettings', () => { try { return firebase.getCloudSettings() } catch { return {} } })

// ── IPC: Dragons ──────────────────────────────────────────────────────────────
ipcMain.handle('dragon:getAll',     async (_, { userId })           => firebase.getAllDragons(userId))
ipcMain.handle('dragon:get',        async (_, { userId, id })       => firebase.getDragon(userId, id))
ipcMain.handle('dragon:create',     async (_, { userId, data })     => firebase.createDragon(userId, data))
ipcMain.handle('dragon:update',     async (_, { userId, id, data }) => firebase.updateDragon(userId, id, data))
ipcMain.handle('dragon:delete',     async (_, { userId, id })       => firebase.deleteDragon(userId, id))
ipcMain.handle('dragon:setMate',    async (_, { dragonId, mateId }) => firebase.setMate(dragonId, mateId || null))
ipcMain.handle('dragon:getAllClan', async () => {
  if (!sessionIsAdmin()) return { ok: false, error: 'Admin access required' }
  try {
    const dragons = await firebase.getAllDragonsClan()
    return { ok: true, dragons }
  } catch (e) { return { ok: false, error: e.message } }
})

// ── IPC: Box Config ───────────────────────────────────────────────────────────
// Calibration is Dev-only; saving always writes to bundled-calibration.json
ipcMain.handle('boxconfig:get',        (_, { resolution })        => localStore.getBoxConfig(resolution))
ipcMain.handle('boxconfig:getPct',     ()                         => localStore.getBoxConfigPct())
ipcMain.handle('boxconfig:save',       (_, { resolution, boxes }) => {
  if (session.role !== 'dev') return { ok: false, error: 'Dev only' }
  return localStore.saveBoxConfig(resolution, boxes)
})
ipcMain.handle('boxconfig:getBundled', ()                         => ({ ok: true, data: localStore.readBundledCalibration() }))
ipcMain.handle('boxconfig:reset',      ()                         => {
  if (session.role !== 'dev') return { ok: false, error: 'Dev only' }
  return localStore.resetBoxConfig()
})

// ── IPC: Calibration ─────────────────────────────────────────────────────────
ipcMain.handle('calibration:open', async (_, { displayId }) => {
  if (!session.userId) return { ok: false, error: 'Not logged in' }
  if (calibrationWindow && !calibrationWindow.isDestroyed()) calibrationWindow.close()

  // CRITICAL FIX: Hide our app window FIRST, wait for it to fully disappear
  // from the compositor, THEN take the screenshot so we capture the game
  // and not our own app window.
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
    // Wait for the window to be fully removed from screen by the OS compositor
    await new Promise(resolve => setTimeout(resolve, 350))
  }

  // NOW take screenshot — our window is hidden, so we capture the game
  const b64 = await captureService.takeScreenshot()

  const win = createCalibrationWindow(displayId)
  const target = screen.getAllDisplays().find(d => d.id === displayId) || screen.getPrimaryDisplay()
  const resolution = `${target.bounds.width}x${target.bounds.height}`

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('calibration:init', { screenshot: b64, userId: session.userId, resolution, role: session.role })
  })
  return { ok: true }
})
ipcMain.handle('calibration:close', () => {
  if (calibrationWindow && !calibrationWindow.isDestroyed()) calibrationWindow.close()
  // Restore main window (was hidden, not minimized)
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus() }
  return { ok: true }
})
ipcMain.handle('calibration:getScreenshot', ()  => captureService.takeScreenshot())

// ── IPC: Screen ───────────────────────────────────────────────────────────────
ipcMain.handle('screen:getDisplays', () =>
  screen.getAllDisplays().map(d => ({ id: d.id, label: `Display ${d.id} (${d.bounds.width}×${d.bounds.height})`, bounds: d.bounds, primary: d === screen.getPrimaryDisplay() }))
)

// ── IPC: Capture ──────────────────────────────────────────────────────────────
ipcMain.handle('capture:manual', async () => {
  if (!session.userId) return { ok: false, error: 'No user logged in' }
  return captureService.captureAndProcess(session.userId, session.apiKey)
})

// ── IPC: Hotkey ───────────────────────────────────────────────────────────────
ipcMain.handle('hotkey:set', (_, { accelerator }) => {
  const prev = registeredHotkey
  registerCaptureHotkey(accelerator)
  const ok = registeredHotkey === accelerator
  if (ok) localStore.saveSettings({ captureKey: accelerator })
  else if (prev) registerCaptureHotkey(prev)  // rollback
  return { ok, registered: registeredHotkey }
})
ipcMain.handle('hotkey:get', () => ({ captureKey: registeredHotkey || 'F8' }))

// ── IPC: Training ─────────────────────────────────────────────────────────────
ipcMain.handle('training:list',   ()               => { try { return { ok: true, data: templateService.listTrainingSamples() } } catch (e) { return { ok: false, error: e.message } } })
ipcMain.handle('training:getDir', ()               => ({ ok: true, dir: templateService.getTrainingDataDir() }))
ipcMain.handle('training:reload', async (_, { fieldName }) => { try { return await templateService.reloadField(fieldName) } catch (e) { return { ok: false, error: e.message } } })

/**
 * training:saveBatch — dev tool saves labeled crop images to training-data.
 * entries: Array<{ fieldName, label, cropBase64 }>
 * Only available to dev/admin roles (enforced here in main process).
 */
ipcMain.handle('training:saveBatch', async (_, { entries }) => {
  if (session.role !== 'dev' && session.role !== 'admin') {
    return { ok: false, error: 'Dev/admin only' }
  }
  try {
    const batchEntries = entries.map(e => ({
      imageBuffer: Buffer.from(e.cropBase64, 'base64'),
      fieldName:   e.fieldName,
      label:       e.label,
    }))
    const results = await templateService.saveBatchSamples(batchEntries)
    // Reload caches for all affected fields
    const fields = [...new Set(entries.map(e => e.fieldName))]
    for (const f of fields) {
      try { await templateService.reloadField(f) } catch {}
    }
    return { ok: true, results }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

/**
 * training:getCrops — returns base64 crops for the last capture, for dev tool labeling.
 * Stored temporarily in memory by captureService after each capture.
 */
ipcMain.handle('training:getCrops', () => {
  return captureService.getLastCrops ? captureService.getLastCrops() : { ok: false, error: 'No crops available' }
})

// ── IPC: Export / Import ──────────────────────────────────────────────────────
const { dialog } = require('electron')
ipcMain.handle('export:user', async (_, { userId }) => {
  try {
    const json = await firebase.exportUser(userId)
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, { title: 'Export Dragon Registry', defaultPath: `dod-dragons-${new Date().toISOString().split('T')[0]}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (canceled || !filePath) return { ok: false, canceled: true }
    require('fs').writeFileSync(filePath, json, 'utf8')
    return { ok: true, filePath }
  } catch (e) { return { ok: false, error: e.message } }
})
ipcMain.handle('import:dragons', async (_, { userId }) => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, { title: 'Import Dragon Registry', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] })
    if (canceled || !filePaths.length) return { ok: false, canceled: true }
    return firebase.importDragons(userId, require('fs').readFileSync(filePaths[0], 'utf8'))
  } catch (e) { return { ok: false, error: e.message } }
})

// ── IPC: History ──────────────────────────────────────────────────────────────
ipcMain.handle('history:get',    ()          => localStore.getCropHistory())
ipcMain.handle('history:append', (_, entry) => localStore.appendCropHistory(entry))
ipcMain.handle('history:clear',  ()          => localStore.clearCropHistory())

// ── IPC: Accounts (Steam handles per user) ────────────────────────────────────
ipcMain.handle('account:add',    async (_, { userId, label })     => firebase.addAccount(userId, label))
ipcMain.handle('account:remove', async (_, { userId, accountId }) => firebase.removeAccount(userId, accountId))

// ── IPC: Dragon location update (map drag) ────────────────────────────────────
ipcMain.handle('dragon:setLocation', async (_, { userId, id, location }) => {
  return firebase.updateDragon(userId, id, { location })
})

// ── IPC: Dragon kill ──────────────────────────────────────────────────────────
ipcMain.handle('dragon:kill', async (_, { userId, id }) => {
  return firebase.updateDragon(userId, id, { is_dead: true })
})

// ── IPC: Nesting Spots (admin-shared) ─────────────────────────────────────────
ipcMain.handle('nestingSpot:getAll',  async () => {
  try { return await firebase.getNestingSpots() } catch (e) {
    console.warn('[nestingSpot] getAll failed:', e.message)
    return []
  }
})
ipcMain.handle('nestingSpot:save',    async (_, spot) => {
  if (!sessionIsAdmin()) return { ok: false, error: 'Admin only' }
  try { return await firebase.saveNestingSpot({ ...spot, createdBy: session.userId }) } catch (e) {
    console.error('[nestingSpot] save failed:', e.message, '— Check Firestore rules for /nestingSpots collection')
    return { ok: false, error: e.message }
  }
})
ipcMain.handle('nestingSpot:delete',  async (_, { id }) => {
  if (!sessionIsAdmin()) return { ok: false, error: 'Admin only' }
  try { return await firebase.deleteNestingSpot(id) } catch (e) {
    console.error('[nestingSpot] delete failed:', e.message)
    return { ok: false, error: e.message }
  }
})

// ─── Feedback ─────────────────────────────────────────────────────────────────
ipcMain.handle('feedback:getAll',        async (_, { visibility } = {}) => {
  try { return await firebase.getFeedback({ userId: session.userId, role: session.role, visibility }) } catch(e) { return [] }
})
ipcMain.handle('feedback:create',        async (_, data) => {
  if (!session.userId) return { ok: false, error: 'Not logged in' }
  try { return await firebase.createFeedback({ ...data, author_id: session.userId }) } catch(e) { return { ok: false, error: e.message } }
})
ipcMain.handle('feedback:update',        async (_, { id, data }) => {
  if (!session.userId) return { ok: false, error: 'Not logged in' }
  try { return await firebase.updateFeedback(id, data, session.userId, session.role) } catch(e) { return { ok: false, error: e.message } }
})
ipcMain.handle('feedback:delete',        async (_, { id }) => {
  if (!session.userId) return { ok: false, error: 'Not logged in' }
  try { return await firebase.deleteFeedback(id, session.userId, session.role) } catch(e) { return { ok: false, error: e.message } }
})
ipcMain.handle('feedback:vote',          async (_, { id, direction }) => {
  if (!session.userId) return { ok: false, error: 'Not logged in' }
  try { return await firebase.voteFeedback(id, session.userId, direction) } catch(e) { return { ok: false, error: e.message } }
})
ipcMain.handle('feedback:addReply',      async (_, { id, body }) => {
  if (!session.userId) return { ok: false, error: 'Not logged in' }
  try { return await firebase.addReply(id, { body, author_id: session.userId }) } catch(e) { return { ok: false, error: e.message } }
})
ipcMain.handle('feedback:markDone',      async (_, { id }) => {
  if (!sessionIsAdmin()) return { ok: false, error: 'Dev/Admin only' }
  try { return await firebase.markFeedbackDone(id, session.userId) } catch(e) { return { ok: false, error: e.message } }
})
ipcMain.handle('feedback:publishVersion', async (_, { version, body }) => {
  if (!sessionIsAdmin()) return { ok: false, error: 'Dev only' }
  try { return await firebase.publishVersionNote({ version, body, author_id: session.userId }) } catch(e) { return { ok: false, error: e.message } }
})
ipcMain.handle('feedback:getVersions',   async () => {
  try { return await firebase.getVersionNotes() } catch(e) { return [] }
})
