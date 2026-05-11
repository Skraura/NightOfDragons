import styles from './Sidebar.module.css'
import { isAdmin, isDev, roleName, canSeeBreederContent } from '../lib/roleUtils'

const NAV = [
  { id: 'account-dashboard', label: 'Dashboard',   Icon: DashboardIcon },
  { id: 'dragons',           label: 'Registry',    Icon: DragonIcon  },
  { id: 'elder',             label: 'Elder',       Icon: ElderIcon   },
  { id: 'crystals',          label: 'Crystals',    Icon: CrystalIcon },
  { id: 'nesting',           label: 'Nesting',     Icon: NestingIcon },
  { id: 'map',               label: 'Map',         Icon: MapIcon     },
  { id: 'feedback',          label: 'Feedback',    Icon: FeedbackIcon, adminOnly: true },
  { id: 'settings',          label: 'Settings',    Icon: SettingsIcon },
]

// Breeder section — visible to Breeders, Admins, Devs (green colour)
const NAV_BREEDER = [
  { id: 'clan-canvas', label: 'Clan Graph',  Icon: ClanCanvasIcon },
]

// Admin section — visible to Admins and Devs only
const NAV_ADMIN = [
  { id: 'lineage',     label: 'Lineage',     Icon: LineageIcon },
  { id: 'clan-map',    label: 'Clan Map',    Icon: MapIcon },
]

const NAV_DEV = [
  { id: 'dev-feedback',   label: 'Feedback',    Icon: FeedbackIcon },
  { id: 'dev-simulation', label: 'Simulations', Icon: SimIcon },
  { id: 'dev-training',   label: 'OCR Training', Icon: TrainingIcon },
]

export default function Sidebar({ user, view, onView, onLogout, stats }) {
  const userIsAdmin   = isAdmin(user)
  const userIsDev     = isDev(user)
  const userIsBreeder = !userIsAdmin && !userIsDev && canSeeBreederContent(user)

  return (
    <aside className={styles.sidebar}>
      <div className={styles.user}>
        <div className={styles.avatar}>{user.username[0].toUpperCase()}</div>
        <div className={styles.userInfo}>
          <span className={styles.username}>
            {user.username}
            {userIsDev     && <span className={styles.devBadge}     title="Developer">⚙</span>}
            {!userIsDev && userIsAdmin  && <span className={styles.adminBadge}   title="Admin">★</span>}
            {userIsBreeder && <span className={styles.breederBadge} title="Breeder">🐣</span>}
          </span>
          <span className={styles.userSub}>
            {roleName(user)}
            <span className={styles.cloudPip}> · ☁</span>
          </span>
        </div>
      </div>

      <div className={styles.divider} />

      <nav className={styles.nav}>
        {NAV.map(({ id, label, Icon, adminOnly }) => {
          const locked = adminOnly && !userIsAdmin
          return (
            <button
              key={id}
              className={`${styles.navBtn} ${view === id ? styles.navActive : ''} ${locked ? styles.navLocked : ''}`}
              onClick={() => !locked && onView(id)}
              title={locked ? 'Admin & Dev only' : undefined}
            >
              <Icon />
              <span>{label}</span>
              {locked && <span className={styles.lockIcon} title="Admin & Dev only">🔒</span>}
            </button>
          )
        })}

        {/* Breeder section — Breeders, Admins, Devs */}
        {canSeeBreederContent(user) && (
          <>
            <div className={`${styles.navSectionLabel} ${styles.navSectionBreeder}`}>Breeder</div>
            {NAV_BREEDER.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`${styles.navBtn} ${styles.navBreederBtn} ${view === id ? styles.navActive : ''}`}
                onClick={() => onView(id)}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </>
        )}

        {/* Admin section — Admins and Devs only */}
        {userIsAdmin && (
          <>
            <div className={styles.navSectionLabel}>Admin</div>
            {NAV_ADMIN.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`${styles.navBtn} ${styles.navAdminBtn} ${view === id ? styles.navActive : ''}`}
                onClick={() => onView(id)}
                title="Admin-only"
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </>
        )}

        {userIsDev && (
          <>
            <div className={`${styles.navSectionLabel} ${styles.navSectionDev}`}>Dev</div>
            {NAV_DEV.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`${styles.navBtn} ${styles.navDevBtn} ${view === id ? styles.navActive : ''}`}
                onClick={() => onView(id)}
                title="Dev tools"
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      <div className={styles.divider} />

      <div className={styles.stats}>
        <p className={styles.statsLabel}>Registry</p>
        <div className={styles.statGrid}>
          <Stat value={stats.total}    label="Total" />
          <Stat value={stats.elders}   label="Elders" color="var(--elder)" />
          <Stat value={stats.breeders} label="Breeders" />
          <Stat value={stats.fighters} label="Fighters" />
        </div>
      </div>

      <div className={styles.spacer} />

      <div className={styles.hint}>
        <kbd className={styles.kbd}>F8</kbd>
        <span>Capture dragon stats</span>
      </div>

      <button className={styles.logout} onClick={onLogout}>
        <LogoutIcon />
        <span>Sign out</span>
      </button>
    </aside>
  )
}

function Stat({ value, label, color }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue} style={color ? { color } : undefined}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function CrystalIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 19 7 19 17 12 22 5 17 5 7"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="17" x2="19" y2="17"/></svg>
}
function DragonIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8 2 4 5 4 9c0 2 1 4 3 5.5L5 18l4-1.5c1 .3 2 .5 3 .5s2-.2 3-.5L19 18l-2-3.5C19 13 20 11 20 9c0-4-4-7-8-7z"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/></svg>
}
function ElderIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}
function NestingIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
}
function LineageIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M12 11l-5 6M12 11l5 6"/></svg>
}
function SettingsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function MapIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
}
function ClanCanvasIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9"/><line x1="12" y1="9" x2="12" y2="12"/></svg>
}
function DashboardIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function LogoutIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
function FeedbackIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function SimIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
function TrainingIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
