/**
 * animations.js
 * Interactivity and animations for CO-EQROOM Web Application:
 * - Live real-time date and clock sync (matching format in mockups)
 * - Lucide SVG icon hydration
 * - Sidebar collapse / mobile toggle
 * - Search filter for data tables
 * - Interactive door access lock/unlock simulation
 * - Smooth entrance animations & hover micro-interactions
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Lucide Icons
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    // 2. Real-time Clock and Date
    const updateDateTime = () => {
        const dateEl = document.getElementById('liveDate');
        const timeEl = document.getElementById('liveTime');
        const now = new Date();

        if (dateEl) {
            const options = { month: 'short', day: 'numeric', year: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('en-US', options);
        }

        if (timeEl) {
            const timeStr = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            timeEl.textContent = timeStr;
        }
    };

    updateDateTime();
    setInterval(updateDateTime, 1000);

    // 3. Mobile Sidebar Toggle & Desktop Minimize Toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');

    // The icon-rail "minimized" sidebar is a desktop-only concept -- on
    // tablets and phones the sidebar already auto-collapses (tablet) or
    // becomes a top bar (phone) purely via CSS, so restoring/toggling
    // .minimized down there would only fight those layouts.
    const isDesktopWidth = () => window.innerWidth > 1024;

    // Restore saved minimized state
    if (isDesktopWidth() && localStorage.getItem('sidebar-minimized') === 'true' && sidebar) {
        sidebar.classList.add('minimized');
        document.body.classList.add('sidebar-is-minimized');
    }

    if (sidebarCollapseBtn && sidebar) {
        sidebarCollapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isDesktopWidth()) return; // the button is hidden below this width anyway
            sidebar.classList.toggle('minimized');
            const isMinimized = sidebar.classList.contains('minimized');
            document.body.classList.toggle('sidebar-is-minimized', isMinimized);
            localStorage.setItem('sidebar-minimized', isMinimized);

            // Re-render icons if needed
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        });
    }

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }

    // 4. Live Table Search Filter
    const searchInputs = document.querySelectorAll('.table-search-input');
    searchInputs.forEach((input) => {
        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const table = input.closest('.glass-panel').querySelector('tbody');
            if (!table) return;

            const rows = table.querySelectorAll('tr');
            rows.forEach((row) => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    });

    // 5. Door Access Simulation (Remote Unlock & Emergency Lock)
    const remoteUnlockBtn = document.getElementById('btnRemoteUnlock');
    const emergencyLockBtn = document.getElementById('btnEmergencyLock');
    const doorCircle = document.getElementById('doorStatusCircle');
    const doorStatusTitle = document.getElementById('doorStatusTitle');
    const doorStatusSub = document.getElementById('doorStatusSub');

    if (remoteUnlockBtn && doorCircle) {
        remoteUnlockBtn.addEventListener('click', () => {
            doorCircle.style.background = 'rgba(34, 197, 94, 0.15)';
            doorCircle.style.borderColor = '#22C55E';
            doorCircle.style.color = '#22C55E';
            doorCircle.innerHTML = '<i data-lucide="lock-keyhole-open" style="width: 48px; height: 48px;"></i>';
            if (doorStatusTitle) doorStatusTitle.textContent = 'DOOR UNLOCKED';
            if (doorStatusSub) doorStatusSub.textContent = 'Access granted for 10 seconds';
            if (window.lucide) window.lucide.createIcons();

            setTimeout(() => {
                doorCircle.style.background = 'var(--color-primary-light)';
                doorCircle.style.borderColor = 'var(--color-primary)';
                doorCircle.style.color = 'var(--color-primary)';
                doorCircle.innerHTML = '<i data-lucide="lock" style="width: 48px; height: 48px;"></i>';
                if (doorStatusTitle) doorStatusTitle.textContent = 'DOOR LOCKED';
                if (doorStatusSub) doorStatusSub.textContent = 'Secure';
                if (window.lucide) window.lucide.createIcons();
            }, 10000);
        });
    }

    if (emergencyLockBtn && doorCircle) {
        emergencyLockBtn.addEventListener('click', () => {
            doorCircle.style.background = 'rgba(239, 68, 68, 0.2)';
            doorCircle.style.borderColor = '#EF4444';
            doorCircle.style.color = '#EF4444';
            doorCircle.innerHTML = '<i data-lucide="shield-alert" style="width: 48px; height: 48px;"></i>';
            if (doorStatusTitle) doorStatusTitle.textContent = 'EMERGENCY LOCKDOWN';
            if (doorStatusSub) doorStatusSub.textContent = 'All access privileges revoked';
            if (window.lucide) window.lucide.createIcons();
        });
    }

    // 6. Metric Cards & Glass Panels Entrance Stagger
    const cards = document.querySelectorAll('.metric-card, .glass-panel');
    cards.forEach((card, idx) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(12px)';
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 60 * idx);
    });

    // 7. Table Horizontal-Scroll Affordance (mobile)
    // Each wide table sits inside a <div class="table-scroll-wrap"> that
    // wraps the actual scrolling <div class="table-responsive">. This
    // watches whether the table genuinely overflows its wrapper and, if
    // so, toggles a couple of CSS hooks (styles-web.css handles the look):
    //   .has-scroll  -- the table doesn't fit; show the fade + hint
    //   .at-end      -- user has scrolled to the last column; hide the fade
    // Table bodies are populated asynchronously from Supabase after page
    // load, so this re-measures whenever a table's rows change, not just once.
    const tableScrollWraps = document.querySelectorAll('.table-scroll-wrap');
    tableScrollWraps.forEach((wrap) => {
        const scroller = wrap.querySelector('.table-responsive');
        if (!scroller) return;

        const update = () => {
            const scrollable = scroller.scrollWidth > scroller.clientWidth + 2;
            wrap.classList.toggle('has-scroll', scrollable);
            const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
            wrap.classList.toggle('at-end', !scrollable || atEnd);
        };

        scroller.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);

        const tbody = scroller.querySelector('tbody');
        if (tbody && window.MutationObserver) {
            new MutationObserver(update).observe(tbody, { childList: true, subtree: true });
        }

        update();
        // Re-check shortly after: icon hydration / async data / font
        // loading can all shift column widths right after first paint.
        setTimeout(update, 400);
        setTimeout(update, 1200);
    });
});

/**
 * login-auth-ui.js
 * Handles smooth 3D flipping animation between Login and Register views,
 * dynamic height adjustments for the flip scene, and UI password toggles.
 */

