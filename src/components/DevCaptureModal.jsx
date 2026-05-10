/**
 * DevCaptureModal — v1.0 (Patch 8.1.2)
 *
 * Shown when a dev/admin user presses Ctrl+F5.
 * Displays each cropped region from the last capture alongside a label
 * input. On confirm, saves all labeled crops to training-data/ for
 * future template matching.
 *
 * Only mounted/visible for dev and admin roles.
 */

import { useEffect, useState, useCallback } from 'react'
import styles from './DevCaptureModal.module.css'

// All field names that can have training samples saved.
// Icon fields (gender/species/growth) and stat fields.
const STAT_FIELDS = [
  'stat_life_expectancy','stat_scale_thickness','stat_stamina','stat_agility',
  'stat_strength','stat_growth_rate','stat_armor','stat_venom',
  'stat_bite_force','stat_power','stat_nutrient_absorption','stat_water_retention',
  'stat_toxin_tolerance','stat_impact_resistance','stat_pierce_resistance',
  'stat_fire_resistance','stat_frost_resistance','stat_plasma_resistance',
  'stat_lightning_resistance','stat_acid_resistance','stat_venom_resistance',
  'stat_bile_production',
]
const ICON_FIELDS  = ['gender','species','growth']
const GRADE_LIST   = ['A++','A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E','F']
const BLOODLINE_GRADES = ['A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E','F']
const GENDER_OPTS  = ['M','F']
const SPECIES_OPTS = ['FS','SS','ASD','IR','BS','BW','BIO']
const GROWTH_OPTS  = ['Hatchling','Juvenile','Adult','Elder']

function optionsForField(fieldName) {
  if (fieldName === 'gender')            return GENDER_OPTS
  if (fieldName === 'species')           return SPECIES_OPTS
  if (fieldName === 'growth')            return GROWTH_OPTS
  if (fieldName === 'bloodline_quality') return BLOODLINE_GRADES
  if (STAT_FIELDS.includes(fieldName))   return GRADE_LIST
  return []
}

