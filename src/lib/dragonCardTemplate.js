/**
 * dragonCardTemplate.js — v4
 * Generates inner HTML for dragon nodes in the family-chart canvas.
 * Bloodline Quality replaces the old "best grade" badge.
 * Controlled by prefs.showBloodlineQuality (toggle in Settings).
 */

import { getGradeClass } from './dragonData'

const GRADE_STYLES = {
  'grade-axx': 'background:#ffd700;color:#000',
  'grade-ax':  'background:#c0a000;color:#fff',
  'grade-a':   'background:#8a7000;color:#fff',
  'grade-bx':  'background:#3a6e9c;color:#fff',
  'grade-b':   'background:#2a5e8c;color:#fff',
  'grade-bm':  'background:#1a4e7c;color:#fff',
  'grade-c':   'background:#5a4a2a;color:#fff',
  'grade-d':   'background:#3a2a1a;color:#aaa',
}

function gradeStyle(grade) {
  if (!grade) return ''
  return GRADE_STYLES[getGradeClass(grade)] || 'background:rgba(255,255,255,0.12);color:#ccc'
}

export function dragonCardCreator(prefs, accentColor, accentBg) {
  return function cardInnerHtmlCreator(d) {
    const node   = d.data.data
    const isMain = !!d.data.main
    const isDead = !!node.isDead

    const border = isMain
      ? `3px solid ${accentColor}`
      : isDead
        ? '1px solid rgba(200,50,50,0.3)'
        : node.isElder && prefs.showElder
          ? '2px solid #d4a017'
          : '1px solid rgba(255,255,255,0.1)'

    const bg = isMain
      ? accentBg
      : isDead
        ? 'rgba(80,20,20,0.35)'
        : 'rgba(255,255,255,0.04)'

    let lines = 1
    if (prefs.showGender || prefs.showSkin || prefs.showGrowth) lines++
    if (isDead) lines++
    if (prefs.showElder && node.isElder && !isDead) lines++
    if (prefs.showBloodlineQuality && node.bloodlineQuality) lines++
    if (prefs.showTicks && node.ticks > 0 && !isDead) lines++

    const height = Math.max(64, 14 + lines * 20)

    const genderHtml = prefs.showGender
      ? node.gender === 'M'
        ? '<span style="color:#7cb9cc;font-size:12px">♂</span>'
        : '<span style="color:#e05a5a;font-size:12px">♀</span>'
      : ''

    const skinHtml = prefs.showSkin && node.skin
      ? `<span style="color:rgba(255,255,255,0.55);font-size:10px">${node.skin}</span>`
      : ''

    const growthHtml = prefs.showGrowth && node.growth
      ? `<span style="color:rgba(255,255,255,0.35);font-size:10px">· ${node.growth}</span>`
      : ''

    const metaRow = (prefs.showGender || (prefs.showSkin && node.skin) || (prefs.showGrowth && node.growth))
      ? `<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:2px">
           ${genderHtml}${skinHtml}${growthHtml}
         </div>`
      : ''

    const deadHtml = isDead
      ? `<div style="font-size:9px;color:#c44a4a;letter-spacing:.4px;margin-top:1px">💀 DEAD</div>`
      : ''

    const elderHtml = prefs.showElder && node.isElder && !isDead
      ? `<div style="font-size:9px;color:#d4a017;letter-spacing:.5px;margin-top:1px">⬡ ELDER</div>`
      : ''

    const bqHtml = prefs.showBloodlineQuality && node.bloodlineQuality
      ? `<div style="margin-top:2px;display:flex;align-items:center;gap:4px">
           <span style="font-size:9px;color:rgba(255,255,255,0.4)">BQ</span>
           <span style="padding:1px 6px;border-radius:4px;font-weight:600;font-size:10px;${gradeStyle(node.bloodlineQuality)}">${node.bloodlineQuality}</span>
         </div>`
      : ''

    const ticksHtml = prefs.showTicks && node.ticks > 0 && !isDead
      ? `<div style="display:flex;align-items:center;gap:5px;margin-top:2px">
           <div style="flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,0.1);overflow:hidden">
             <div style="height:100%;width:${Math.min(node.ticks * 100, 100)}%;background:${accentColor};border-radius:2px"></div>
           </div>
           <span style="font-size:9px;color:rgba(255,255,255,0.4)">${node.ticks.toFixed(2)}</span>
         </div>`
      : ''

    const deadStyle = isDead ? 'opacity:0.55;filter:grayscale(0.55);' : ''
    const nameColor = isDead ? '#a06060' : '#fff'
    const nameDecor = isDead ? 'text-decoration:line-through;' : ''

    return `<div style="
        width:210px;
        height:${height}px;
        background:${bg};
        border:${border};
        border-radius:9px;
        padding:8px 11px;
        display:flex;
        flex-direction:column;
        justify-content:center;
        position:relative;
        overflow:hidden;
        box-sizing:border-box;
        transition:border 0.2s;
        ${deadStyle}
      ">
      <div style="font-size:13px;font-weight:600;color:${nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;${nameDecor}">
        ${escHtml(node.name)}
      </div>
      ${metaRow}
      ${deadHtml}
      ${elderHtml}
      ${bqHtml}
      ${ticksHtml}
    </div>`
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