document.addEventListener('DOMContentLoaded', () => {
    const authCard = document.getElementById('authCard');
    const goToRegisterBtn = document.getElementById('goToRegister');
    const goToLoginBtn = document.getElementById('goToLogin');
    const loginCard = document.querySelector('.login-card');
    const registerCard = document.querySelector('.register-card');
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');

    // Initialize Lucide icons if available
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    /**
     * Dynamically match the height of the .scene container to the active card face
     * so that layout shifts are avoided and background transitions are seamless.
     */
    const syncCardHeight = (isFlipped) => {
        if (!authCard || !loginCard || !registerCard) return;
        
        const targetHeight = isFlipped ? registerCard.offsetHeight : loginCard.offsetHeight;
        if (targetHeight > 0) {
            authCard.style.height = `${targetHeight}px`;
        }
    };

    // Calculate height after layout and fonts load
    window.addEventListener('load', () => syncCardHeight(false));
    window.addEventListener('resize', () => {
        const isFlipped = authCard.classList.contains('flipped');
        syncCardHeight(isFlipped);
    });
    // Initial sync
    setTimeout(() => syncCardHeight(false), 50);

    /**
     * Flip to Register Card
     */
    if (goToRegisterBtn) {
        goToRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            authCard.classList.add('flipped');
            syncCardHeight(true);

            // Focus on first input in register card after brief flip delay
            setTimeout(() => {
                const firstInput = registerCard.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 350);
        });
    }

    /**
     * Flip to Login Card
     */
    if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            authCard.classList.remove('flipped');
            syncCardHeight(false);

            // Focus on first input in login card after brief flip delay
            setTimeout(() => {
                const firstInput = loginCard.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 350);
        });
    }

    /**
     * Password Visibility Toggle
     */
    togglePasswordBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const inputField = document.getElementById(targetId);
            if (!inputField) return;

            const isPassword = inputField.type === 'password';
            inputField.type = isPassword ? 'text' : 'password';

            // Update icon representation
            const eyeIcon = btn.querySelector('.eye-icon, i');
            if (eyeIcon) {
                eyeIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
                if (window.lucide && typeof window.lucide.createIcons === 'function') {
                    window.lucide.createIcons();
                }
            }
        });
    });
});