function friendlyName(fieldName) {
  return fieldName
    .replace(/^stat_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function DevCaptureModal({ role, onClose }) {
  const [crops, setCrops]       = useState(null)   // { fieldName: base64 }
  const [labels, setLabels]     = useState({})      // { fieldName: { dominant, recessive } }
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(null)    // result summary
  const [error, setError]       = useState(null)
  const [visible, setVisible]   = useState(false)

  const isDevAdmin = role === 'dev' || role === 'admin'

  // Listen for Ctrl+F5 trigger from main process
  useEffect(() => {
    if (!isDevAdmin) return
    const handler = async (captureResult) => {
      setError(null)
      setSaved(null)
      setSaving(false)
      setLabels({})

      // Fetch the raw crops from main process
      const res = await window.api.training.getCrops()
      if (!res.ok) { setError(res.error); setVisible(true); return }

      setCrops(res.crops)
      // Pre-fill labels from OCR result if available
      if (captureResult?.data) {
        const prefill = {}
        for (const fieldName of Object.keys(res.crops)) {
          const ocr = captureResult.data[fieldName]
          const rec = captureResult.data[`r_${fieldName}`]
          prefill[fieldName] = { dominant: ocr || '', recessive: rec || '' }
        }
        setLabels(prefill)
      }
      setVisible(true)
    }

    const errHandler = (msg) => { setError(msg); setVisible(true) }

    window.api.training.onDevCapture(handler)
    window.api.training.onDevCaptureError(errHandler)
    return () => window.api.training.removeDevListeners()
  }, [isDevAdmin])

  const setLabel = useCallback((fieldName, key, val) => {
    setLabels(prev => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], [key]: val }
    }))
  }, [])

  const handleSave = async () => {
    if (!crops) return
    setSaving(true)
    setError(null)

    const entries = []
    for (const [fieldName, cropBase64] of Object.entries(crops)) {
      const lab = labels[fieldName] || {}
      // Dominant label
      if (lab.dominant) {
        entries.push({ fieldName, label: lab.dominant, cropBase64 })
      }
      // For stats with a recessive, save the full crop under a combined label
      // following the existing naming convention (e.g. "A+" with recessive "B-" → label "A+")
      // The recessive is embedded in the filename convention, handled by templateService
    }

    if (!entries.length) { setSaving(false); setError('No labels entered.'); return }

    try {
      const res = await window.api.training.saveBatch({ entries })
      if (res.ok) {
        const ok  = res.results.filter(r => r.ok).length
        const bad = res.results.filter(r => !r.ok).length
        setSaved({ ok, bad })
      } else {
        setError(res.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setVisible(false)
    setCrops(null)
    setSaved(null)
    setError(null)
    onClose?.()
  }

  if (!isDevAdmin || !visible) return null

  const allFields = crops ? Object.keys(crops) : []
  const statFields  = allFields.filter(f => STAT_FIELDS.includes(f) || f === 'bloodline_quality')
  const iconFields  = allFields.filter(f => ICON_FIELDS.includes(f))
  const otherFields = allFields.filter(f => !statFields.includes(f) && !iconFields.includes(f))

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.badge}>DEV</span>
          <h2>Training Data Capture</h2>
          <p className={styles.subtitle}>
            Label each crop then click Save. These images will be added to
            training-data/ to improve future recognition.
          </p>
          <button className={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {saved && (
          <div className={styles.success}>
            ✓ Saved {saved.ok} sample{saved.ok !== 1 ? 's' : ''}.
            {saved.bad > 0 && ` (${saved.bad} failed)`}
          </div>
        )}

        {crops && (
          <div className={styles.body}>
            {/* Icon fields */}
            {iconFields.length > 0 && (
              <section>
                <h3 className={styles.sectionTitle}>Icons</h3>
                <div className={styles.grid}>
                  {iconFields.map(fieldName => (
                    <CropCard
                      key={fieldName}
                      fieldName={fieldName}
                      cropBase64={crops[fieldName]}
                      label={labels[fieldName] || {}}
                      options={optionsForField(fieldName)}
                      onSet={(key, val) => setLabel(fieldName, key, val)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Stat fields */}
            {statFields.length > 0 && (
              <section>
                <h3 className={styles.sectionTitle}>Stats & Bloodline</h3>
                <div className={styles.grid}>
                  {statFields.map(fieldName => (
                    <CropCard
                      key={fieldName}
                      fieldName={fieldName}
                      cropBase64={crops[fieldName]}
                      label={labels[fieldName] || {}}
                      options={optionsForField(fieldName)}
                      showRecessive={STAT_FIELDS.includes(fieldName)}
                      onSet={(key, val) => setLabel(fieldName, key, val)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Other fields (names, skin, ticks) */}
            {otherFields.length > 0 && (
              <section>
                <h3 className={styles.sectionTitle}>Text Fields</h3>
                <div className={styles.grid}>
                  {otherFields.map(fieldName => (
                    <CropCard
                      key={fieldName}
                      fieldName={fieldName}
                      cropBase64={crops[fieldName]}
                      label={labels[fieldName] || {}}
                      options={[]}
                      onSet={(key, val) => setLabel(fieldName, key, val)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || !crops}
          >
            {saving ? 'Saving…' : '💾 Save Training Samples'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CropCard ─────────────────────────────────────────────────────────────────

function CropCard({ fieldName, cropBase64, label, options, showRecessive, onSet }) {
  const imgSrc = cropBase64 ? `data:image/jpeg;base64,${cropBase64}` : null

  return (
    <div className={styles.card}>
      <div className={styles.cardName}>{friendlyName(fieldName)}</div>
      {imgSrc
        ? <img src={imgSrc} className={styles.cropImg} alt={fieldName} />
        : <div className={styles.noCrop}>No crop</div>
      }

      {options.length > 0 ? (
        <div className={styles.cardInputs}>
          <label>Dominant</label>
          <select
            value={label.dominant || ''}
            onChange={e => onSet('dominant', e.target.value)}
          >
            <option value="">— skip —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          {showRecessive && (
            <>
              <label>Recessive</label>
              <select
                value={label.recessive || ''}
                onChange={e => onSet('recessive', e.target.value)}
              >
                <option value="">— none —</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </>
          )}
        </div>
      ) : (
        <div className={styles.cardInputs}>
          <label>Value</label>
          <input
            type="text"
            value={label.dominant || ''}
            onChange={e => onSet('dominant', e.target.value)}
            placeholder="type value…"
          />
        </div>
      )}
    </div>
  )
}
