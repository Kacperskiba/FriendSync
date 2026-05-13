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

export function applyAppearancePrefs() {
    const accent = prefStorage.get('accent_color') || 'green';
    if (accent === 'green') document.documentElement.removeAttribute('data-accent');
    else document.documentElement.setAttribute('data-accent', accent);

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
