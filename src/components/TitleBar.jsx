import styles from './TitleBar.module.css'

export default function TitleBar({ title = 'DoD Tracker' }) {
  return (
    <div className={styles.bar}>
      <div className={styles.drag}>
        <span className={styles.dragon}>⬡</span>
        <span className={styles.title}>{title}</span>
      </div>
      <div className={styles.controls}>
        <button className={styles.btn} onClick={() => window.api?.window.minimize()} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button className={styles.btn} onClick={() => window.api?.window.maximize()} title="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect width="9" height="9" x="0.5" y="0.5" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
        </button>
        <button className={`${styles.btn} ${styles.close}`} onClick={() => window.api?.window.close()} title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
