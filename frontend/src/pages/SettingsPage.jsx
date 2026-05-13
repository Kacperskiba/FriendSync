import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { useWebSocket } from '../components/WebSocketContext';
import { useCurrency, SUPPORTED_CURRENCIES } from '../components/CurrencyContext';
import { prefStorage, notifyUserChanged } from '../services/preferences';
import {
    ArrowLeft, User, Bell, Palette, Globe, Shield, Info, AlertTriangle,
    LogOut, Trash2, Pencil, Check, Volume2, Eye, Sparkles, DollarSign, RefreshCw
} from 'lucide-react';

const ACCENT_OPTIONS = [
    { key: 'green',  label: 'Zielony',     hex: '#22c55e' },
    { key: 'blue',   label: 'Niebieski',   hex: '#3b82f6' },
    { key: 'purple', label: 'Fioletowy',   hex: '#a855f7' },
    { key: 'orange', label: 'Pomarańczowy', hex: '#f97316' },
];

function applyAccent(key) {
    if (key === 'green') document.documentElement.removeAttribute('data-accent');
    else document.documentElement.setAttribute('data-accent', key);
}
function applyReduceMotion(on) {
    if (on) document.documentElement.setAttribute('data-reduce-motion', '');
    else document.documentElement.removeAttribute('data-reduce-motion');
}

