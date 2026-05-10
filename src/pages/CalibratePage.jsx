/**
 * CalibratePage — Beta1.1
 *
 * Changes:
 *  - Calibration is now stored as percentage ratios (xPct/yPct/wPct/hPct),
 *    so it adapts automatically to any screen resolution.
 *  - Boxes are drawn from those ratios × current canvas size, not raw pixels.
 *  - Dev-only "Save as Bundled" button writes the calibration to
 *    resources/bundled-calibration.json so it ships with the next build.
 *  - Progress indicator shows pct-based completeness.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { CAPTURE_FIELDS } from '../lib/dragonData'
import styles from './CalibratePage.module.css'

const COLORS = [
  '#c9932a','#4a9e6a','#4a7abe','#8a5abe',
  '#c44a4a','#7ecfcf','#e8aa40','#78c878',
  '#e87840','#b85aba','#50b8a0','#d4b848',
  '#6890d8','#c86858','#a8c878','#7880d8',
  '#d87050','#50b8c8','#c8a050','#80c050',
]

/** Convert a pct box { xPct, yPct, wPct, hPct } to canvas pixels */
function pctToCanvas(pctBox, cw, ch) {
  return {
    x: pctBox.xPct * cw,
    y: pctBox.yPct * ch,
    w: pctBox.wPct * cw,
    h: pctBox.hPct * ch,
  }
}

/** Convert canvas-pixel coords to pct box */
function canvasToPct(pixBox, cw, ch) {
  return {
    xPct: pixBox.x / cw,
    yPct: pixBox.y / ch,
    wPct: pixBox.w / cw,
    hPct: pixBox.h / ch,
  }
}

