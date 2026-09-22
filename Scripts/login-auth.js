import { supabase } from './supabase-config.js';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

/**
 * Renders a small colored banner (success/error) into a container, reusing
 * the .auth-status-message styling shared with reset-password.html.
 */
function showAuthStatus(container, kind, message) {
  if (!container) return;
  container.innerHTML = `<div class="auth-status-message ${kind}"><i data-lucide="${kind === 'success' ? 'check-circle' : 'alert-circle'}"></i><span>${message}</span></div>`;
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Flips back to the login card (if currently on the register side) and
 * pre-fills the email so the person can just enter their password --
 * or reach for "Forgot password?" right there. Used for both the
 * "already registered" signup case and the forgot-password success path.
 */
function goToLoginWithEmail(email) {
  const goToLoginBtn = document.getElementById('goToLogin');
  if (goToLoginBtn) {
    goToLoginBtn.click();
  } else {
    window.location.href = 'index.html';
  }
  const usernameInput = document.getElementById('username');
  if (usernameInput && email) {
    usernameInput.value = email;
    setTimeout(() => document.getElementById('password')?.focus(), 400);
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert(error.message);
      return;
    }

    // Route by role: admins land on the management dashboard, everyone
    // else (students) lands on their own read-only portal. Falls back to
    // the student portal if the profiles row/role can't be read for any
    // reason, since that's the safer default.
    let role = null;
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
      role = profile?.role || null;
    }
    window.location.href = role === 'admin' ? 'dashboard.html' : 'student-dashboard.html';
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('full-name').value.trim();
    const studentId = document.getElementById('new-student-id').value.trim();
    const email = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Must match the same format the ESP32/GM67 scanner expects (e.g. 23-00046),
    // since this is exactly what gets matched against `students.student_id`.
    if (!/^\d{2}-\d{5}$/.test(studentId)) {
      alert('Student ID must be in the format 23-00046 (matching your ID card barcode).');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          // Read by the `handle_new_user_student` trigger in Supabase, which
          // auto-creates the matching row in `public.students` on signup.
          student_id: studentId
        }
      }
    });

    if (error) {
      // If "Confirm email" is turned OFF in the Supabase project, a
      // duplicate signup can't be hidden (see the identities check below),
      // so Supabase reports it directly with an error like this instead.
      if (/already registered|already exists/i.test(error.message)) {
        alert('An account with this email already exists. Taking you to the login page -- if you forgot your password, use "Forgot password?" there.');
        goToLoginWithEmail(email);
      } else {
        alert(error.message);
      }
      return;
    }

    // When "Confirm email" is ON (Supabase's default), signing up again
    // with an email that already has a *confirmed* account does NOT come
    // back as an error -- Supabase deliberately returns a fake "success"
    // instead, so a stranger can't probe which emails are registered. The
    // one way to tell the difference client-side: a genuinely new signup
    // gets a real identity attached to the user; a silently-blocked
    // duplicate comes back with an empty `identities` array.
    const isDuplicate = Array.isArray(data?.user?.identities) && data.user.identities.length === 0;
    if (isDuplicate) {
      alert('An account with this email already exists. Taking you to the login page -- if you forgot your password, use "Forgot password?" there.');
      goToLoginWithEmail(email);
      return;
    }

    alert('Registration successful! You can now log in.');
    goToLoginWithEmail();
  });
}

// -----------------------------------------------------------------------
// Forgot Password
// -----------------------------------------------------------------------
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const forgotPasswordOverlay = document.getElementById('forgotPasswordOverlay');
const forgotPasswordCloseBtn = document.getElementById('forgotPasswordCloseBtn');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const forgotPasswordStatus = document.getElementById('forgotPasswordStatus');
const forgotPasswordSubmitBtn = document.getElementById('forgotPasswordSubmitBtn');

function openForgotPasswordModal() {
  if (!forgotPasswordOverlay) return;
  forgotPasswordStatus.innerHTML = '';
  forgotPasswordForm?.reset();
  const emailInput = document.getElementById('forgot-email');
  if (emailInput) emailInput.disabled = false;
  if (forgotPasswordSubmitBtn) forgotPasswordSubmitBtn.disabled = false;
  // Carry over whatever the person already typed on the login side, if
  // anything, so they don't have to retype their email.
  const usernameInput = document.getElementById('username');
  if (emailInput && usernameInput?.value) emailInput.value = usernameInput.value.trim();
  forgotPasswordOverlay.hidden = false;
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
  emailInput?.focus();
}

function closeForgotPasswordModal() {
  if (forgotPasswordOverlay) forgotPasswordOverlay.hidden = true;
}

forgotPasswordLink?.addEventListener('click', openForgotPasswordModal);
forgotPasswordCloseBtn?.addEventListener('click', closeForgotPasswordModal);
forgotPasswordOverlay?.addEventListener('click', (e) => {
  if (e.target === forgotPasswordOverlay) closeForgotPasswordModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && forgotPasswordOverlay && !forgotPasswordOverlay.hidden) {
    closeForgotPasswordModal();
  }
});

forgotPasswordForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) return;

  forgotPasswordSubmitBtn.disabled = true;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Wherever this page happens to be served from right now (localhost,
    // an ngrok tunnel, or a real deploy) -- that exact origin must also be
    // added to Supabase's Authentication > URL Configuration > Redirect
    // URLs allow list, or Supabase will refuse/ignore this redirectTo.
    redirectTo: `${window.location.origin}/reset-password.html`
  });

  if (error) {
    forgotPasswordSubmitBtn.disabled = false;
    showAuthStatus(forgotPasswordStatus, 'error', error.message);
    return;
  }

  // Supabase intentionally reports success here even if no account uses
  // this email, so it can't be used to check which emails are registered
  // -- this wording stays true either way.
  showAuthStatus(forgotPasswordStatus, 'success', 'If an account exists for that email, a password reset link is on its way. Check your inbox.');
  document.getElementById('forgot-email').disabled = true;
});