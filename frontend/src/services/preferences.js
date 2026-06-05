// Per-user preferences w localStorage.
// Klucze są prefiksowane user_id (wyciągniętym z JWT), więc każdy zalogowany
// użytkownik ma własne ustawienia nawet jeśli korzysta z tej samej przeglądarki.

function getUserIdFromToken() {
    const token = localStorage.getItem('token');
    if (!token) return 'guest';
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return String(decoded.sub || 'guest');
    } catch {
        return 'guest';
    }
}

function prefKey(key) {
    return `pref_${getUserIdFromToken()}_${key}`;
}

export const prefStorage = {
    get(key, fallback = null) {
        const val = localStorage.getItem(prefKey(key));
        return val === null ? fallback : val;
    },
    set(key, value) {
        localStorage.setItem(prefKey(key), value);
    },
    remove(key) {
        localStorage.removeItem(prefKey(key));
    },
};

// Zmienne CSS ustawiane inline tylko dla koloru niestandardowego.
const CUSTOM_ACCENT_VARS = ['--accent', '--accent-dark', '--accent-deep', '--accent-soft'];

// Stosuje akcent: preset (green/blue/purple/orange) albo 'custom' z dowolnym hex.
// Dla presetów zmienne pochodzą z index.css; dla 'custom' wyliczamy je z hex.
export function applyAccent(accent, customHex) {
    const root = document.documentElement;
    // Wyczyść ewentualne inline-zmienne z poprzedniego trybu 'custom',
    // żeby presety (z arkusza) znów zadziałały.
    CUSTOM_ACCENT_VARS.forEach(v => root.style.removeProperty(v));

    if (accent === 'custom') {
        const hex = customHex || prefStorage.get('accent_custom') || '#22c55e';
        root.setAttribute('data-accent', 'custom');
        root.style.setProperty('--accent', hex);
        root.style.setProperty('--accent-dark', `color-mix(in srgb, ${hex}, black 18%)`);
        root.style.setProperty('--accent-deep', `color-mix(in srgb, ${hex}, black 55%)`);
        root.style.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 15%, transparent)`);
    } else if (accent && accent !== 'green') {
        root.setAttribute('data-accent', accent);
    } else {
        root.removeAttribute('data-accent');
    }
}

export function applyAppearancePrefs() {
    applyAccent(prefStorage.get('accent_color') || 'green', prefStorage.get('accent_custom'));

    const reduce = prefStorage.get('reduce_motion') === '1';
    if (reduce) document.documentElement.setAttribute('data-reduce-motion', '');
    else document.documentElement.removeAttribute('data-reduce-motion');
}

// Wywołane po zmianie zalogowanego użytkownika (login/logout/delete account)
// żeby konteksty (currency, appearance) ponownie wczytały dane z scoped storage.
export function notifyUserChanged() {
    applyAppearancePrefs();
    window.dispatchEvent(new Event('user_prefs_changed'));
}