export default function CalibratePage() {
  const canvasRef = useRef(null)

  const [screenshot, setScreenshot] = useState(null)
  const [userId, setUserId]         = useState(null)
  const [role, setRole]             = useState('member')   // set from calibration:init
  const [resolution, setResolution] = useState('')
  // boxes stored as pct format { fieldKey: { xPct, yPct, wPct, hPct } }
  const [boxes, setBoxes]           = useState({})
  const [activeField, setActiveField] = useState(CAPTURE_FIELDS[0].key)
  const [drawing, setDrawing]       = useState(false)
  const [startPt, setStartPt]       = useState(null)
  const [currentRect, setCurrentRect] = useState(null)
  const [saveState, setSaveState]   = useState('idle')   // idle|saving|saved|error

  const isDev = role === 'dev'

  // ── Receive init data from main process ──
  useEffect(() => {
    window.api?.calibration.onInit(async (data) => {
      setScreenshot(data.screenshot)
      setUserId(data.userId)
      setResolution(data.resolution)
      setRole(data.role || 'member')
      const pct = await window.api.boxConfig.getPct()
      if (pct) setBoxes(pct)
    })
  }, [])

  // ── Redraw canvas ──
  useEffect(() => {
    if (!screenshot || !canvasRef.current) return
    redrawCanvas()
  }, [screenshot, boxes])

  useEffect(() => {
    if (!screenshot || !canvasRef.current || !currentRect) return
    redrawCanvas(currentRect)
  }, [currentRect])

  function redrawCanvas(inProgress = null) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width  = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      CAPTURE_FIELDS.forEach((f, i) => {
        const pctBox = boxes[f.key]
        if (!pctBox) return
        const pixBox = pctToCanvas(pctBox, canvas.width, canvas.height)
        drawBox(ctx, pixBox, COLORS[i % COLORS.length], f.label, false)
      })

      if (inProgress) {
        const fieldIdx = CAPTURE_FIELDS.findIndex(f => f.key === activeField)
        drawBox(ctx, inProgress, COLORS[fieldIdx % COLORS.length], null, true)
      }
    }
    img.src = `data:image/png;base64,${screenshot}`
  }

  function drawBox(ctx, box, color, label, dashed) {
    ctx.save()
    if (dashed) ctx.setLineDash([6, 3])
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(box.x, box.y, box.w, box.h)
    ctx.fillStyle = color + (dashed ? '22' : '33')
    ctx.fillRect(box.x, box.y, box.w, box.h)
    if (label) {
      ctx.font = 'bold 13px "DM Sans", sans-serif'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(box.x + 2, box.y + 2, tw + 10, 20)
      ctx.fillStyle = color
      ctx.fillText(label, box.x + 7, box.y + 16)
    }
    ctx.restore()
  }

  // ── DPI-aware canvas coordinate conversion ──
  function getCanvasPt(e) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top)  * scaleY),
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return
    e.preventDefault()
    const pt = getCanvasPt(e)
    setStartPt(pt)
    setDrawing(true)
    setCurrentRect({ x: pt.x, y: pt.y, w: 0, h: 0 })
  }

  function onMouseMove(e) {
    if (!drawing || !startPt) return
    e.preventDefault()
    const pt = getCanvasPt(e)
    setCurrentRect({
      x: Math.min(startPt.x, pt.x),
      y: Math.min(startPt.y, pt.y),
      w: Math.abs(pt.x - startPt.x),
      h: Math.abs(pt.y - startPt.y),
    })
  }

  function onMouseUp(e) {
    if (!drawing || !startPt) return
    e.preventDefault()
    const canvas = canvasRef.current
    const pt     = getCanvasPt(e)
    const pixBox = {
      x: Math.min(startPt.x, pt.x),
      y: Math.min(startPt.y, pt.y),
      w: Math.abs(pt.x - startPt.x),
      h: Math.abs(pt.y - startPt.y),
    }
    if (pixBox.w > 5 && pixBox.h > 5 && canvas) {
      // Store as pct ratios
      const pctBox = canvasToPct(pixBox, canvas.width, canvas.height)
      const next   = { ...boxes, [activeField]: pctBox }
      setBoxes(next)
      const curIdx   = CAPTURE_FIELDS.findIndex(f => f.key === activeField)
      const nextField = CAPTURE_FIELDS.slice(curIdx + 1).find(f => !next[f.key])
      if (nextField) setActiveField(nextField.key)
    }
    setDrawing(false)
    setStartPt(null)
    setCurrentRect(null)
  }

  function onMouseLeave(e) {
    if (drawing) onMouseUp(e)
  }

  function clearBox(fieldKey, e) {
    e.stopPropagation()
    setBoxes(prev => { const n = { ...prev }; delete n[fieldKey]; return n })
  }

  // Save calibration — always writes to bundled-calibration.json (Dev only)
  async function handleSave() {
    if (!resolution) return
    setSaveState('saving')
    try {
      const res = await window.api.boxConfig.save({ resolution, boxes })
      if (!res?.ok) throw new Error(res?.error || 'Unknown error')
      setSaveState('saved')
      setTimeout(() => window.api.calibration.close(), 1200)
    } catch (err) {
      setSaveState('error')
      console.error(err)
    }
  }

  const configuredCount = Object.keys(boxes).length
  const totalFields     = CAPTURE_FIELDS.length
  const pctComplete     = Math.round((configuredCount / totalFields) * 100)

  return (
    <div className={styles.root}>
      {screenshot ? (
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        />
      ) : (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading screenshot…</p>
        </div>
      )}

      {/* ── Floating control panel ── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Box Calibration</span>
          {resolution && <span className={styles.panelRes}>{resolution}</span>}
        </div>

        <p className={styles.instructions}>
          Drag boxes over the game UI. Positions are saved as <strong>percentages</strong> and adapt automatically to any screen resolution.
        </p>

        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pctComplete}%` }} />
        </div>
        <p className={styles.progressLabel}>{configuredCount} / {totalFields} fields ({pctComplete}%)</p>

        <div className={styles.fieldList}>
          {CAPTURE_FIELDS.map((f, i) => {
            const isSet    = !!boxes[f.key]
            const isActive = activeField === f.key
            return (
              <div
                key={f.key}
                className={`${styles.fieldItem} ${isActive ? styles.active : ''} ${isSet ? styles.set : ''}`}
                onClick={() => setActiveField(f.key)}
              >
                <span className={styles.dot} style={{ background: COLORS[i % COLORS.length] }} />
                <span className={styles.fieldName}>{f.label}</span>
                {isSet
                  ? <button className={styles.clearBtn} onClick={e => clearBox(f.key, e)}>✕</button>
                  : <span className={styles.unset}>○</span>
                }
              </div>
            )
          })}
        </div>

        <div className={styles.panelFooter}>
          <div className={styles.footerBtns}>
            <button className="btn btn-ghost btn-sm" onClick={() => window.api.calibration.close()}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={configuredCount === 0 || saveState === 'saving' || saveState === 'saved'}
            >
              {saveState === 'saving' ? 'Saving…'
               : saveState === 'saved' ? '✓ Saved!'
               : saveState === 'error' ? 'Error — retry'
               : 'Save Layout'}
            </button>
          </div>
          <p className={styles.bundledLabel}>
            Saves to <code>bundled-calibration.json</code> — ships with the next build for all members
          </p>
        </div>
      </div>
    </div>
  )
}
