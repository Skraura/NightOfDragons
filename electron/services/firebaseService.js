/**
 * firebaseService.js — v6.1
 *
 * Auth model (v6.1):
 *   - Firebase Auth uses EMAIL + PASSWORD (real email, not synthesised)
 *   - Each Firebase Auth user (= one person) can have MULTIPLE "accounts"
 *     (their in-game Steam handles), stored in Firestore /users/{uid}/accounts[]
 *   - Dragons are owned by an account (accountId), not the Firebase uid directly
 *     but user_id still maps to Firebase uid for access control
 *   - accountId = uid + ':' + slugified-steam-name  (or just uid for the first/default)
 *
 * Firestore layout:
 *   /users/{uid}            → { email, displayName, role, isAdmin, createdAt, accounts: [{id,label},...] }
 *   /dragons/{dragonId}     → { user_id: uid, account_id: accountId, ...fields }
 */

const { app }  = require('electron')
const path     = require('path')
const fs       = require('fs')

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA44OECAgy4288Llx6YM1lN_dYYSL0SHhw",
  authDomain:        "night-of-dragons-skraura.firebaseapp.com",
  projectId:         "night-of-dragons-skraura",
  storageBucket:     "night-of-dragons-skraura.firebasestorage.app",
  messagingSenderId: "616643130330",
  appId:             "1:616643130330:web:0a304abfe0fa1f7f83c6e3",
  measurementId:     "G-2TVYFZ40WQ",
}

// ─── Lazy SDK loader ──────────────────────────────────────────────────────────
let _app  = null
let _auth = null
let _db   = null

async function getFirebase() {
  if (_app) return { auth: _auth, db: _db }
  const { initializeApp }  = await import('firebase/app')
  const { getAuth }        = await import('firebase/auth')
  const { getFirestore }   = await import('firebase/firestore')
  _app  = initializeApp(FIREBASE_CONFIG)
  _auth = getAuth(_app)
  _db   = getFirestore(_app)
  return { auth: _auth, db: _db }
}

// ─── Session persistence ──────────────────────────────────────────────────────
function getTokenPath() { return path.join(app.getPath('userData'), 'firebase-session.json') }
function saveSession(data) { fs.writeFileSync(getTokenPath(), JSON.stringify(data, null, 2)) }
function clearSession()    { try { fs.unlinkSync(getTokenPath()) } catch {} }
function loadSession()     { try { return JSON.parse(fs.readFileSync(getTokenPath(), 'utf8')) } catch { return null } }

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function register(email, password, displayName) {
  const { auth, db } = await getFirebase()
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth')
  const { doc, setDoc } = await import('firebase/firestore')

  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
  const uid  = cred.user.uid
  await updateProfile(cred.user, { displayName: displayName?.trim() || email.split('@')[0] })

  const name    = displayName?.trim() || email.split('@')[0]
  const isAdmin = ['Skraura', 'Infernik'].includes(name)

  // First account = the display name they used at registration
  const defaultAccount = { id: uid, label: name }

  await setDoc(doc(db, 'users', uid), {
    email:       email.trim(),
    displayName: name,
    role:        isAdmin ? 'admin' : 'member',
    isAdmin,
    accounts:    [defaultAccount],
    createdAt:   new Date().toISOString(),
  })

  const user = { id: uid, username: name, email: email.trim(), role: isAdmin ? 'admin' : 'member', isAdmin, accounts: [defaultAccount] }
  saveSession(user)
  return { ok: true, user }
}

async function login(email, password) {
  const { auth, db } = await getFirebase()
  const { signInWithEmailAndPassword } = await import('firebase/auth')
  const { doc, getDoc } = await import('firebase/firestore')

  const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
  const uid  = cred.user.uid

  const profile = await getDoc(doc(db, 'users', uid))
  const data    = profile.exists() ? profile.data() : {}

  const user = {
    id:       uid,
    username: data.displayName || email.split('@')[0],
    email:    data.email || email.trim(),
    role:     data.role  || 'member',
    isAdmin:  data.isAdmin || data.role === 'admin',
    accounts: data.accounts || [{ id: uid, label: data.displayName || email.split('@')[0] }],
  }
  saveSession(user)
  return { ok: true, user }
}

async function logout() {
  const { auth } = await getFirebase()
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
  clearSession()
  return { ok: true }
}

