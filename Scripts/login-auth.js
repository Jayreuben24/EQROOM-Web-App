import { supabase } from './supabase-config.js';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

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
    const email = document.getElementById('new-username').value;
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
      alert(error.message);
      return;
    }

    alert('Registration successful! You can now log in.');
    // Trigger click on 'Sign In' button to flip back to login card
    const goToLoginBtn = document.getElementById('goToLogin');
    if (goToLoginBtn) {
      goToLoginBtn.click();
    } else {
      window.location.href = 'login.html';
    }
  });
}