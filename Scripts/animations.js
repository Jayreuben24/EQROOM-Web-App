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

    // Restore saved minimized state
    if (localStorage.getItem('sidebar-minimized') === 'true' && sidebar) {
        sidebar.classList.add('minimized');
        document.body.classList.add('sidebar-is-minimized');
    }

    if (sidebarCollapseBtn && sidebar) {
        sidebarCollapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
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
