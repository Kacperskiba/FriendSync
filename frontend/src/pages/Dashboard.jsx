import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = "http://127.0.0.1:8000/api/events";

export default function Dashboard() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [newEventData, setNewEventData] = useState({ title: '', description: '' });

    // Inicjalizacja z localStorage, żeby nie było pustki przed pobraniem z API
    const [username, setUsername] = useState(localStorage.getItem('username') || 'Użytkownik');

    const navigate = useNavigate();
    const menuRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        // --- POBIERANIE PROFILU ---
        const fetchUserProfile = async () => {
            try {
                const res = await axios.get("http://127.0.0.1:8000/api/users/me", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUsername(res.data.username);
                localStorage.setItem('username', res.data.username);
            } catch (err) {
                console.error("Błąd profilu:", err);
            }
        };

        const fetchEvents = async () => {
            try {
                const response = await axios.get(API_URL, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setEvents(response.data);
            } catch (err) {
                if (err.response?.status === 401) {
                    localStorage.removeItem('token');
                    navigate('/');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
        fetchEvents();
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/');
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            const response = await axios.post(API_URL, newEventData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEvents([...events, response.data]);
            setIsModalOpen(false);
            setNewEventData({ title: '', description: '' });
        } catch (err) {
            alert("Nie udało się utworzyć wydarzenia.");
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans relative">
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full"></div>
            </div>

            <div className="relative z-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16 max-w-6xl mx-auto">
                <div>
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase">
                        Friend <span className="text-green-500 font-black">Sync.</span>
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600 mt-2">Centrum dowodzenia wyjazdami</p>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto">
                    <button onClick={() => setIsModalOpen(true)} className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[10px] tracking-widest px-8 py-4 rounded-2xl transition-all shadow-[0_10px_30px_rgba(34,197,94,0.2)]">
                        + Nowe wydarzenie
                    </button>

                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 bg-[#0f0f0f] border border-white/5 p-2 pr-5 rounded-2xl hover:border-white/20 transition-all shadow-xl">
                            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center font-black italic shadow-lg">
                                {username.substring(0, 1).toUpperCase()}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">
                                {username}
                            </span>
                            <span className={`text-[8px] transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {isUserMenuOpen && (
                            <div className="absolute right-0 mt-4 w-56 bg-[#0f0f0f] border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden py-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-6 py-4 border-b border-white/5 mb-2">
                                    <p className="text-[8px] font-black uppercase text-gray-600 tracking-[0.2em] mb-1">Zalogowany jako</p>
                                    <p className="text-xs font-black italic">{username}</p>
                                </div>
                                <button onClick={() => navigate('/settings')} className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3">⚙️ Ustawienia</button>
                                <button className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3">👤 Profil</button>
                                <div className="h-px bg-white/5 my-2 mx-4"></div>
                                <button onClick={handleLogout} className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-3">🚪 Wyloguj sesję</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reszta Dashboardu (events list, modal) bez zmian... */}
            <div className="relative z-10 max-w-6xl mx-auto">
                {loading && <div className="flex flex-col items-center mt-20 gap-4"><div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>}
                {error && <p className="text-red-500 font-black text-center mt-10 uppercase tracking-widest">{error}</p>}
                {!loading && !error && events.length === 0 && (
                    <div className="text-center mt-20 p-20 bg-[#0f0f0f] rounded-[3rem] border border-white/5 shadow-2xl">
                        <p className="text-gray-500 mb-8 font-black uppercase tracking-widest">Baza jest pusta.</p>
                        <button onClick={() => setIsModalOpen(true)} className="bg-white text-black font-black uppercase text-xs tracking-widest px-10 py-5 rounded-2xl hover:bg-green-500 transition-all">Stwórz pierwsze wydarzenie</button>
                    </div>
                )}
                {!loading && !error && events.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {events.map((event) => (
                            <div key={event.id} onClick={() => navigate(`/events/${event.id}`)} className="group bg-[#0f0f0f] p-8 rounded-[2.5rem] border border-white/5 hover:border-green-500/30 hover:bg-[#151515] transition-all cursor-pointer relative overflow-hidden shadow-2xl">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">🗺️</div>
                                        <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest bg-black px-3 py-1 rounded-full border border-white/5">ID: {event.id}</span>
                                    </div>
                                    <h2 className="text-2xl font-black italic tracking-tighter uppercase mb-3 group-hover:text-green-500 transition-colors">{event.title}</h2>
                                    {event.description && <p className="text-gray-500 text-xs font-bold leading-relaxed line-clamp-2 mb-8">{event.description}</p>}
                                    <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                                        <button onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}/map`); }} className="text-[9px] font-black uppercase tracking-widest bg-black hover:bg-green-600 px-4 py-2 rounded-xl transition-all border border-white/10">Mapa 📍</button>
                                        <span className="text-[9px] text-gray-700 font-black uppercase tracking-widest">{new Date(event.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[100] backdrop-blur-xl">
                    <div className="bg-[#0f0f0f] rounded-[3rem] p-10 w-full max-w-md border border-white/10 shadow-2xl">
                        <h2 className="text-3xl font-black italic tracking-tighter uppercase text-center mb-8">Nowy <span className="text-green-500">Projekt.</span></h2>
                        <form onSubmit={handleCreateEvent} className="space-y-6">
                            <div><label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Tytuł wyjazdu</label>
                            <input type="text" required className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm text-gray-200" placeholder="Np. Berlin 2026" value={newEventData.title} onChange={(e) => setNewEventData({...newEventData, title: e.target.value})}/></div>
                            <div><label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Opis</label>
                            <textarea rows={3} className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm text-gray-200 resize-none" placeholder="Szczegóły..." value={newEventData.description} onChange={(e) => setNewEventData({...newEventData, description: e.target.value})}/></div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-white/5 text-gray-400 font-black uppercase text-[10px] tracking-widest py-5 rounded-2xl transition-all">Anuluj</button>
                                <button type="submit" className="flex-1 bg-green-600 text-white font-black uppercase text-[10px] tracking-widest py-5 rounded-2xl shadow-xl transition-all">Zapisz</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}