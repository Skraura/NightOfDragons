// roleUtils.js — v7.2.0
// Single source of truth for role checks.
// Roles: 'member' | 'admin' | 'dev'
// Devs have all admin rights by default.

export function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'dev'
}

export function isDev(user) {
  return user?.role === 'dev'
}

export function roleName(user) {
  if (user?.role === 'dev')   return 'Developer'
  if (user?.role === 'admin') return 'Administrator'
  return 'Dragon Keeper'
}

export function roleLabel(user) {
  return user?.role || 'member'
}
