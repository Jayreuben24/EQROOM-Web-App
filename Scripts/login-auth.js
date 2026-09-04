import { supabase } from './supabase-config.js'

const loginForm = document.getElementById('login-form')

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const errorMsg = document.getElementById('error-message')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    errorMsg.textContent = error.message
    errorMsg.style.display = 'block'
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profileError) {
    errorMsg.textContent = 'Could not load user profile.'
    return
  }

  window.location.href = profile.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html'
})