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

    // Redirect to dashboard on successful login
    window.location.href = 'dashboard.html';
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('full-name').value;
    const email = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
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