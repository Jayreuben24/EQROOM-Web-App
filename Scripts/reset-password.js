/**
 * reset-password.js
 * Handles the page a person lands on after clicking the password-reset
 * link Supabase emails them (triggered by login-auth.js's
 * "Forgot password?" modal calling supabase.auth.resetPasswordForEmail()).
 *
 * That email link encodes a one-time recovery session in the URL (as an
 * #access_token=...&type=recovery fragment, for this project's default
 * "implicit" auth flow). supabase-js parses that automatically as soon as
 * the client is created and fires a PASSWORD_RECOVERY event through
 * onAuthStateChange -- this file listens for that rather than trying to
 * read the URL itself, exactly as Supabase's own docs recommend.
 */
import { supabase } from './supabase-config.js';

const form = document.getElementById('resetPasswordForm');
const statusEl = document.getElementById('resetStatusMessage');
const submitBtn = document.getElementById('resetSubmitBtn');

function showStatus(kind, message) {
    if (!statusEl) return;
    statusEl.innerHTML = `<div class="auth-status-message ${kind}"><i data-lucide="${kind === 'success' ? 'check-circle' : 'alert-circle'}"></i><span>${message}</span></div>`;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function disableForm(disabled) {
    form?.querySelectorAll('input, button').forEach((el) => {
        el.disabled = disabled;
    });
}

const INVALID_LINK_MESSAGE = 'This password reset link is invalid or has expired. Please request a new one from the login page.';

let recoveryReady = false;

supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
        recoveryReady = true;
    }
});

// Fallback for the case where PASSWORD_RECOVERY already fired (or an
// existing session applies) before the listener above got attached --
// either way, having a session at all means the link was valid. Only a
// fully invalid/expired link leaves both checks empty.
setTimeout(async () => {
    if (recoveryReady) return;
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
        recoveryReady = true;
        return;
    }
    disableForm(true);
    showStatus('error', INVALID_LINK_MESSAGE);
}, 1200);

form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (password.length < 8) {
        showStatus('error', 'Password must be at least 8 characters.');
        return;
    }
    if (password !== confirmPassword) {
        showStatus('error', 'Passwords do not match.');
        return;
    }
    if (!recoveryReady) {
        showStatus('error', INVALID_LINK_MESSAGE);
        return;
    }

    submitBtn.disabled = true;
    const { error } = await supabase.auth.updateUser({ password });
    submitBtn.disabled = false;

    if (error) {
        showStatus('error', error.message);
        return;
    }

    // Sign out of this one-off recovery session so the next visit to
    // login.html properly asks for the new password, instead of the
    // browser silently carrying an already-authenticated session.
    await supabase.auth.signOut();

    showStatus('success', 'Your password has been updated. Redirecting to login...');
    disableForm(true);
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1800);
});
