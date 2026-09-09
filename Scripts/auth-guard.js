// auth-guard.js
import { supabase } from './supabase-config.js'

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) window.location.href = 'login.html'
  return session
}

export async function requireRole(role) {
  const session = await requireAuth()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile.role !== role) {
    window.location.href = 'login.html'
  }
  return session
}

// Fetches the signed-in user's own `profiles` row (role, name, etc.).
// Shared by requireAdmin/requireStudent below so both guards agree on
// what "admin" means -- exactly what is_admin() checks in Supabase:
// profiles.role === 'admin'.
async function getOwnProfile(session) {
  const s = session || await requireAuth()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', s.user.id)
    .single()
  return { session: s, profile }
}

// Guards the admin pages (dashboard, inventory, users & directory, activity
// logs, settings). A signed-in student who navigates here directly gets
// bounced to their own portal instead of being let in or booted to login.
export async function requireAdmin() {
  const { session, profile } = await getOwnProfile()
  if (!profile || profile.role !== 'admin') {
    window.location.href = 'student-dashboard.html'
    return null
  }
  return session
}

// Guards the student portal. An admin account that wanders here is sent
// back to the admin dashboard instead.
export async function requireStudent() {
  const { session, profile } = await getOwnProfile()
  if (profile && profile.role === 'admin') {
    window.location.href = 'dashboard.html'
    return null
  }
  return session
}

// Ends the current Supabase session and returns the user to the login screen.
// Used by the "Logout" sidebar link and the "Sign out" actions in Settings.
export async function logout() {
  await supabase.auth.signOut()
  window.location.href = 'login.html'
}