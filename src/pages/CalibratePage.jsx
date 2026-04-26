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

export default function CalibratePage() {
  const canvasRef = useRef(null)

  const [screenshot, setScreenshot] = useState(null)   // base64 PNG
  const [userId, setUserId]         = useState(null)
  const [resolution, setResolution] = useState('')
  const [boxes, setBoxes]           = useState({})
  const [activeField, setActiveField] = useState(CAPTURE_FIELDS[0].key)
  const [drawing, setDrawing]       = useState(false)
  const [startPt, setStartPt]       = useState(null)
  const [currentRect, setCurrentRect] = useState(null)
  const [saveState, setSaveState]   = useState('idle')

  // ── Receive init data from main process ──
  useEffect(() => {
    window.api?.calibration.onInit((data) => {
      setScreenshot(data.screenshot)
      setUserId(data.userId)
      setResolution(data.resolution)
      window.api.boxConfig.get({ resolution: data.resolution })
        .then(cfg => { if (cfg) setBoxes(cfg) })
    })
  }, [])

  // ── Redraw canvas whenever screenshot or boxes change ──
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
        const box = boxes[f.key]
        if (!box) return
        drawBox(ctx, box, COLORS[i % COLORS.length], f.label, false)
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
  // CRITICAL FIX: We must map from CSS pixels → canvas pixels correctly.
  // The canvas element may be scaled by CSS (object-fit: contain), and the
  // screenshot may have been taken at a different DPI than the display.
  // We use getBoundingClientRect for the CSS-displayed size, then scale to
  // the canvas's intrinsic pixel dimensions.
  function getCanvasPt(e) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    // Scale factors: canvas intrinsic pixels / CSS display size
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height

    // Apply devicePixelRatio compensation if canvas was rendered at 1:1
    // (getBoundingClientRect already returns CSS pixels which account for DPR)
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
    const pt  = getCanvasPt(e)
    const box = {
      x: Math.min(startPt.x, pt.x),
      y: Math.min(startPt.y, pt.y),
      w: Math.abs(pt.x - startPt.x),
      h: Math.abs(pt.y - startPt.y),
    }
    if (box.w > 5 && box.h > 5) {
      const next = { ...boxes, [activeField]: box }
      setBoxes(next)
      const curIdx = CAPTURE_FIELDS.findIndex(f => f.key === activeField)
      const nextField = CAPTURE_FIELDS.slice(curIdx + 1).find(f => !next[f.key])
      if (nextField) setActiveField(nextField.key)
    }
    setDrawing(false)
    setStartPt(null)
    setCurrentRect(null)
  }

  // Also handle mouse leaving the canvas while drawing
  function onMouseLeave(e) {
    if (drawing) onMouseUp(e)
  }

  function clearBox(fieldKey, e) {
    e.stopPropagation()
    setBoxes(prev => { const n = { ...prev }; delete n[fieldKey]; return n })
  }

  async function handleSave() {
    if (!userId || !resolution) return
    setSaveState('saving')
    try {
      await window.api.boxConfig.save({ resolution, boxes })
      setSaveState('saved')
      setTimeout(() => window.api.calibration.close(), 1000)
    } catch (err) {
      setSaveState('error')
      console.error(err)
    }
  }

  const configuredCount = Object.keys(boxes).length

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
          Click and drag on the game screenshot to define each field's location.
        </p>

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
          <span className={styles.count}>{configuredCount} / {CAPTURE_FIELDS.length}</span>
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
        </div>
      </div>
    </div>
  )
}
