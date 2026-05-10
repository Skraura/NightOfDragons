/**
 * Screenshot Service — v2.0 (Patch 8.1.1)
 *
 * Fix: compress screenshot to JPEG before base64-encoding to avoid
 * Electron IPC 64MB message limit (raw 1080p PNG can be ~100MB).
 */

const { desktopCapturer, screen } = require('electron')
const { execFileSync, execSync }  = require('child_process')
const sharp = require('sharp')
const os    = require('os')
const path  = require('path')
const fs    = require('fs')

// ─── Main-process capture (primary method) ───────────────────────────────────
async function captureViaMainProcess() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    })

    const src = sources.find(s =>
      s.name.toLowerCase().includes('screen 1') ||
      s.name.toLowerCase().includes('entire') ||
      s.name.toLowerCase().includes('screen')
    ) || sources[0]

    if (!src || src.thumbnail.isEmpty()) {
      throw new Error('No screen source available via desktopCapturer')
    }

    // Compress to JPEG (quality 92) before IPC transfer.
    // Raw PNG of a 1080p screen is ~100MB which exceeds Electron's ~64MB IPC limit.
    // JPEG at quality 92 is ~3-5MB and retains full detail for template matching.
    const pngBuf    = src.thumbnail.toPNG()
    const jpegBuf   = await sharp(pngBuf).jpeg({ quality: 92 }).toBuffer()
    return jpegBuf.toString('base64')
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
  const tmp     = path.join(os.tmpdir(), `dod-${Date.now()}.png`)
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
  try {
    return await captureViaMainProcess()
  } catch (err) {
    console.warn('[screenshot] main-process capture failed:', err.message, '— trying OS fallback')
  }

  if (process.platform === 'linux')  return captureLinux()
  if (process.platform === 'win32')  return captureWindows()

  throw new Error('Could not take screenshot on this platform')
}

module.exports = { takeScreenshot }
