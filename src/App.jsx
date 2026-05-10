import { useState, useEffect, createContext, useContext } from 'react'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import CalibratePage from './pages/CalibratePage'
import ToastProvider, { useToast } from './components/ToastProvider'
import WhatsNewModal from './components/WhatsNewModal'
import DevCaptureModal from './components/DevCaptureModal'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

function AppInner() {
  const [user,           setUser]           = useState(null)
  const [page,           setPage]           = useState('auth')
  const [pendingCapture, setPendingCapture] = useState(null)
  const [theme,          setTheme]          = useState(localStorage.getItem('dod_theme') || 'dark')
  const [whatsNew,       setWhatsNew]       = useState(null)  // { version, body } or null
  const { addToast } = useToast()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('dod_theme', theme)
  }, [theme])

  async function checkWhatsNew() {
    try {
      const versions = await window.api?.feedback.getVersions?.()
      if (!versions?.length) return
      const latest = versions[0]
      const seenKey = `dod_seen_version_${latest.version}`
      if (!localStorage.getItem(seenKey)) {
        setWhatsNew(latest)
      }
    } catch {}
  }

  // ── Auto-login from saved session ──
  useEffect(() => {
    window.api?.auth.restoreSession?.()
      .then(res => {
        if (res?.ok && res.user) {
          setUser(res.user)
          setPage('dashboard')
          window.api?.session.setUser({ userId: res.user.id, role: res.user.role || 'member' })
          const storedKey = localStorage.getItem('dod_api_key') || ''
          if (storedKey) window.api?.session.setApiKey({ apiKey: storedKey })
          checkWhatsNew()
        }
      })
      .catch(() => {})
  }, [])

  const isCalibrate = window.location.hash === '#/calibrate'

  function syncApiKey(key) {
    window.api?.session.setApiKey({ apiKey: key || null })
  }

  // Listen for F8 capture results — store in context so DashboardPage can show the form
  useEffect(() => {
    if (!window.api?.capture || isCalibrate) return
    window.api.capture.onResult((result) => {
      if (result.ok && result.needsConfirmation) {
        setPendingCapture(result)
        addToast('📸 Dragon captured — review and confirm', 'info')
      } else if (!result.ok) {
        addToast(result.error || 'Capture failed', 'error')
      }
    })
    window.api.capture.onError((msg) => {
      addToast(`Capture error: ${msg}`, 'error')
    })
    return () => window.api?.capture.removeListeners()
  }, [isCalibrate])

  function handleLogin(userData) {
    setUser(userData)
    setPage('dashboard')
    window.api?.session.setUser({ userId: userData.id, role: userData.role || 'member' })
    const storedKey = localStorage.getItem('dod_api_key') || ''
    if (storedKey) syncApiKey(storedKey)
    checkWhatsNew()
  }

  function handleLogout() {
    setUser(null)
    setPage('auth')
    window.api?.auth.logout()
    window.api?.session.setUser({ userId: null, role: 'member' })
  }

  // pendingCapture is exposed via context so DashboardPage can consume it
  // and pass real allDragons/clanDragons to the form
  const ctx = {
    user, setUser, navigate: setPage, addToast, syncApiKey, theme, setTheme,
    pendingCapture, setPendingCapture,
  }

  if (isCalibrate) {
    return (
      <AppContext.Provider value={ctx}>
        <CalibratePage />
      </AppContext.Provider>
    )
  }

  return (
    <AppContext.Provider value={ctx}>
      {page === 'auth'      && <AuthPage onLogin={handleLogin} />}
      {page === 'dashboard' && <DashboardPage onLogout={handleLogout} />}
      {whatsNew && (
        <WhatsNewModal
          version={whatsNew.version}
          body={whatsNew.body}
          onClose={() => {
            localStorage.setItem(`dod_seen_version_${whatsNew.version}`, '1')
            setWhatsNew(null)
          }}
        />
      )}
      <DevCaptureModal role={user?.role} />
    </AppContext.Provider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
