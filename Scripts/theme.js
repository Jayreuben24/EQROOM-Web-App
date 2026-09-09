/**
 * theme.js
 * Shared dark-mode toggle for every CO-EQROOM page.
 *
 * The theme choice is stored in localStorage (per browser, not tied to
 * the signed-in account) under 'coeqroom-theme' and applied by setting
 * data-theme="dark"|"light" on <html>. Every color in styles-web.css and
 * styles-login.css is a CSS variable read off that attribute, so this
 * file only needs to flip the attribute and keep toggle buttons in sync
 * -- it doesn't touch any element styling directly.
 *
 * A tiny inline script at the very top of <head> on every page (before
 * the stylesheet link) already reads localStorage and sets the attribute
 * synchronously, so the correct theme paints immediately with no flash.
 * This file runs after that and wires up the actual toggle control(s).
 *
 * Two kinds of control are supported, and a page can mix both:
 *   .theme-toggle-btn        -- an icon button (sidebar nav item, or the
 *                                floating button on the login page).
 *   .theme-toggle-checkbox   -- a <input type="checkbox"> inside a
 *                                .switch (used by the Appearance tab in
 *                                Settings), kept in sync the same way.
 */
(function () {
    var STORAGE_KEY = 'coeqroom-theme';

    function getStored() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function setStored(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // Private browsing / storage disabled -- the toggle still
            // works for the rest of this page load, it just won't persist.
        }
    }

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function syncControls(theme) {
        document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
            btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
            var icon = btn.querySelector('[data-theme-icon]');
            if (icon) icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        });
        document.querySelectorAll('.theme-toggle-checkbox').forEach(function (input) {
            input.checked = theme === 'dark';
        });
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        syncControls(theme);
    }

    function toggleTheme() {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        setStored(next);
    }

    function setTheme(theme) {
        applyTheme(theme);
        setStored(theme);
    }

    function init() {
        // The inline head script already set the attribute; this just
        // makes sure every toggle control's state agrees with it, and
        // wires up interaction.
        syncControls(currentTheme());
        document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
            btn.addEventListener('click', toggleTheme);
        });
        document.querySelectorAll('.theme-toggle-checkbox').forEach(function (input) {
            input.addEventListener('change', function () {
                setTheme(input.checked ? 'dark' : 'light');
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
