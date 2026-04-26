/**
 * CaptureConfirmModal.jsx — v6.1
 *
 * Instead of a separate review UI, F8 capture data is injected directly
 * into the full DragonForm so the user can review, fill missing fields
 * (lineage, location, clan role, account, skins, traits), and save.
 *
 * The captured OCR data pre-fills: species, gender, growth, all stats,
 * bloodline quality, elder status, ticks, and family tree names.
 * Everything else can be completed manually before saving.
 */

import { useState } from 'react'
import DragonForm from './DragonForm'

export default function CaptureConfirmModal({ capture, userId, allDragons, clanDragons, nestingSpots = [], onClose, onSaved }) {

  // Build the pre-filled dragon object from OCR data
  const prefilled = buildPrefilledDragon(capture.data)

  async function handleSave(data) {
    await window.api.dragon.create({ userId, data: { ...data, capture_source: 'f8' } })
    onSaved?.()
    onClose()
  }

  return (
    <DragonForm
      dragon={prefilled}
      allDragons={allDragons || []}
      clanDragons={clanDragons || []}
      nestingSpots={nestingSpots}
      onSave={handleSave}
      onClose={onClose}
      captureMode
    />
  )
}

/**
 * Convert raw OCR data into a shape DragonForm understands.
 * OCR stats may come as plain grades ('A++') or as objects { dominant, recessive }.
 */
function buildPrefilledDragon(data) {
  if (!data) return {}

  const d = { ...data }

  // Clean UNKNOWN / empty to null
  Object.keys(d).forEach(k => { if (d[k] === 'UNKNOWN' || d[k] === '') d[k] = null })

  // Normalise stat fields — OCR may return { label, dominantGrade, recessiveGrade }
  const hasRecessiveStat = Object.keys(d).some(k =>
    k.startsWith('stat_') && typeof d[k] === 'object' && d[k]?.recessiveGrade
  )
  if (hasRecessiveStat && !d.trait_dominant) {
    d.trait_dominant = 4   // Auto-detect Dominant trait
  }
  Object.keys(d).forEach(k => {
    if (k.startsWith('stat_') && typeof d[k] === 'object' && d[k]?.label) {
      d[k] = d[k].label   // flatten to grade string
    }
  })

  // elder_status → is_elder + ticks
  if (d.growth === 'Elder') {
    d.is_elder = 1
    d.ticks    = 1.0
  } else if (d.growth === 'Hatchling' || d.growth === 'Juvenile') {
    d.is_elder = 0
    d.ticks    = 0.0
  }

  return d
}