async function listUsers() {
  const { db } = await getFirebase()
  const { collection, getDocs, orderBy, query } = await import('firebase/firestore')
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function updateRole(userId, role) {
  const { db } = await getFirebase()
  const { doc, updateDoc } = await import('firebase/firestore')
  await updateDoc(doc(db, 'users', userId), { role, isAdmin: role === 'admin' })
  return { ok: true }
}

async function updatePassword(userId, newPassword) {
  const { auth } = await getFirebase()
  const { updatePassword: fbUpdatePassword } = await import('firebase/auth')
  if (auth.currentUser?.uid === userId) {
    await fbUpdatePassword(auth.currentUser, newPassword)
    return { ok: true }
  }
  return { ok: false, error: 'Can only change your own password' }
}

// ── Accounts management (Steam handles) ──────────────────────────────────────

async function addAccount(userId, label) {
  const { db } = await getFirebase()
  const { doc, getDoc, updateDoc, arrayUnion } = await import('firebase/firestore')
  const ref  = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { ok: false, error: 'User not found' }

  const accountId = `${userId}:${label.trim().toLowerCase().replace(/\s+/g, '_')}`
  const existing  = (snap.data().accounts || []).find(a => a.id === accountId)
  if (existing) return { ok: false, error: 'Account already exists' }

  await updateDoc(ref, { accounts: arrayUnion({ id: accountId, label: label.trim() }) })
  return { ok: true, accountId }
}

async function removeAccount(userId, accountId) {
  const { db } = await getFirebase()
  const { doc, getDoc, updateDoc } = await import('firebase/firestore')
  const ref  = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { ok: false, error: 'User not found' }

  const accounts = (snap.data().accounts || []).filter(a => a.id !== accountId)
  if (accounts.length === 0) return { ok: false, error: 'Cannot remove last account' }
  await updateDoc(ref, { accounts })
  return { ok: true }
}

function restoreSession() { return loadSession() }
function getCloudSettings() { return { ...FIREBASE_CONFIG, enabled: true } }

// ─── Dragons ──────────────────────────────────────────────────────────────────

async function getAllDragons(userId) {
  const { db } = await getFirebase()
  const { collection, getDocs, orderBy, query, where } = await import('firebase/firestore')
  const snap = await getDocs(
    query(collection(db, 'dragons'), where('user_id', '==', userId), orderBy('created_at', 'desc'))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function getDragon(userId, dragonId) {
  const { db } = await getFirebase()
  const { doc, getDoc } = await import('firebase/firestore')
  const snap = await getDoc(doc(db, 'dragons', dragonId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

async function createDragon(userId, data) {
  const { db } = await getFirebase()
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
  const ref = await addDoc(collection(db, 'dragons'), {
    ...sanitizeDragon(data),
    user_id:    userId,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  })
  return { ok: true, id: ref.id }
}

async function updateDragon(userId, dragonId, data) {
  const { db } = await getFirebase()
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
  await updateDoc(doc(db, 'dragons', dragonId), {
    ...sanitizeDragon(data),
    updated_at: serverTimestamp(),
  })
  return { ok: true }
}

async function deleteDragon(userId, dragonId) {
  const { db } = await getFirebase()
  const { doc, deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'dragons', dragonId))
  return { ok: true }
}

async function getAllDragonsClan() {
  const { db } = await getFirebase()
  const { collection, getDocs, orderBy, query } = await import('firebase/firestore')

  const dragonsSnap = await getDocs(query(collection(db, 'dragons'), orderBy('created_at', 'desc')))
  const dragons = dragonsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  const usersSnap = await getDocs(collection(db, 'users'))
  const userMap = {}
  const userDisplayNames = {}
  usersSnap.docs.forEach(d => {
    const data = d.data()
    const displayName = data.displayName || data.email || d.id
    userDisplayNames[d.id] = displayName
    userMap[d.id] = displayName
    // Also map account IDs to labels
    ;(data.accounts || []).forEach(a => { userMap[a.id] = a.label })
  })

  return dragons.map(dragon => {
    const uid = dragon.user_id
    const userDisplayName = userDisplayNames[uid] || 'Unknown'
    const accountLabel = userMap[dragon.account_id] || userMap[uid] || 'Unknown'
    return {
      ...dragon,
      ownerUsername: accountLabel,       // the specific Steam handle / account label
      ownerDisplayName: userDisplayName, // main account (Firebase displayName)
    }
  })
}

function sanitizeDragon(data) {
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

// ─── Nesting Spots (admin-shared) ────────────────────────────────────────────
// Stored in /nestingSpots/{spotId} — readable by all, writable by admins only

async function getNestingSpots() {
  const { db } = await getFirebase()
  const { collection, getDocs, orderBy, query } = await import('firebase/firestore')
  const snap = await getDocs(query(collection(db, 'nestingSpots'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function saveNestingSpot(spot) {
  const { db } = await getFirebase()
  const { collection, addDoc, doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
  if (spot.id) {
    await updateDoc(doc(db, 'nestingSpots', spot.id), {
      name: spot.name, x: spot.x, y: spot.y, updatedAt: serverTimestamp(),
    })
    return { ok: true, id: spot.id }
  }
  const ref = await addDoc(collection(db, 'nestingSpots'), {
    name: spot.name, x: spot.x, y: spot.y,
    createdBy: spot.createdBy || '',
    createdAt: serverTimestamp(),
  })
  return { ok: true, id: ref.id }
}

async function deleteNestingSpot(spotId) {
  const { db } = await getFirebase()
  const { doc, deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'nestingSpots', spotId))
  return { ok: true }
}

// ─── Export / Import ──────────────────────────────────────────────────────────

async function exportUser(userId) {
  const dragons = await getAllDragons(userId)
  return JSON.stringify({ version: 2, userId, exportedAt: Date.now(), dragons }, null, 2)
}

async function importDragons(userId, jsonStr) {
  const payload = JSON.parse(jsonStr)
  const dragons = payload.dragons || []
  let count = 0
  for (const d of dragons) {
    const { id, user_id, created_at, updated_at, ...rest } = d
    await createDragon(userId, rest)
    count++
  }
  return { ok: true, imported: count }
}

module.exports = {
  register, login, logout, listUsers, updateRole, updatePassword,
  addAccount, removeAccount,
  restoreSession, getCloudSettings,
  getAllDragons, getDragon, createDragon, updateDragon, deleteDragon, getAllDragonsClan,
  getNestingSpots, saveNestingSpot, deleteNestingSpot,
  exportUser, importDragons,
}
