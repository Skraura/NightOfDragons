# What's New — v7.2.0

## 🔐 Role System Overhaul
The `isAdmin: true/false` boolean has been **removed** entirely from Firebase and replaced with a clean `role` string field.

**Valid roles:**
- `member` — Standard clan member
- `admin` — Full admin rights (Clan Canvas, Clan Map, nesting spots, user management)
- `dev` — All admin rights **plus** Dev tools (Feedback console, Simulation tools)

> **Action required for existing accounts:** Open Firebase Console → Firestore → your user document → set `role` to `"admin"` or `"dev"` as needed. Remove the old `isAdmin` field if present.

**Updated Firestore rules** — paste these into your Firebase Console → Firestore → Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'dev');
    }
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }
    match /dragons/{dragonId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /nestingSpots/{spotId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}
```

## 🎨 New App Logo
The new clan logo is now used as the app window icon and browser tab favicon.

## 🛠 Dev Section (Sidebar)
A new blue **Dev** section appears in the sidebar for users with `role: "dev"`. Contains two placeholder tabs — **Feedback** and **Simulations** — which will be fully implemented in v7.7.0 and v7.8.0.

---
_Next: v7.3.0 — Stats overhaul (Bile Production, stat reorder, recessive stats, duplicate prevention)_
