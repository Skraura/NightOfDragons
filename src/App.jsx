import { useState, useEffect, createContext, useContext } from 'react'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import CalibratePage from './pages/CalibratePage'
import ToastProvider, { useToast } from './components/ToastProvider'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

function AppInner() {
  const [user,           setUser]           = useState(null)
  const [page,           setPage]           = useState('auth')
  const [pendingCapture, setPendingCapture] = useState(null)
  const [theme,          setTheme]          = useState(localStorage.getItem('dod_theme') || 'dark')
  const { addToast } = useToast()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('dod_theme', theme)
  }, [theme])

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
    window.api?.session.setUser({ userId: userData.id, isAdmin: !!userData.isAdmin })
    const storedKey = localStorage.getItem('dod_api_key') || ''
    if (storedKey) syncApiKey(storedKey)
  }

  function handleLogout() {
    setUser(null)
    setPage('auth')
    window.api?.auth.logout()
    window.api?.session.setUser({ userId: null, isAdmin: false })
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
