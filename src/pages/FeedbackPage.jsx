/**
 * FeedbackPage.jsx — v7.8.0
 *
 * Accessible to ALL members (not just admin/dev).
 * Members can:
 *  - Submit feedback (4 types, private/global, subtasks, dragon link)
 *  - View global threads, upvote/downvote, suggest edits, edit own threads
 * Devs additionally see resolved threads and can mark done / reply authoritatively.
 */

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../App'
import { isAdmin } from '../lib/roleUtils'
import styles from './FeedbackPage.module.css'

const FEEDBACK_TYPES = [
  { value: 'feature_add',    label: '➕ Add Feature',    color: '#5291f5' },
  { value: 'feature_remove', label: '➖ Remove Feature',  color: '#e05a5a' },
  { value: 'feature_fix',    label: '🔧 Fix Feature',    color: '#c9932a' },
  { value: 'other',          label: '💬 Other',           color: '#7c5cbf' },
]

function typeConfig(t) {
  return FEEDBACK_TYPES.find(f => f.value === t) || FEEDBACK_TYPES[3]
}

export default function FeedbackPage({ dragons = [], devMode = false }) {
  const { user } = useApp()
  const userIsAdmin = isAdmin(user)

  const [threads,      setThreads]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [filter,       setFilter]       = useState('all')      // 'all' | type value
  const [sortBy,       setSortBy]       = useState('recent')   // 'recent' | 'top'
  const [showResolved, setShowResolved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.feedback.getAll()
      setThreads(Array.isArray(data) ? data : [])
    } catch { setThreads([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = threads
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t => showResolved ? true : !t.resolved)
    .sort((a, b) => sortBy === 'top'
      ? (b.upvotes?.length || 0) - (a.upvotes?.length || 0)
      : (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)
    )

  async function handleVote(id, direction) {
    await window.api.feedback.vote({ id, direction })
    load()
  }

  async function handleMarkDone(id) {
    await window.api.feedback.markDone({ id })
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this feedback?')) return
    await window.api.feedback.delete({ id })
    load()
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={`cinzel ${styles.title}`}>Feedback</h1>
          <p className={styles.sub}>Share ideas, report issues, or leave general notes for the dev team.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Feedback</button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <button
            className={`${styles.filterBtn} ${filter === 'all' ? styles.filterActive : ''}`}
            onClick={() => setFilter('all')}
          >All</button>
          {FEEDBACK_TYPES.map(t => (
            <button
              key={t.value}
              className={`${styles.filterBtn} ${filter === t.value ? styles.filterActive : ''}`}
              style={filter === t.value ? { borderColor: t.color, color: t.color } : {}}
              onClick={() => setFilter(filter === t.value ? 'all' : t.value)}
            >{t.label}</button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <button className={`${styles.filterBtn} ${sortBy === 'recent' ? styles.filterActive : ''}`} onClick={() => setSortBy('recent')}>🕐 Recent</button>
          <button className={`${styles.filterBtn} ${sortBy === 'top'    ? styles.filterActive : ''}`} onClick={() => setSortBy('top')}>🔥 Top</button>
          {userIsAdmin || devMode ? (
            <button className={`${styles.filterBtn} ${showResolved ? styles.filterActive : ''}`} onClick={() => setShowResolved(s => !s)}>
              ✅ {showResolved ? 'Hiding' : 'Show'} resolved
            </button>
          ) : null}
        </div>
      </div>

      {/* Thread list */}
      <div className={styles.threads}>
        {loading && <div className={styles.loading}>Loading threads…</div>}
        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            <span style={{ fontSize: 32 }}>💬</span>
            <p>No feedback yet. Be the first!</p>
          </div>
        )}
        {filtered.map(thread => (
          <FeedbackThread
            key={thread.id}
            thread={thread}
            user={user}
            userIsAdmin={userIsAdmin || devMode}
            devMode={devMode}
            dragons={dragons}
            onVote={handleVote}
            onMarkDone={handleMarkDone}
            onDelete={handleDelete}
            onEdit={() => {}} // inline edit handled inside thread
            onRefresh={load}
          />
        ))}
      </div>

      {/* New feedback modal */}
      {showForm && (
        <NewFeedbackModal
          dragons={dragons}
          user={user}
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            await window.api.feedback.create(data)
            setShowForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}

// ── Thread card ───────────────────────────────────────────────────────────────

function FeedbackThread({ thread: t, user, userIsAdmin, dragons, onVote, onMarkDone, onDelete, onRefresh }) {
  const [expanded,  setExpanded]  = useState(false)
  const [editing,   setEditing]   = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [showReply, setShowReply] = useState(false)

  const tc   = typeConfig(t.type)
  const isMe = t.author_id === user.id
  const hasVotedUp   = t.upvotes?.includes(user.id)
  const hasVotedDown = t.downvotes?.includes(user.id)
  const linkedDragon = dragons.find(d => d.id === t.dragon_id)

  async function sendReply() {
    if (!replyBody.trim()) return
    await window.api.feedback.addReply({ id: t.id, body: replyBody.trim() })
    setReplyBody('')
    setShowReply(false)
    onRefresh()
  }

  if (editing) {
    return (
      <EditFeedbackForm
        thread={t}
        dragons={dragons}
        onSave={async (data) => {
          await window.api.feedback.update({ id: t.id, data })
          setEditing(false)
          onRefresh()
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className={`${styles.thread} ${t.resolved ? styles.threadResolved : ''}`}>
      <div className={styles.threadLeft}>
        {/* Vote */}
        <div className={styles.voteCol}>
          <button
            className={`${styles.voteBtn} ${hasVotedUp ? styles.votedUp : ''}`}
            onClick={() => onVote(t.id, 'up')}
            title="Upvote"
          >▲</button>
          <span className={styles.voteCount}>{(t.upvotes?.length || 0) - (t.downvotes?.length || 0)}</span>
          <button
            className={`${styles.voteBtn} ${hasVotedDown ? styles.votedDown : ''}`}
            onClick={() => onVote(t.id, 'down')}
            title="Downvote"
          >▼</button>
        </div>
      </div>

      <div className={styles.threadBody}>
        {/* Type badge + title */}
        <div className={styles.threadMeta}>
          <span className={styles.typeBadge} style={{ background: `${tc.color}20`, color: tc.color, border: `1px solid ${tc.color}40` }}>
            {tc.label}
          </span>
          {t.visibility === 'private' && <span className={styles.privateBadge}>🔒 Private</span>}
          {t.resolved && <span className={styles.resolvedBadge}>✅ Resolved</span>}
          {linkedDragon && (
            <span className={styles.dragonLink}>🐉 {linkedDragon.name || linkedDragon.species}</span>
          )}
        </div>

        <h3 className={styles.threadTitle}>{t.title || '(no title)'}</h3>

        {/* Body — collapsed/expanded */}
        <p className={`${styles.threadText} ${!expanded && styles.threadTextClamped}`}>
          {t.body}
        </p>

        {/* Subtasks */}
        {expanded && t.subtasks?.length > 0 && (
          <ul className={styles.subtasks}>
            {t.subtasks.map((s, i) => (
              <li key={i} className={`${styles.subtask} ${s.done ? styles.subtaskDone : ''}`}>
                {s.done ? '✅' : '☐'} {s.text}
              </li>
            ))}
          </ul>
        )}

        {/* Replies */}
        {expanded && t.replies?.length > 0 && (
          <div className={styles.replies}>
            {t.replies.map((r, i) => (
              <div key={i} className={styles.reply}>
                <span className={styles.replyAuthor}>{r.author_id === user.id ? 'You' : (userIsAdmin ? r.author_id?.slice(0,8) : 'Member')}</span>
                <span className={styles.replyBody}>{r.body}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reply input */}
        {expanded && showReply && (
          <div className={styles.replyInput}>
            <textarea
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              style={{ width:'100%', resize:'vertical' }}
            />
            <div style={{ display:'flex', gap:6, marginTop:4 }}>
              <button className="btn btn-primary btn-sm" onClick={sendReply}>Send</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReply(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.threadActions}>
          <button className={styles.actionBtn} onClick={() => setExpanded(e => !e)}>
            {expanded ? '▴ Collapse' : `▾ Expand${t.replies?.length ? ` (${t.replies.length} replies)` : ''}`}
          </button>
          {expanded && !showReply && (
            <button className={styles.actionBtn} onClick={() => setShowReply(true)}>💬 Reply</button>
          )}
          {isMe && (
            <button className={styles.actionBtn} onClick={() => setEditing(true)}>✏ Edit</button>
          )}
          {(isMe || userIsAdmin) && (
            <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => onDelete(t.id)}>🗑 Delete</button>
          )}
          {userIsAdmin && !t.resolved && (
            <button className={`${styles.actionBtn} ${styles.actionDone}`} onClick={() => onMarkDone(t.id)}>✅ Mark done</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── New feedback modal ────────────────────────────────────────────────────────

function NewFeedbackModal({ dragons, user, onClose, onSave }) {
  const [type,       setType]       = useState('other')
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [subtasks,   setSubtasks]   = useState([])
  const [dragonId,   setDragonId]   = useState('')
  const [visibility, setVisibility] = useState('global')
  const [saving,     setSaving]     = useState(false)

  function addSubtask() { setSubtasks(s => [...s, { text: '', done: false }]) }
  function setSubtaskText(i, v) { setSubtasks(s => s.map((x, j) => j === i ? { ...x, text: v } : x)) }
  function removeSubtask(i) { setSubtasks(s => s.filter((_, j) => j !== i)) }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSave({ type, title: title.trim(), body: body.trim(), subtasks: subtasks.filter(s => s.text.trim()), dragon_id: dragonId || null, visibility })
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className="cinzel" style={{ margin:0, fontSize:16 }}>New Feedback</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {/* Type */}
          <div className="form-group">
            <label>Type</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {FEEDBACK_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={styles.typeBtn}
                  style={{
                    borderColor: type === t.value ? t.color : 'var(--border)',
                    color:       type === t.value ? t.color : 'var(--muted)',
                    background:  type === t.value ? `${t.color}18` : 'transparent',
                  }}
                  onClick={() => setType(t.value)}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief summary…" />
          </div>

          {/* Body */}
          <div className="form-group">
            <label>Description</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Describe in detail…" style={{ width:'100%', resize:'vertical' }} />
          </div>

          {/* Subtasks */}
          <div className="form-group">
            <label>Sub-points</label>
            {subtasks.map((s, i) => (
              <div key={i} style={{ display:'flex', gap:6, marginBottom:4 }}>
                <input value={s.text} onChange={e => setSubtaskText(i, e.target.value)} placeholder={`Point ${i+1}…`} style={{ flex:1 }} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeSubtask(i)}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addSubtask} style={{ marginTop:4 }}>+ Add point</button>
          </div>

          {/* Dragon link */}
          {dragons.length > 0 && (
            <div className="form-group">
              <label>Link a dragon (optional)</label>
              <select value={dragonId} onChange={e => setDragonId(e.target.value)}>
                <option value="">— None —</option>
                {dragons.filter(d => !d.is_dead).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name ? `${d.name} — ` : ''}{d.ownerUsername || d.player_name} · {d.species}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Visibility */}
          <div className="form-group">
            <label>Visibility</label>
            <div style={{ display:'flex', gap:10 }}>
              {[['global','🌐 Global (visible to all)'],['private','🔒 Private (only you + devs)']].map(([v, l]) => (
                <label key={v} style={{ display:'flex', gap:6, alignItems:'center', cursor:'pointer', fontSize:13 }}>
                  <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Posting…' : 'Post feedback'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit feedback form ────────────────────────────────────────────────────────

function EditFeedbackForm({ thread: t, dragons, onSave, onCancel }) {
  const [title,    setTitle]    = useState(t.title || '')
  const [body,     setBody]     = useState(t.body || '')
  const [subtasks, setSubtasks] = useState(t.subtasks || [])
  const [saving,   setSaving]   = useState(false)

  function addSubtask() { setSubtasks(s => [...s, { text: '', done: false }]) }
  function setSubtaskText(i, v) { setSubtasks(s => s.map((x, j) => j === i ? { ...x, text: v } : x)) }
  function removeSubtask(i) { setSubtasks(s => s.filter((_, j) => j !== i)) }

  async function handleSave() {
    setSaving(true)
    try { await onSave({ title: title.trim(), body: body.trim(), subtasks: subtasks.filter(s => s.text.trim()) }) }
    finally { setSaving(false) }
  }

  return (
    <div className={`${styles.thread} ${styles.threadEditing}`}>
      <div className="form-group" style={{ marginBottom:8 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title…" />
      </div>
      <div className="form-group" style={{ marginBottom:8 }}>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} style={{ width:'100%', resize:'vertical' }} />
      </div>
      {subtasks.map((s, i) => (
        <div key={i} style={{ display:'flex', gap:6, marginBottom:4 }}>
          <input value={s.text} onChange={e => setSubtaskText(i, e.target.value)} style={{ flex:1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeSubtask(i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={addSubtask}>+ point</button>
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>Save</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