/**
 * settings-and-profile.js
 * Interactivity scoped to the Settings and Profile pages:
 * - Settings sidebar tab switching
 * - Persisted preference toggle switches (notifications, access control, etc.)
 * - Simulated hardware/backup actions matching the rest of the app's demo interactions
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Settings Tab Switching
    const settingsTabLinks = document.querySelectorAll('.settings-tab-link');
    if (settingsTabLinks.length) {
        settingsTabLinks.forEach((tab) => {
            tab.addEventListener('click', () => {
                const target = tab.getAttribute('data-tab');

                settingsTabLinks.forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');

                document.querySelectorAll('.settings-panel').forEach((panel) => {
                    panel.classList.toggle('active', panel.id === `panel-${target}`);
                });
            });
        });
    }

    // 2. Persisted Toggle Switches (Notifications & Access Control preferences)
    document.querySelectorAll('.switch input[data-pref]').forEach((input) => {
        const key = `eqroom-pref-${input.dataset.pref}`;
        const saved = localStorage.getItem(key);
        if (saved !== null) {
            input.checked = saved === 'true';
        }
        input.addEventListener('change', () => {
            localStorage.setItem(key, input.checked);
        });
    });

    // 3. Simulated "Backup Now" action (Backup & Data panel)
    const btnBackupNow = document.getElementById('btnBackupNow');
    const lastBackupText = document.getElementById('lastBackupText');
    if (btnBackupNow) {
        btnBackupNow.addEventListener('click', () => {
            btnBackupNow.disabled = true;
            const originalHTML = btnBackupNow.innerHTML;
            btnBackupNow.innerHTML = '<i data-lucide="loader-circle" class="spin" style="width: 18px; height: 18px;"></i><span>Backing up...</span>';
            if (window.lucide) window.lucide.createIcons();

            setTimeout(() => {
                btnBackupNow.disabled = false;
                btnBackupNow.innerHTML = originalHTML;
                if (window.lucide) window.lucide.createIcons();
                if (lastBackupText) lastBackupText.textContent = 'Just now';
            }, 1500);
        });
    }

    // 4. Simulated device actions (Recalibrate sensor / Restart device)
    const btnRecalibrate = document.getElementById('btnRecalibrateSensor');
    if (btnRecalibrate) {
        btnRecalibrate.addEventListener('click', () => {
            btnRecalibrate.disabled = true;
            const original = btnRecalibrate.innerHTML;
            btnRecalibrate.innerHTML = '<i data-lucide="loader-circle" class="spin" style="width: 16px; height: 16px;"></i><span>Calibrating...</span>';
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                btnRecalibrate.disabled = false;
                btnRecalibrate.innerHTML = original;
                if (window.lucide) window.lucide.createIcons();
                alert('Biometric sensor recalibrated successfully.');
            }, 1200);
        });
    }

    const btnRestartDevice = document.getElementById('btnRestartDevice');
    if (btnRestartDevice) {
        btnRestartDevice.addEventListener('click', () => {
            if (!confirm('Restart the ESP32 device now? The door lock and sensors will be briefly unavailable.')) return;
            btnRestartDevice.disabled = true;
            const original = btnRestartDevice.innerHTML;
            btnRestartDevice.innerHTML = '<i data-lucide="loader-circle" class="spin" style="width: 16px; height: 16px;"></i><span>Restarting...</span>';
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                btnRestartDevice.disabled = false;
                btnRestartDevice.innerHTML = original;
                if (window.lucide) window.lucide.createIcons();
                alert('ESP32 device restarted and reconnected.');
            }, 2000);
        });
    }

    // 5. Export Data is now a real CSV export wired directly in
    // settings.html's own module script (it reads live Supabase data),
    // so there's no generic placeholder handler here anymore.
});
