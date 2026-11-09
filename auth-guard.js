// auth-guard.js
import { supabase } from './supabase-config.js'

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  // Return null (instead of letting callers dereference it) as soon as
  // there's no session -- the redirect below doesn't halt script
  // execution, so without this, every caller that immediately does
  // `session.user.id` would throw "Cannot read properties of null"
  // in the console on a visit from a signed-out browser.
  if (!session) {
    window.location.href = 'index.html'
    return null
  }
  return session
}

export async function requireRole(role) {
  const session = await requireAuth()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile.role !== role) {
    window.location.href = 'index.html'
  }
  return session
}

// Fetches the signed-in user's own `profiles` row (role, name, etc.).
// Shared by every guard below so they all agree on what each role means:
//   profiles.role === 'admin'   -> admin pages
//   profiles.role === 'student' -> student portal
//   anything else ('user', null, unreadable) -> restricted holding page
async function getOwnProfile(session) {
  const s = session || await requireAuth()
  // requireAuth() already redirected to index.html if there's no session --
  // just stop here instead of dereferencing s.user on a null session.
  if (!s) return { session: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', s.user.id)
    .single()
  return { session: s, profile }
}

// Where each role lands. Unknown/missing roles fall through to the
// restricted page, which is the safe default.
export function homeForRole(role) {
  if (role === 'admin') return 'dashboard.html'
  if (role === 'student') return 'student-dashboard.html'
  return 'user-dashboard.html'
}

// Guards the admin pages (dashboard, inventory, users & directory, activity
// logs, settings). Anyone who isn't an admin is sent to their own landing
// page instead of being let in.
export async function requireAdmin() {
  const { session, profile } = await getOwnProfile()
  if (!session) return null
  if (!profile || profile.role !== 'admin') {
    window.location.href = homeForRole(profile?.role)
    return null
  }
  return session
}

// Guards the student portal. Admins go back to the admin dashboard, and
// accounts that aren't students (role 'user') go to the restricted page.
export async function requireStudent() {
  const { session, profile } = await getOwnProfile()
  if (!session) return null
  if (!profile || profile.role !== 'student') {
    window.location.href = homeForRole(profile?.role)
    return null
  }
  return session
}

// Guards the restricted "user" page. Admins and students are sent to their
// own areas; everyone else (role 'user', or no readable role) stays here.
// Returns { session, profile } so the page can show the account details.
export async function requireUser() {
  const { session, profile } = await getOwnProfile()
  if (!session) return { session: null, profile: null }
  if (profile && (profile.role === 'admin' || profile.role === 'student')) {
    window.location.href = homeForRole(profile.role)
    return { session: null, profile }
  }
  return { session, profile }
}

// Ends the current Supabase session and returns the user to the login screen.
// Used by the "Logout" sidebar link and the "Sign out" actions in Settings.
export async function logout() {
  await supabase.auth.signOut()
  window.location.href = 'index.html'
}