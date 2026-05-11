// roleUtils.js — Beta1.2
// Single source of truth for role checks.
// Roles: 'member' | 'breeder' | 'admin' | 'dev'
//
// Hierarchy (highest → lowest):
//   dev    — all admin rights + dev tools + calibration
//   admin  — manage roles, see all data, clan management
//   breeder— like member but can see Shared Nesting Spots & Breeder/Fighter pairings
//   member — basic access

export function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'dev'
}

export function isDev(user) {
  return user?.role === 'dev'
}

export function isBreeder(user) {
  return user?.role === 'breeder' || isAdmin(user)
}

/** Can see breeder pairings & shared nesting spots */
export function canSeeBreederContent(user) {
  return user?.role === 'breeder' || user?.role === 'admin' || user?.role === 'dev'
}

export function roleName(user) {
  if (user?.role === 'dev')     return 'Developer'
  if (user?.role === 'admin')   return 'Administrator'
  if (user?.role === 'breeder') return 'Breeder'
  return 'Dragon Keeper'
}

export function roleLabel(user) {
  return user?.role || 'member'
}
