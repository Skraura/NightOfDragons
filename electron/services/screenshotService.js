/**
 * Screenshot Service — Electron v29+ compatible
 *
 * In Electron v29, desktopCapturer only works in the renderer process.
 * Strategy:
 *   1. Main process sends 'screenshot:request' to renderer
 *   2. Renderer's preload captures screen with desktopCapturer, returns base64 via IPC
 *   3. Fallback: OS tools (scrot on Linux, PowerShell on Windows)
 *
 * The ipcMain listener for 'screenshot:result' is set up in main.js.
 * captureService calls takeScreenshot(mainWindow, ipcMain).
 */

const { desktopCapturer, screen } = require('electron')
const { execFileSync, execSync } = require('child_process')
const os   = require('os')
const path = require('path')
const fs   = require('fs')

// ─── Main-process capture (primary method) ───────────────────────────────────
async function captureViaMainProcess() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    })

    // Find primary or first screen
    const src = sources.find(s =>
      s.name.toLowerCase().includes('screen 1') ||
      s.name.toLowerCase().includes('entire') ||
      s.name.toLowerCase().includes('screen')
    ) || sources[0]

    if (!src || src.thumbnail.isEmpty()) {
      throw new Error('No screen source available via desktopCapturer')
    }

    return src.thumbnail.toPNG().toString('base64')
  } catch (err) {
    throw new Error(`Main-process capture failed: ${err.message}`)
  }
}

// ─── Linux OS fallbacks ───────────────────────────────────────────────────────
function captureLinux() {
  const tmp   = path.join(os.tmpdir(), `dod-${Date.now()}.png`)
  const tools = [
    ['scrot',             [tmp]],
    ['grim',              [tmp]],
    ['gnome-screenshot',  ['-f', tmp]],
    ['import',            ['-window', 'root', tmp]],
  ]
  for (const [cmd, args] of tools) {
    try {
      execFileSync(cmd, args, { timeout: 6000, stdio: 'ignore' })
      if (fs.existsSync(tmp)) {
        const buf = fs.readFileSync(tmp)
        try { fs.unlinkSync(tmp) } catch {}
        return buf.toString('base64')
      }
    } catch {}
  }
  throw new Error(
    'No screenshot tool found. Install one:\n' +
    '  sudo apt install scrot      (X11)\n' +
    '  sudo apt install grim       (Wayland)'
  )
}

// ─── Windows OS fallback ──────────────────────────────────────────────────────
function captureWindows() {
  const tmp = path.join(os.tmpdir(), `dod-${Date.now()}.png`)
  const escaped = tmp.replace(/\\/g, '\\\\')
  const ps =
    'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ' +
    `$b=[System.Drawing.Bitmap]::new([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width,[System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); ` +
    `$g=[System.Drawing.Graphics]::FromImage($b); ` +
    `$g.CopyFromScreen(0,0,0,0,$b.Size); ` +
    `$b.Save('${escaped}'); ` +
    `$g.Dispose(); $b.Dispose()`
  execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { timeout: 10000 })
  const buf = fs.readFileSync(tmp)
  try { fs.unlinkSync(tmp) } catch {}
  return buf.toString('base64')
}

// ─── Main entry ───────────────────────────────────────────────────────────────
async function takeScreenshot() {
  // Try main process first (works on Windows + Linux X11/XWayland)
  try {
    return await captureViaMainProcess()
  } catch (err) {
    console.warn('[screenshot] main-process capture failed:', err.message, '— trying OS fallback')
  }

  // OS fallbacks
  if (process.platform === 'linux')  return captureLinux()
  if (process.platform === 'win32')  return captureWindows()

  throw new Error('Could not take screenshot on this platform')
}

module.exports = { takeScreenshot }
