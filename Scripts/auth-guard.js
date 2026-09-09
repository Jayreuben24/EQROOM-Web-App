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

// Ends the current Supabase session and returns the user to the login screen.
// Used by the "Logout" sidebar link and the "Sign out" actions in Settings.
export async function logout() {
  await supabase.auth.signOut()
  window.location.href = 'login.html'
}