/**
 * WhatsNewModal.jsx — v8.0.0
 * Shows published version notes to members on first login after a new version.
 * Supports basic markdown rendering (headers, bold, lists, code, tables).
 */

import styles from './WhatsNewModal.module.css'

// Very lightweight markdown → HTML (no external dependency)
function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/^\| (.+) \|$/gm, (line) => {
      const cells = line.slice(2, -2).split(' | ')
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>'
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gs, m => `<table>${m}</table>`)
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '<br/><br/>')
}

export default function WhatsNewModal({ version, body, onClose }) {
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <div className={styles.badge}>✨ What's New</div>
            <h2 className={`cinzel ${styles.title}`}>Version {version}</h2>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />

        <div className={styles.footer}>
          <button className="btn btn-primary" onClick={onClose}>Got it 🐉</button>
        </div>
      </div>
    </div>
  )
}
