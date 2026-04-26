import { useState, useEffect } from 'react'

const STORAGE_KEY = 'dod_lineage_prefs'

export const DEFAULT_PREFS = {
  showGender:           true,  // always true, locked
  showSkin:             true,
  showGrowth:             true,
  showElder:            true,
  showBloodlineQuality: true,  // v4: replaces showBestGrade in cards
  showTicks:            false,
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

function save(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch {}
}

const BUS_EVENT = 'dod:lineagePrefs'

export default function useLineagePrefs() {
  const [prefs, setPrefsState] = useState(load)

  useEffect(() => {
    const handler = () => setPrefsState(load())
    window.addEventListener(BUS_EVENT, handler)
    return () => window.removeEventListener(BUS_EVENT, handler)
  }, [])

  function setPrefs(updater) {
    setPrefsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      const safe = { ...next, showGender: true } // gender always on
      save(safe)
      window.dispatchEvent(new Event(BUS_EVENT))
      return safe
    })
  }

  return { prefs, setPrefs }
}