function Section({ icon: Icon, title, children }) {
    return (
        <section id={title} className="bg-[#0f0f0f] border border-white/5 rounded-[2rem] p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center accent-soft-bg accent-text">
                    <Icon size={16} />
                </div>
                <h2 className="text-lg md:text-xl font-black italic uppercase tracking-tighter">{title}</h2>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

function Row({ title, hint, children }) {
    return (
        <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-bold text-gray-200">{title}</p>
                {hint && <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-600 mt-1">{hint}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function Toggle({ value, onChange }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!value)}
            className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'accent-bg' : 'bg-white/10'}`}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`}></span>
        </button>
    );
}

export default function SettingsPage() {
    const navigate = useNavigate();
    const { disconnect } = useWebSocket();
    const { currency, setCurrency, refreshRates, loadingRates } = useCurrency();

    const [me, setMe] = useState(null);
    const [accent, setAccent] = useState(prefStorage.get('accent_color') || 'green');
    const [reduceMotion, setReduceMotion] = useState(prefStorage.get('reduce_motion') === '1');
    const [notifSound, setNotifSound] = useState(prefStorage.get('notif_sound') === '1');
    const [notifAutoMark, setNotifAutoMark] = useState(prefStorage.get('notif_automark') === '1');

    const token = localStorage.getItem('token');
    const headers = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        if (!token) { navigate('/'); return; }
        axios.get(`${API_BASE_URL}/api/users/me`, headers)
            .then(r => setMe(r.data))
            .catch(() => {});
    }, []);

    const handleLogout = () => {
        disconnect();
        setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            notifyUserChanged();
            navigate('/');
        }, 300);
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm("Czy NA PEWNO chcesz USUNĄĆ swoje konto? Operacja jest nieodwracalna.")) return;
        if (!window.confirm("Ostatnia szansa. Wszystkie Twoje dane (eventy, wydatki, znajomi) zostaną utracone. Kontynuować?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/users/me`, headers);
            disconnect();
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            notifyUserChanged();
            navigate('/');
        } catch (err) {
            alert(err.response?.data?.detail || "Nie udało się usunąć konta.");
        }
    };

    const handleClearNotifs = async () => {
        if (!window.confirm("Usunąć wszystkie powiadomienia?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/notifications`, headers);
            alert("Powiadomienia wyczyszczone.");
        } catch {
            alert("Nie udało się wyczyścić powiadomień.");
        }
    };

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans p-4 md:p-10">
            <div className="absolute top-0 left-0 w-1/3 h-1/3 bg-green-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="max-w-4xl mx-auto relative">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="mb-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 hover:text-green-500 transition-colors flex items-center gap-2"
                >
                    <ArrowLeft size={14} /> Powrót do Dashboardu
                </button>

                <header className="mb-10">
                    <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter">
                        Ustawienia<span className="accent-text">.</span>
                    </h1>
                    <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-gray-600 mt-2">
                        Spersonalizuj swój FriendSync
                    </p>
                </header>

                <div className="space-y-6">

                    {/* KONTO */}
                    <Section icon={User} title="Konto">
                        {me && (
                            <div className="flex items-center gap-4 bg-black/40 rounded-2xl p-4 border border-white/5">
                                {me.profile_image ? (
                                    <img src={`${API_BASE_URL}/${me.profile_image}`} alt={me.username}
                                         className="w-14 h-14 rounded-xl object-cover border border-white/10" />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl accent-bg flex items-center justify-center text-white font-black italic text-xl">
                                        {me.username?.[0]?.toUpperCase() || '?'}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-black italic text-lg tracking-tighter">{me.username}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate">{me.email}</p>
                                </div>
                            </div>
                        )}
                        <Row title="Edytuj profil" hint="Zmień nick, avatar, bio, email, hasło">
                            <button onClick={() => navigate('/edit-profile')}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Pencil size={12} /> Otwórz
                            </button>
                        </Row>
                        <Row title="Wyloguj się" hint="Zamknij sesję w tej przeglądarce">
                            <button onClick={handleLogout}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <LogOut size={12} /> Wyloguj
                            </button>
                        </Row>
                    </Section>

                    {/* POWIADOMIENIA */}
                    <Section icon={Bell} title="Powiadomienia">
                        <Row title="Dźwięk powiadomień"
                             hint="Krótki sygnał dźwiękowy przy nowych zaproszeniach">
                            <Toggle value={notifSound} onChange={(v) => {
                                setNotifSound(v);
                                prefStorage.set('notif_sound', v ? '1' : '0');
                            }} />
                        </Row>
                        <Row title="Automatyczne oznaczanie jako przeczytane"
                             hint="Przy otwieraniu modala powiadomień">
                            <Toggle value={notifAutoMark} onChange={(v) => {
                                setNotifAutoMark(v);
                                prefStorage.set('notif_automark', v ? '1' : '0');
                            }} />
                        </Row>
                        <Row title="Wyczyść historię powiadomień"
                             hint="Trwale usuwa wszystkie powiadomienia z konta">
                            <button onClick={handleClearNotifs}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Trash2 size={12} /> Wyczyść
                            </button>
                        </Row>
                    </Section>

                    {/* WYGLĄD */}
                    <Section icon={Palette} title="Wygląd">
                        <Row title="Kolor akcentu"
                             hint="Zmiana koloru wyróżników i kropek statusu">
                            <div className="flex gap-2">
                                {ACCENT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.key}
                                        title={opt.label}
                                        onClick={() => {
                                            setAccent(opt.key);
                                            prefStorage.set('accent_color', opt.key);
                                            applyAccent(opt.key);
                                        }}
                                        className={`w-9 h-9 rounded-full transition-all border-2 ${accent === opt.key ? 'border-white scale-110' : 'border-white/10'}`}
                                        style={{ backgroundColor: opt.hex }}
                                    />
                                ))}
                            </div>
                        </Row>
                        <Row title="Redukcja animacji"
                             hint="Wyłącza przejścia i efekty (lepsze dla wrażliwych na ruch)">
                            <Toggle value={reduceMotion} onChange={(v) => {
                                setReduceMotion(v);
                                prefStorage.set('reduce_motion', v ? '1' : '0');
                                applyReduceMotion(v);
                            }} />
                        </Row>
                    </Section>

                    {/* WALUTA */}
                    <Section icon={DollarSign} title="Waluta i format">
                        <Row title="Wyświetlana waluta"
                             hint="Kursy z NBP (przeliczane z PLN, dane w bazie pozostają w PLN)">
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-green-500/50"
                            >
                                {SUPPORTED_CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.label}</option>
                                ))}
                            </select>
                        </Row>
                        <Row title="Odśwież kursy walut"
                             hint="Pobiera najnowsze dane z NBP">
                            <button onClick={refreshRates} disabled={loadingRates}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                                <RefreshCw size={12} className={loadingRates ? 'animate-spin' : ''} /> Odśwież
                            </button>
                        </Row>
                    </Section>

                    {/* PRYWATNOŚĆ */}
                    <Section icon={Shield} title="Prywatność i bezpieczeństwo">
                        <Row title="Strefa czasowa" hint="Automatycznie wykryta z przeglądarki">
                            <span className="text-xs font-black text-gray-300 px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                                {timezone}
                            </span>
                        </Row>
                        <Row title="Zmień hasło" hint="W edytorze profilu, sekcja Bezpieczeństwo">
                            <button onClick={() => navigate('/edit-profile')}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Pencil size={12} /> Otwórz
                            </button>
                        </Row>
                        {me?.last_active && (
                            <Row title="Ostatnia aktywność">
                                <span className="text-xs font-black text-gray-300 px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                                    {new Date(me.last_active).toLocaleString()}
                                </span>
                            </Row>
                        )}
                    </Section>

                    {/* O APLIKACJI */}
                    <Section icon={Info} title="O aplikacji">
                        <Row title="FriendSync" hint="Planowanie wyjazdów i rozliczeń ze znajomymi">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-3 py-2">
                                Wersja 1.0.0
                            </span>
                        </Row>
                    </Section>

                    {/* DANGER ZONE */}
                    <section className="bg-[#0f0f0f] border border-red-500/20 rounded-[2rem] p-6 md:p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-red-500/10">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500">
                                <AlertTriangle size={16} />
                            </div>
                            <h2 className="text-lg md:text-xl font-black italic uppercase tracking-tighter text-red-500">
                                Niebezpieczna strefa
                            </h2>
                        </div>
                        <Row title="Usuń konto"
                             hint="Trwale usuwa konto, znajomych, zaproszenia i Twoje wydatki">
                            <button onClick={handleDeleteAccount}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Trash2 size={12} /> Usuń konto
                            </button>
                        </Row>
                    </section>

                </div>
            </div>
        </div>
    );
}
