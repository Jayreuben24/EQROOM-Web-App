/**
 * rfid-alert-notifications.js
 * ============================================================
 * Shared, drop-in popup notifications for unauthorized RFID gate scans.
 *
 * Include this on any admin page (after the page already loads
 * supabase-config.js) and it:
 *   1. Confirms the signed-in user is an admin (students never see these).
 *   2. Subscribes to Supabase Realtime INSERTs on `rfid_alerts` -- the
 *      same table check_rfid_scan() already writes to server-side
 *      whenever a scan comes back unauthorized (unknown tag, or a tag
 *      whose item wasn't checked out).
 *   3. Pops a toast in the corner of the screen with what was scanned,
 *      plays a short alert tone, and lets the admin Acknowledge it
 *      (flips rfid_alerts.status to 'acknowledged') or just dismiss it.
 *
 * This only reacts to NEW alerts fired while the page is open -- it
 * doesn't show a backlog of old ones on page load, since the point is a
 * live "something just happened" notification, not an alerts inbox.
 *
 * Usage: <script type="module" src="Scripts/rfid-alert-notifications.js" defer></script>
 */
import { supabase } from './supabase-config.js';

const TOAST_AUTO_DISMISS_MS = 12000;
const MAX_VISIBLE_TOASTS = 5;

function injectStyles() {
    if (document.getElementById('rfidAlertStyles')) return;
    const style = document.createElement('style');
    style.id = 'rfidAlertStyles';
    style.textContent = `
        #rfidAlertToastContainer {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: min(360px, calc(100vw - 32px));
            pointer-events: none;
        }
        .rfid-toast {
            pointer-events: auto;
            display: flex;
            gap: 12px;
            align-items: flex-start;
            padding: 14px 14px 14px 16px;
            border-radius: 12px;
            border-left: 4px solid var(--color-danger, #EF4444);
            background: var(--color-surface, #1F2430);
            color: var(--color-text-primary, #F3F4F6);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(10px);
            animation: rfidToastIn 0.25s ease-out;
        }
        :root:not([data-theme="dark"]) .rfid-toast {
            background: #FFFFFF;
            color: #111827;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        }
        @keyframes rfidToastIn {
            from { opacity: 0; transform: translateX(24px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .rfid-toast-icon {
            flex-shrink: 0;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.15);
            color: var(--color-danger, #EF4444);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .rfid-toast-body { flex: 1; min-width: 0; }
        .rfid-toast-body strong { display: block; font-size: 0.88rem; margin-bottom: 2px; }
        .rfid-toast-body p { margin: 0 0 4px; font-size: 0.82rem; line-height: 1.4; opacity: 0.9; }
        .rfid-toast-time { font-size: 0.72rem; opacity: 0.6; }
        .rfid-toast-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
        .rfid-toast-close {
            background: none; border: none; cursor: pointer; font-size: 1.1rem;
            line-height: 1; color: inherit; opacity: 0.6; padding: 0;
        }
        .rfid-toast-close:hover { opacity: 1; }
        .rfid-toast-ack {
            font-size: 0.72rem; font-weight: 600; padding: 4px 10px;
            border-radius: 999px; border: 1px solid var(--color-danger, #EF4444);
            background: transparent; color: var(--color-danger, #EF4444); cursor: pointer;
            white-space: nowrap;
        }
        .rfid-toast-ack:hover { background: rgba(239, 68, 68, 0.1); }
        .rfid-toast-ack:disabled { opacity: 0.5; cursor: default; }
    `;
    document.head.appendChild(style);
}

function getContainer() {
    let container = document.getElementById('rfidAlertToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'rfidAlertToastContainer';
        document.body.appendChild(container);
    }
    return container;
}

// Short two-tone alert beep via Web Audio -- no audio file needed, so this
// works dropped into any page with zero extra assets.
function playAlertTone() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        [880, 660].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.18);
            osc.stop(ctx.currentTime + i * 0.18 + 0.2);
        });
        setTimeout(() => ctx.close(), 600);
    } catch (e) {
        // Autoplay can be blocked until the admin interacts with the page --
        // the visual toast still shows either way, so this is non-fatal.
    }
}

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
}

async function acknowledgeAlert(alertId, buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = 'Acknowledging...';
    const { error } = await supabase.from('rfid_alerts').update({ status: 'acknowledged' }).eq('id', alertId);
    if (error) {
        buttonEl.disabled = false;
        buttonEl.textContent = 'Acknowledge';
        alert('Could not acknowledge alert: ' + error.message);
        return;
    }
    buttonEl.closest('.rfid-toast')?.remove();
}

async function showAlertToast(alertRow) {
    const container = getContainer();

    // Cap how many stack up on screen at once -- drop the oldest.
    while (container.children.length >= MAX_VISIBLE_TOASTS) {
        container.firstElementChild?.remove();
    }

    let message;
    if (alertRow.item_id) {
        const { data: item } = await supabase.from('items').select('item_name').eq('id', alertRow.item_id).single();
        const itemName = item?.item_name || `item #${alertRow.item_id}`;
        message = `"${itemName}" passed the gate without being checked out.`;
    } else {
        message = `An unregistered tag (${alertRow.rfid_tag}) was scanned at the gate.`;
    }

    const toast = document.createElement('div');
    toast.className = 'rfid-toast';
    toast.innerHTML = `
        <div class="rfid-toast-icon"><i data-lucide="alert-triangle" style="width:18px;height:18px;"></i></div>
        <div class="rfid-toast-body">
            <strong>Unauthorized RFID Scan</strong>
            <p>${message}</p>
            <span class="rfid-toast-time">${formatTime(alertRow.detected_at)}</span>
        </div>
        <div class="rfid-toast-actions">
            <button class="rfid-toast-close" aria-label="Dismiss">&times;</button>
            <button class="rfid-toast-ack">Acknowledge</button>
        </div>
    `;

    toast.querySelector('.rfid-toast-close')?.addEventListener('click', () => toast.remove());
    toast.querySelector('.rfid-toast-ack')?.addEventListener('click', (e) => acknowledgeAlert(alertRow.id, e.currentTarget));

    container.appendChild(toast);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    playAlertTone();

    setTimeout(() => {
        if (toast.isConnected) toast.remove();
    }, TOAST_AUTO_DISMISS_MS);
}

async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // the page's own auth guard handles signed-out visitors

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (error || !profile || profile.role !== 'admin') return; // students don't get gate alerts

    injectStyles();

    supabase
        .channel('rfid-alerts-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rfid_alerts' }, (payload) => {
            showAlertToast(payload.new);
        })
        .subscribe();
}

init();
