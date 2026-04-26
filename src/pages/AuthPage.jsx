import { useState } from 'react'
import TitleBar from '../components/TitleBar'
import styles from './AuthPage.module.css'

export default function AuthPage({ onLogin }) {
  const [mode,        setMode]        = useState('login')   // 'login' | 'register'
  const [email,       setEmail]       = useState('')
  const [displayName, setDisplayName] = useState('')        // register only
  const [password,    setPassword]    = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let res
      if (mode === 'login') {
        res = await window.api.auth.login({ email: email.trim(), password })
      } else {
        if (!displayName.trim()) { setError('Display name is required'); setLoading(false); return }
        res = await window.api.auth.register({ email: email.trim(), password, displayName: displayName.trim() })
      }
      if (res.ok) onLogin(res.user)
      else setError(res.error || 'Something went wrong')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <TitleBar />
      <div className={styles.bg}>
        <div className={styles.scales} aria-hidden />
        <div className={styles.glow}   aria-hidden />
      </div>

      <div className={styles.center}>
        <div className={styles.logo}>
          <div className={styles.logoHex}>⬡</div>
          <h1 className={`cinzel ${styles.logoTitle}`}>DoD Tracker</h1>
          <p className={styles.logoSub}>Day of Dragons · Dragon Registry</p>
        </div>

        <div className={styles.card}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${mode === 'login'    ? styles.tabActive : ''}`} onClick={() => { setMode('login');    setError('') }}>Sign In</button>
            <button className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`} onClick={() => { setMode('register'); setError('') }}>Create Account</button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus required />
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label>Display Name <span style={{ color:'var(--hint)', fontWeight:400 }}>(your main Steam handle)</span></label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Skraura" required />
              </div>
            )}

            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={loading}>
              {loading ? 'Loading…' : mode === 'login' ? 'Enter the Registry' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className={styles.footer}>
          All data synced with Firebase · Local settings stay on your machine
        </p>
      </div>
    </div>
  )
}
