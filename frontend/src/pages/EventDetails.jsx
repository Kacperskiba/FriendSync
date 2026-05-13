import React, {useState, useEffect, useRef} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import axios from 'axios';
import EventMapComponent from '../components/EventMapComponent';
import { useWebSocket } from '../components/WebSocketContext';

import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { pl } from "date-fns/locale";
registerLocale("pl", pl);
import {
    Bell, Map, CalendarDays, Trash2, Pencil, MapPin,
    MessageSquare, Wallet, LogOut, Settings, User,
    Plus, ChevronDown, X, Check, Send, UserMinus, Crown,
    ArrowLeft
} from 'lucide-react';
import { API_BASE_URL } from '../services/api';
const API_URL = `${API_BASE_URL}/api/events`;
const FRIENDS_API = `${API_BASE_URL}/api/friends`;
const BASE_URL = API_BASE_URL;

export default function EventDetails() {
    const {id} = useParams();
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);

    const [event, setEvent] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    const [newMessage, setNewMessage] = useState('');
    const [currentUserId, setCurrentUserId] = useState(null);

    const [isAddingSubEvent, setIsAddingSubEvent] = useState(false);
    const [editingSubEventId, setEditingSubEventId] = useState(null);
    const [newSubEvent, setNewSubEvent] = useState({ title: '', description: '', start_time: null });

    const [isEditingEventInfo, setIsEditingEventInfo] = useState(false);
    const [editEventData, setEditEventData] = useState({ title: '', description: '', event_date: null });

    const { addListener } = useWebSocket();

    const fetchEventData = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(API_URL, { headers: {Authorization: `Bearer ${token}`} });
            const currentEvent = res.data.find(e => e.id === parseInt(id));
            if (currentEvent) setEvent(currentEvent);
            else navigate('/dashboard');
        } catch (err) { navigate('/dashboard'); }
    };

    const fetchParticipants = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/${id}/participants`, { headers: {Authorization: `Bearer ${token}`} });
            setParticipants(res.data);
        } catch (err) { console.error("Błąd uczestników:", err); }
    };
    const handleRemoveParticipant = async (userId) => {
        const isSelf = userId === currentUserId;
        const amIOrganizer = event.creator_id === currentUserId || event.owner_id === currentUserId;

        let msg = "Czy na pewno chcesz wyrzucić tę osobę z ekipy?";
        if (isSelf) {
            msg = amIOrganizer
                ? "Jesteś organizatorem! Jeśli opuścisz wydarzenie, uprawnienia przejdą na losową osobę z ekipy. Czy na pewno chcesz uciec?"
                : "Czy na pewno chcesz opuścić to wydarzenie?";
        }

        if (!window.confirm(msg)) return;

        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_URL}/${id}/participants/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (isSelf) navigate('/dashboard');
        } catch (err) {
            alert(err.response?.data?.detail || "Błąd podczas usuwania z ekipy.");
        }
    };

    const handleTransferOwnership = async (newOwnerId) => {
        if (!window.confirm("Czy na pewno chcesz oddać dowodzenie tej osobie? Staniesz się zwykłym uczestnikiem.")) return;
        const token = localStorage.getItem('token');
        try {
            await axios.put(`${API_URL}/${id}/transfer-ownership/${newOwnerId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            alert(err.response?.data?.detail || "Błąd podczas przekazywania uprawnień.");
        }
    };
    const fetchMessages = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/${id}/messages`, { headers: {Authorization: `Bearer ${token}`} });
            setMessages(res.data);
        } catch (err) {}
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                const token = localStorage.getItem('token');
                try {
                    const res = await axios.get(`${FRIENDS_API}/search-users?q=${searchQuery}`, { headers: {Authorization: `Bearer ${token}`} });
                    setSuggestions(res.data);
                } catch (err) {}
            } else setSuggestions([]);
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.get(`${BASE_URL}/api/users/me`, { headers: {Authorization: `Bearer ${token}`} })
            .then(res => setCurrentUserId(res.data.id)).catch(err => console.error(err));
        }
        fetchEventData();
        fetchParticipants();
    }, [id]);

    useEffect(() => { if (isChatOpen) fetchMessages(); }, [isChatOpen]);

    useEffect(() => {
        const removeUpd = addListener("event_updated", (msg) => {
            if (msg.event_id !== parseInt(id)) return;
            fetchEventData();
            fetchParticipants();
            if (isChatOpen) fetchMessages();
        });
        const removeDel = addListener("event_deleted", (msg) => {
            if (msg.event_id !== parseInt(id)) return;
            navigate('/dashboard');
        });
        return () => { removeUpd(); removeDel(); };
    }, [id, isChatOpen, addListener, navigate]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior: "smooth"}); }, [messages]);

    const handleInvite = async (e, directIdentifier = null) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const targetIdentifier = directIdentifier || searchQuery;
        if (!targetIdentifier.trim()) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/${id}/invite`, {email: targetIdentifier}, { headers: {Authorization: `Bearer ${token}`} });
            setSearchQuery(''); setSuggestions([]); fetchParticipants();
        } catch (err) { alert(err.response?.data?.detail || "Błąd zaproszenia"); }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/${id}/messages`, {content: newMessage}, { headers: {Authorization: `Bearer ${token}`} });
            setNewMessage(''); fetchMessages();
        } catch (err) {}
    };

    const handleSaveSubEvent = async (e) => {
        e.preventDefault();
        if (!newSubEvent.title.trim()) return;
        const token = localStorage.getItem('token');
        try {
            const payload = {
                title: newSubEvent.title,
                description: newSubEvent.description || null,
                start_time: newSubEvent.start_time ? new Date(newSubEvent.start_time).toISOString() : null
            };

            if (editingSubEventId) {
                await axios.put(`${API_URL}/sub-events/${editingSubEventId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                await axios.post(`${API_URL}/${id}/sub-events`, payload, { headers: { Authorization: `Bearer ${token}` } });
            }

            setNewSubEvent({ title: '', description: '', start_time: null });
            setEditingSubEventId(null);
            setIsAddingSubEvent(false);
            fetchEventData();
        } catch (err) { alert("Błąd zapisywania punktu programu."); }
    };

    const handleDeleteSubEvent = async (subEventId) => {
        if (!window.confirm("Usunąć ten punkt planu?")) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_URL}/sub-events/${subEventId}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchEventData();
        } catch (err) { alert("Błąd usuwania punktu."); }
    };

    const handleUpdateEventInfo = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            const payload = {
                title: editEventData.title,
                description: editEventData.description || null,
                event_date: editEventData.event_date ? new Date(editEventData.event_date).toISOString() : null
            };
            await axios.put(`${API_URL}/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            setIsEditingEventInfo(false);
            fetchEventData();
        } catch (err) { alert("Błąd aktualizacji wydarzenia."); }
    };

    const openEditEventInfo = () => {
        setEditEventData({
            title: event.title,
            description: event.description || '',
            event_date: event.event_date ? new Date(event.event_date) : null
        });
        setIsEditingEventInfo(true);
    };

    const renderAvatar = (imageUrl, name, sizeClasses = "w-10 h-10") => {
        if (imageUrl) {
            return (
                <img
                    src={`${BASE_URL}/${imageUrl}`}
                    alt={name}
                    className={`${sizeClasses} rounded-xl object-cover border border-white/10`}
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "";
                    }}
                />
            );
        }
        return (
            <div
                className={`${sizeClasses} bg-green-600 rounded-xl flex items-center justify-center text-xs font-black italic shadow-lg shadow-green-900/40 uppercase text-white shrink-0`}>
                {name ? name.substring(0, 2) : '?'}
            </div>
        );
    };

    if (!event) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-[0.3em]">Wczytywanie...</div>;

    const sortedSubEvents = event.sub_events ? [...event.sub_events].sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return new Date(a.start_time) - new Date(b.start_time);
    }) : [];

    const isOwner = event.creator_id === currentUserId || event.owner_id === currentUserId;

    return (
        // Zmniejszone marginesy (p-4 sm:p-6 md:p-8 zamiast p-12)
        <div className="min-h-screen bg-[#050505] text-white font-sans p-4 sm:p-6 md:p-8 relative">
            <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-green-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            {/* NAWIGACJA GÓRNA - max-w-[1600px] */}
            <div className="max-w-[1600px] w-full mx-auto flex flex-col md:flex-row items-start md:items-center justify-between mb-8 md:mb-12 gap-6 relative z-10">
                <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-white flex items-center gap-2 font-black uppercase text-[10px] tracking-[0.3em] transition-all">
                    <ArrowLeft size={14} /> Powrót
                </button>
                <div className="flex gap-4 w-full md:w-auto">
                    <button onClick={() => setIsMapOpen(true)} className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 transition-all shadow-lg"><MapPin size={16} /></button>
                    <button onClick={() => setIsChatOpen(true)} className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 transition-all shadow-lg"><MessageSquare size={16} /></button>
                    <button onClick={() => navigate(`/events/${id}/finance`)} className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-green-900/20 transition-all"><Wallet size={16} /></button>
                </div>
            </div>

            {/* GŁÓWNY GRID ZAMIENIONY NA FLEX (max-w-[1600px]) */}
            <div className="max-w-[1600px] w-full mx-auto flex flex-col xl:flex-row gap-8 lg:gap-10 relative z-10">

                {/* LEWA KOLUMNA: INFO + HARMONOGRAM */}
                <div className="flex-1 flex flex-col gap-8 min-w-0">

                    {/* INFO Z EDYCJĄ */}
                    <div className={`bg-[#0f0f0f] rounded-[3rem] p-8 md:p-10 border border-white/5 shadow-2xl relative group ${isEditingEventInfo ? '' : 'overflow-hidden'}`}>
                        <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                            <span className="text-[100px] md:text-[120px] font-black italic uppercase leading-none">INFO</span>
                        </div>

                        {isOwner && !isEditingEventInfo && (
                            <button onClick={openEditEventInfo} className="absolute top-6 right-6 md:top-8 md:right-8 bg-black/50 p-3 rounded-xl border border-white/5 hover:text-green-500 transition-colors z-20 shadow-lg">
                                <Pencil size={18} />
                            </button>
                        )}

                        {isEditingEventInfo ? (
                            <form onSubmit={handleUpdateEventInfo} className="relative z-10 space-y-4">
                                <input
                                    type="text" required
                                    className="w-full bg-[#050505] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 text-2xl md:text-3xl font-black italic uppercase text-white shadow-inner"
                                    value={editEventData.title}
                                    onChange={e => setEditEventData({...editEventData, title: e.target.value})}
                                />

                                <div className="relative w-full z-50">
                                    <DatePicker
                                        selected={editEventData.event_date}
                                        onChange={(date) => setEditEventData({...editEventData, event_date: date})}
                                        showTimeSelect timeFormat="HH:mm" timeIntervals={15} timeCaption="Czas" dateFormat="d MMMM yyyy, HH:mm" locale="pl"
                                        placeholderText="Wybierz nową datę z kalendarza..."
                                        className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 text-xs font-bold text-gray-200 cursor-pointer"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-xs"><CalendarDays size={24} /></span>
                                </div>

                                <textarea
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 text-xs font-bold text-gray-200 resize-none custom-scrollbar"
                                    rows={4} placeholder="Zmień opis..."
                                    value={editEventData.description}
                                    onChange={e => setEditEventData({...editEventData, description: e.target.value})}
                                />

                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[10px] py-4 rounded-xl transition-all shadow-lg shadow-green-900/20">Zapisz Zmiany</button>
                                    <button type="button" onClick={() => setIsEditingEventInfo(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] py-4 rounded-xl transition-all">Anuluj</button>
                                </div>
                            </form>
                        ) : (
                            <div className="relative z-10">
                                <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-6 leading-none pr-12">
                                    {event.title}<span className="text-green-500">.</span>
                                </h1>
                                <p className="text-gray-500 text-sm md:text-lg font-bold leading-relaxed mb-10 max-w-xl">
                                    {event.description || "Brak opisu wydarzenia."}
                                </p>

                                <div className="pt-8 border-t border-white/5 flex flex-wrap items-center gap-4 relative z-10">
                                    {event.event_date && (
                                        <div className="px-4 py-2 bg-black rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-green-500 shadow-md">
                                            <CalendarDays size={24} /> {new Date(event.event_date).toLocaleString('pl-PL', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                                        </div>
                                    )}
                                    <div className="px-4 py-2 bg-black rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                        Status: Aktywne
                                    </div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-700">
                                        Utworzono: {new Date(event.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* HARMONOGRAM (TIMELINE) */}
                    <div className="bg-[#0f0f0f] rounded-[3rem] p-8 md:p-10 border border-white/5 shadow-2xl relative flex flex-col h-[600px]">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 shrink-0 gap-4">
                            <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter leading-none">
                                Plan <span className="text-green-500">Wyjazdu.</span>
                            </h2>
                            <button
                                onClick={() => {
                                    setIsAddingSubEvent(!isAddingSubEvent);
                                    if(isAddingSubEvent) {
                                        setEditingSubEventId(null);
                                        setNewSubEvent({title: '', description: '', start_time: null});
                                    }
                                }}
                                className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shrink-0"
                            >
                                {isAddingSubEvent ? 'Anuluj' : '+ Dodaj punkt'}
                            </button>
                        </div>

                        {isAddingSubEvent && (
                            <form onSubmit={handleSaveSubEvent} className="bg-black border border-white/5 rounded-2xl p-6 mb-8 shrink-0 animate-in fade-in slide-in-from-top-4 z-20">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-[8px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Tytuł / Aktywność</label>
                                        <input type="text" required value={newSubEvent.title} onChange={e => setNewSubEvent({...newSubEvent, title: e.target.value})} placeholder="Np. Śniadanie w górach" className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-5 py-3 outline-none focus:border-green-500/50 text-xs font-bold text-gray-200" />
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Data i Godzina</label>
                                        <div className="relative w-full">
                                            <DatePicker
                                                selected={newSubEvent.start_time}
                                                onChange={(date) => setNewSubEvent({...newSubEvent, start_time: date})}
                                                showTimeSelect timeFormat="HH:mm" timeIntervals={15} timeCaption="Czas" dateFormat="d MMMM yyyy, HH:mm" locale="pl"
                                                placeholderText="Wybierz z kalendarza..."
                                                className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-5 py-3 outline-none focus:border-green-500/50 text-xs font-bold text-gray-200 cursor-pointer"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-xs z-10"><CalendarDays size={24} /></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Notatki (opcjonalnie)</label>
                                    <textarea rows={2} value={newSubEvent.description} onChange={e => setNewSubEvent({...newSubEvent, description: e.target.value})} placeholder="Szczegóły..." className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-5 py-3 outline-none focus:border-green-500/50 text-xs font-bold text-gray-200 resize-none custom-scrollbar" />
                                </div>
                                <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[10px] py-4 rounded-xl transition-all shadow-lg shadow-green-900/20">
                                    {editingSubEventId ? 'Zapisz zmiany' : 'Dodaj do planu'}
                                </button>
                            </form>
                        )}

                        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                            {sortedSubEvents.length === 0 ? (
                                <p className="text-gray-600 text-center font-black uppercase text-[10px] tracking-[0.3em] py-8">Jeszcze nic nie zaplanowano.</p>
                            ) : (
                                <div className="relative border-l-2 border-white/10 ml-4 space-y-8 pb-4 mt-2">
                                    {sortedSubEvents.map((subEvent, index) => (
                                        <div key={subEvent.id} className="relative pl-8 group animate-in fade-in slide-in-from-left-4">
                                            <div className="absolute -left-[9px] top-1 w-4 h-4 bg-black border-2 border-green-500 rounded-full group-hover:scale-125 group-hover:shadow-[0_0_15px_rgba(34,197,94,0.6)] transition-all"></div>

                                            <div className="bg-black/50 border border-white/5 rounded-2xl p-5 hover:bg-white/5 transition-colors relative">
                                                <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <button
                                                        onClick={() => {
                                                            setEditingSubEventId(subEvent.id);
                                                            setNewSubEvent({
                                                                title: subEvent.title,
                                                                description: subEvent.description || '',
                                                                start_time: subEvent.start_time ? new Date(subEvent.start_time) : null
                                                            });
                                                            setIsAddingSubEvent(true);
                                                        }}
                                                        className="p-2 bg-black rounded-lg border border-white/5 hover:text-green-500 transition-colors shadow-lg"
                                                    ><Pencil size={18} /></button>
                                                    <button onClick={() => handleDeleteSubEvent(subEvent.id)} className="p-2 bg-black rounded-lg border border-white/5 hover:text-red-500 transition-colors shadow-lg"><Trash2 size={18} /></button>
                                                </div>

                                                <div className="text-[10px] font-black text-green-500 tracking-widest uppercase mb-1">
                                                    {subEvent.start_time ? new Date(subEvent.start_time).toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Do ustalenia'}
                                                </div>
                                                <h4 className="text-xl font-bold italic uppercase tracking-tight text-white mb-2 pr-16">{subEvent.title}</h4>
                                                {subEvent.description && (
                                                    <p className="text-xs font-medium text-gray-400 leading-relaxed">{subEvent.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
        {/* PRAWA KOLUMNA: EKIPA + MAPA WBUDOWANA */}
                {/* Szersza kolumna: 500px, a na super-dużych ekranach 550px */}
                <div className="w-full xl:w-[500px] 2xl:w-[550px] shrink-0 flex flex-col gap-8 h-fit">

                    {/* KARTA EKIPY */}
                    <div className="bg-[#0f0f0f] rounded-[3rem] p-8 border border-white/5 shadow-2xl">
                        <h3 className="font-black text-gray-500 uppercase tracking-[0.3em] text-[10px] mb-6">Ekipa</h3>

                        <div className="relative mb-8">
                            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2 relative z-20">
                                <input
                                    type="text" required placeholder="Nick lub e-mail..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 w-full bg-black border border-white/5 rounded-2xl px-5 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-xs text-gray-200"
                                />
                                <button type="submit" className="bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[10px] py-4 px-6 rounded-2xl transition-all shadow-xl shadow-green-900/20">
                                    Zaproś
                                </button>
                            </form>
                            {suggestions.length > 0 && (
                                <div className="absolute top-[105%] left-0 right-0 bg-[#151515] border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden">
                                    {suggestions.map(user => (
                                        <div key={user.id} onMouseDown={(e) => { e.preventDefault(); handleInvite(null, user.email); }} className="p-4 border-b border-white/5 hover:bg-white/5 cursor-pointer flex items-center gap-3">
                                            {renderAvatar(user.profile_image, user.username, "w-8 h-8")}
                                            <div>
                                                <p className="font-bold text-[11px] text-gray-200">{user.username}</p>
                                                <p className="text-[8px] font-black uppercase text-gray-600">{user.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 custom-scrollbar max-h-[40vh] overflow-y-auto pr-2">
                            {participants.map((user) => {
                            const isOrganizer = user.id === event.owner_id || user.id === event.creator_id;
                            const isMe = user.id === currentUserId;
                            const amIOrganizer = event.creator_id === currentUserId || event.owner_id === currentUserId;

                            const canRemoveOther = amIOrganizer && !isOrganizer;
                            const canLeave = isMe; // Teraz każdy organizator też może kliknąć by wyjść
                            const canTransfer = amIOrganizer && !isOrganizer && !isMe; // Szef oddaje władzę innemu

                            return (
                                <div key={user.id} className="flex items-center justify-between bg-black p-4 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
                                    <div className="flex items-center gap-4 min-w-0">
                                        {renderAvatar(user.profile_image, user.username)}
                                        <div>
                                            <span className="block text-[11px] font-black uppercase tracking-tight text-white italic truncate">
                                                {user.username} {isMe && <span className="text-gray-600 font-medium ml-1">(Ty)</span>}
                                            </span>
                                            <span className={`block text-[8px] font-black uppercase tracking-widest ${isOrganizer ? 'text-yellow-500' : 'text-gray-600'}`}>
                                                {isOrganizer ? "Organizator"  : "Uczestnik"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* PRZYCISK: Transfer Korony */}
                                        {canTransfer && (
                                            <button
                                                onClick={() => handleTransferOwnership(user.id)}
                                                className="p-2 text-gray-500 hover:text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition-all"
                                                title="Przekaż organizatora"
                                            >
                                                <Crown size={16} />
                                            </button>
                                        )}

                                        {/* PRZYCISK: Wyrzucanie innych */}
                                        {canRemoveOther && (
                                            <button
                                                onClick={() => handleRemoveParticipant(user.id)}
                                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                title="Wyrzuć z ekipy"
                                            >
                                                <UserMinus size={16} />
                                            </button>
                                        )}


                                        {canLeave && (
                                            <button
                                                onClick={() => handleRemoveParticipant(user.id)}
                                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                title="Opuść wydarzenie"
                                            >
                                                <LogOut size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                            </div>
                    </div>

                    {/* KARTA WBUDOWANEJ MAPY - Wyszta wysokość 500px */}
                    <div className="bg-[#0f0f0f] rounded-[3rem] p-8 border border-white/5 shadow-2xl flex flex-col h-[500px] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                            <span className="text-[80px] font-black italic uppercase leading-none">MAPA</span>
                        </div>
                        <h3 className="font-black text-gray-500 uppercase tracking-[0.3em] text-[10px] mb-6 relative z-10">Lokalizacje</h3>
                        <div className="flex-1 w-full rounded-2xl overflow-hidden border border-white/10 relative z-10 shadow-inner">
                            <EventMapComponent eventId={id}/>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MODALE --- */}

            {/* MODAL MAPY (Pełny ekran z przycisku na górze) */}
            {isMapOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsMapOpen(false)}></div>
                    <div className="relative w-full max-w-6xl h-full max-h-[85vh] bg-[#0f0f0f] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col">
                        <div className="p-6 bg-black border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-black uppercase text-xs tracking-[0.3em] text-green-500 italic">Pełna Mapa Wydarzenia</h3>
                            <button onClick={() => setIsMapOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full text-gray-500 hover:text-white transition-all"><X size={16} /></button>
                        </div>
                        <div className="flex-1 relative">
                            <EventMapComponent eventId={id}/>
                        </div>
                    </div>
                </div>
            )}

            {/* CZAT */}
            {isChatOpen && (
                <div className="fixed bottom-8 right-8 w-full max-w-md h-[600px] bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-10">
                    <div className="bg-black p-6 flex justify-between items-center border-b border-white/5">
                        <h3 className="font-black uppercase text-[10px] tracking-[0.3em] text-green-500 italic">Czat wydarzenia</h3>
                        <button onClick={() => setIsChatOpen(false)} className="text-gray-500 hover:text-white transition-all"><X size={16} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0a0a0a] flex flex-col custom-scrollbar">
                        {messages.map((msg) => {
                            const isMe = msg.author.id === currentUserId;
                            const messageTime = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : "";

                            return (
                                <div key={msg.id} className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'self-end flex-row-reverse' : 'self-start flex-row'}`}>
                                    {!isMe && (
                                        <div className="mb-6">
                                            {renderAvatar(msg.author.profile_image, msg.author.username, "w-7 h-7 text-[8px] rounded-full")}
                                        </div>
                                    )}

                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className={`px-4 py-2.5 rounded-[1.5rem] ${isMe ? 'bg-green-600 text-white rounded-br-none shadow-lg shadow-green-900/10' : 'bg-[#1a1a1a] text-gray-200 rounded-bl-none border border-white/5'}`}>
                                            <p className="text-sm font-medium">{msg.content}</p>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-tighter mt-1 opacity-40 ${isMe ? 'mr-1' : 'ml-1'}`}>{messageTime}</span>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef}/>
                    </div>

                    <form onSubmit={handleSendMessage} className="p-6 bg-black border-t border-white/5 flex gap-3">
                        <input
                            type="text"
                            placeholder="Wiadomość..."
                            className="flex-1 bg-[#0a0a0a] border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 text-sm font-bold transition-all text-white"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />
                        <button type="submit" className="bg-green-600 hover:bg-green-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-green-900/30 transition-all active:scale-90"><Send size={20} /></button>
                    </form>
                </div>
            )}

            {/* CYBERPUNK CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .leaflet-popup-content-wrapper { border-radius: 1.5rem; padding: 5px; }
                .leaflet-container { font-family: inherit; background: #050505 !important; height: 100% !important; width: 100% !important; z-index: 1; }
                .leaflet-tile-container { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
                
                .react-datepicker-wrapper { width: 100%; display: block; }
                .react-datepicker-popper { z-index: 9999 !important; }
                .react-datepicker { background-color: #0f0f0f !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 1rem !important; color: white !important; font-family: inherit !important; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                .react-datepicker__header { background-color: #050505 !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; border-top-left-radius: 1rem !important; border-top-right-radius: 1rem !important; padding-top: 15px; }
                .react-datepicker__current-month, .react-datepicker-time__header, .react-datepicker__day-name { color: #fff !important; font-weight: 900 !important; text-transform: uppercase !important; letter-spacing: 0.1em; font-size: 0.7rem; }
                .react-datepicker__day { color: #aaa !important; border-radius: 0.5rem !important; transition: all 0.2s; }
                .react-datepicker__day:hover { background-color: rgba(34,197,94,0.2) !important; color: #22c55e !important; }
                .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected { background-color: #16a34a !important; color: white !important; font-weight: 900 !important; }
                .react-datepicker__time-container { border-left: 1px solid rgba(255,255,255,0.05) !important; }
                .react-datepicker__time { background-color: #0f0f0f !important; border-top-right-radius: 1rem !important; border-bottom-right-radius: 1rem !important; }
                .react-datepicker__time-list-item { color: #aaa !important; font-size: 0.8rem; transition: all 0.2s; }
                .react-datepicker__time-list-item:hover { background-color: rgba(34,197,94,0.2) !important; color: #22c55e !important; }
                .react-datepicker__time-list-item--selected { background-color: #16a34a !important; color: white !important; font-weight: bold !important; }
                .react-datepicker-popper[data-placement^="bottom"] .react-datepicker__triangle::before, .react-datepicker-popper[data-placement^="bottom"] .react-datepicker__triangle::after { border-bottom-color: #0f0f0f !important; }
                .react-datepicker-popper[data-placement^="top"] .react-datepicker__triangle::before, .react-datepicker-popper[data-placement^="top"] .react-datepicker__triangle::after { border-top-color: #0f0f0f !important; }
            `
            }}/>
        </div>
    );
}