import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../App'
import styles from './TrainingPage.module.css'

// ─── Field metadata ──────────────────────────────────────────────────────────

const ICON_FIELDS = [
  {
    key: 'gender',
    label: 'Genre',
    description: 'Icône ♂ / ♀ du dragon',
    labels: ['M', 'F'],
  },
  {
    key: 'species',
    label: 'Espèce',
    description: 'Icône de l\'espèce du dragon',
    labels: ['FS', 'SS', 'ASD', 'IR', 'BS', 'BW', 'BIO'],
  },
  {
    key: 'growth',
    label: 'Stade de croissance',
    description: 'Stade de vie du dragon (tel qu\'affiché dans le jeu)',
    labels: ['Hatchling', 'Juvenile', 'Adult', 'Elder'],
  },
  {
    key: 'elder_status',
    label: 'Statut Elder',
    description: 'Icône d\'ancienneté / étoiles',
    labels: ['NO', 'ELDER', '4 Points', '5 Points', '6 Points'],
  },
]

const STAT_GRADES = ['A++', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E', 'F']
const STAT_FIELDS = [
  { key: 'stat_life_expectancy', label: 'Life Expectancy' },
  { key: 'stat_scale_thickness', label: 'Scale Thickness' },
  { key: 'stat_stamina',         label: 'Stamina' },
  { key: 'stat_strength',        label: 'Strength' },
  { key: 'stat_bite_force',      label: 'Bite Force' },
  { key: 'stat_power',           label: 'Power' },
  { key: 'stat_nutrient_absorption', label: 'Nutrient Absorption' },
  { key: 'stat_water_retention', label: 'Water Retention' },
  { key: 'stat_toxin_tolerance', label: 'Toxin Tolerance' },
  { key: 'stat_impact_resistance', label: 'Impact Resistance' },
  { key: 'stat_pierce_resistance', label: 'Pierce Resistance' },
  { key: 'stat_fire_resistance', label: 'Fire Resistance' },
  { key: 'stat_frost_resistance', label: 'Frost Resistance' },
  { key: 'stat_plasma_resistance', label: 'Plasma Resistance' },
  { key: 'stat_lightning_resistance', label: 'Lightning Resistance' },
  { key: 'stat_acid_resistance', label: 'Acid Resistance' },
  { key: 'stat_venom_resistance', label: 'Venom Resistance' },
  { key: 'stat_bile_production', label: 'Bile Production' },
].map(f => ({ ...f, description: 'Grade affiché en jeu (icône stylisée)', labels: STAT_GRADES }))

const ALL_FIELDS = [...ICON_FIELDS, ...STAT_FIELDS]

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const { addToast } = useApp()
  const [samples, setSamples]   = useState({})
  const [loading, setLoading]   = useState(true)
  const [trainingDir, setTrainingDir] = useState('')
  const [deleting, setDeleting] = useState(null)  // "field/label"

  const loadSamples = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api?.training.list()
      if (res?.ok) {
        // Map 'stats' folder to individual stat fields for display
        const raw = res.data || {}
        const mapped = { ...raw }
        if (raw.stats) {
          STAT_FIELDS.forEach(f => {
            mapped[f.key] = raw.stats
          })
        }
        setSamples(mapped)
      }
      const dirRes = await window.api?.training.getDir()
      if (dirRes?.ok) setTrainingDir(dirRes.dir)
    } catch (err) {
      addToast('Erreur lors du chargement des données d\'entraînement', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { loadSamples() }, [loadSamples])

  async function handleReload(fieldName) {
    try {
      const res = await window.api?.training.reload({ fieldName })
      if (res?.ok) addToast(`Templates rechargés (${res.count} images)`, 'success')
      else addToast('Rechargement échoué', 'error')
    } catch {
      addToast('Erreur de rechargement', 'error')
    }
  }

  const totalSamples = Object.entries(samples)
    .filter(([k]) => ICON_FIELDS.some(f => f.key === k) || k === 'stats' || k === 'bloodline_quality')
    .flatMap(([, labels]) => Object.values(labels))
    .reduce((a, b) => a + b, 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Données d'entraînement</h2>
          <p className={styles.subtitle}>
            Visualisez les captures d'écran utilisées pour la reconnaissance d'images.
            Les données sont désormais intégrées et lecture seule.
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.totalBadge}>{totalSamples} image{totalSamples !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className={styles.howto}>
        <div className={styles.howtoIcon}>ℹ️</div>
        <div className={styles.howtoText}>
          <strong>Données intégrées :</strong> Les templates sont pré-configurés pour une précision optimale. 
          Si vous rencontrez des problèmes de détection, assurez-vous que votre jeu est en 
          résolution native et que les boîtes de capture sont bien calibrées dans les Paramètres.
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
          <span>Chargement…</span>
        </div>
      ) : (
        <>
          <Section
            title="Champs iconiques"
            fields={ICON_FIELDS}
            samples={samples}
            onReload={handleReload}
          />
          <Section
            title="Grades de statistiques (partagés)"
            fields={STAT_FIELDS}
            samples={samples}
            onReload={handleReload}
            compact
          />
        </>
      )}

      {trainingDir && (
        <div className={styles.dirHint}>
          <code>{trainingDir}</code>
        </div>
      )}
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, fields, samples, onReload, compact }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={compact ? styles.gridCompact : styles.grid}>
        {fields.map(field => (
          <FieldCard
            key={field.key}
            field={field}
            labelCounts={samples[field.key] || {}}
            onReload={onReload}
            compact={compact}
          />
        ))}
      </div>
    </section>
  )
}

// ─── FieldCard ────────────────────────────────────────────────────────────────

function FieldCard({ field, labelCounts, onReload, compact }) {
  const totalForField = Object.values(labelCounts).reduce((a, b) => a + b, 0)
  const hasAny = totalForField > 0

  return (
    <div className={`${styles.card} ${!hasAny ? styles.cardEmpty : ''}`}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.fieldName}>{field.label}</div>
          <div className={styles.fieldKey}>{field.key}</div>
        </div>
        <div className={styles.cardActions}>
          <span className={`${styles.countBadge} ${!hasAny ? styles.countBadgeEmpty : ''}`}>
            {totalForField}
          </span>
          <button
            className={styles.btnIcon}
            title="Recharger les templates"
            onClick={() => onReload(field.key)}
          >
            <ReloadIcon />
          </button>
        </div>
      </div>

      <div className={styles.fieldDesc}>{field.description}</div>

      <div className={compact ? styles.labelsCompact : styles.labels}>
        {field.labels.map(label => {
          const count   = labelCounts[label] || 0

          return (
            <div key={label} className={`${styles.labelRow} ${count > 0 ? styles.labelHas : styles.labelMissing}`}>
              <span className={styles.labelName}>{label}</span>
              <span className={styles.labelCount}>
                {count > 0 ? `${count} img` : <span className={styles.missing}>—</span>}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─── Icons ────────────────────────────────────────────────────────────────────

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function ReloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}
