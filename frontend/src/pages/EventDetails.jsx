import React, {useState, useEffect, useRef} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import axios from 'axios';

import EventMapComponent from '../components/EventMapComponent';

const API_URL = "http://127.0.0.1:8000/api/events";
const FRIENDS_API = "http://127.0.0.1:8000/api/friends";
const BASE_URL = "http://127.0.0.1:8000";

export default function EventDetails() {
    const {id} = useParams();
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);

    const [event, setEvent] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false); // Stan dla Mapy

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    const [newMessage, setNewMessage] = useState('');
    const [currentUserId, setCurrentUserId] = useState(null);

    // --- LOGIKA POBIERANIA DANYCH ---

    const fetchEventData = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(API_URL, {
                headers: {Authorization: `Bearer ${token}`}
            });
            const currentEvent = res.data.find(e => e.id === parseInt(id));
            if (currentEvent) setEvent(currentEvent);
            else navigate('/dashboard');
        } catch (err) {
            navigate('/dashboard');
        }
    };

    const fetchParticipants = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/${id}/participants`, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setParticipants(res.data);
        } catch (err) {
            console.error("Błąd uczestników:", err);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                const token = localStorage.getItem('token');
                try {
                    const res = await axios.get(`${FRIENDS_API}/search-users?q=${searchQuery}`, {
                        headers: {Authorization: `Bearer ${token}`}
                    });
                    setSuggestions(res.data);
                } catch (err) {
                }
            } else {
                setSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const fetchMessages = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/${id}/messages`, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setMessages(res.data);
        } catch (err) {
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        axios.get(`${BASE_URL}/api/users/me`, {
            headers: {Authorization: `Bearer ${token}`}
        }).then(res => setCurrentUserId(res.data.id));

        fetchEventData();
        fetchParticipants();

        if (isChatOpen) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 3000);
            return () => clearInterval(interval);
        }
    }, [id, isChatOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
    }, [messages]);

    const handleInvite = async (e, directIdentifier = null) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const targetIdentifier = directIdentifier || searchQuery;
        if (!targetIdentifier.trim()) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/${id}/invite`, {email: targetIdentifier}, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setSearchQuery('');
            setSuggestions([]);
            fetchParticipants();
        } catch (err) {
            alert(err.response?.data?.detail || "Błąd zaproszenia");
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/${id}/messages`, {content: newMessage}, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setNewMessage('');
            fetchMessages();
        } catch (err) {
        }
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
                {name.substring(0, 2)}
            </div>
        );
    };

    if (!event) return <div
        className="min-h-screen bg-[#050505] flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-[0.3em]">Wczytywanie...</div>;

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans p-6 md:p-12 relative">
            <div
                className="fixed top-0 right-0 w-1/2 h-1/2 bg-green-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            {/* NAWIGACJA GÓRNA */}
            <div
                className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6 relative z-10">
                <button onClick={() => navigate('/dashboard')}
                        className="text-gray-600 hover:text-white flex items-center gap-2 font-black uppercase text-[10px] tracking-[0.3em] transition-all">
                    ← Powrót
                </button>
                <div className="flex gap-4 w-full md:w-auto">
                    <button onClick={() => setIsMapOpen(true)}
                            className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 transition-all">
                        📍 Mapa
                    </button>
                    <button onClick={() => setIsChatOpen(true)}
                            className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 transition-all">
                        💬 Czat
                    </button>
                    <button onClick={() => navigate(`/events/${id}/finance`)}
                            className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-green-900/20 transition-all">
                        💸 Portfel
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                {/* INFO */}
                <div
                    className="md:col-span-2 bg-[#0f0f0f] rounded-[3rem] p-10 border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div
                        className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                        <span className="text-[120px] font-black italic uppercase leading-none">INFO</span>
                    </div>
                    <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-6 leading-none">
                        {event.title}<span className="text-green-500">.</span>
                    </h1>
                    <p className="text-gray-500 text-lg font-bold leading-relaxed mb-10 max-w-xl">
                        {event.description || "Brak opisu wydarzenia."}
                    </p>
                    <div className="pt-8 border-t border-white/5 flex items-center gap-4">
                        <div
                            className="px-4 py-2 bg-black rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400">Status:
                            Aktywne
                        </div>
                        <div
                            className="text-[9px] font-black uppercase tracking-widest text-gray-700">Utworzono: {new Date(event.created_at).toLocaleDateString()}</div>
                    </div>
                </div>

                {/* EKIPA + SZUKAJ */}
                <div className="bg-[#0f0f0f] rounded-[3rem] p-8 border border-white/5 shadow-2xl h-fit">
                    <h3 className="font-black text-gray-500 uppercase tracking-[0.3em] text-[10px] mb-6">Ekipa</h3>

                    <div className="relative mb-8">
                        <form onSubmit={handleInvite} className="flex flex-col gap-2 relative z-20">
                            <input
                                type="text"
                                required
                                placeholder="Nick lub e-mail..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black border border-white/5 rounded-2xl px-5 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-xs text-gray-200"
                            />
                            <button type="submit"
                                    className="bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[10px] py-4 rounded-2xl transition-all shadow-xl shadow-green-900/20">
                                Zaproś
                            </button>
                        </form>
                        {suggestions.length > 0 && (
                            <div
                                className="absolute top-[105%] left-0 right-0 bg-[#151515] border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden">
                                {suggestions.map(user => (
                                    <div key={user.id} onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleInvite(null, user.email);
                                    }}
                                         className="p-4 border-b border-white/5 hover:bg-white/5 cursor-pointer flex items-center gap-3">
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

                    <div className="space-y-3">
                        {participants.map((user) => (
                            <div key={user.id}
                                 className="flex items-center gap-4 bg-black p-4 rounded-2xl border border-white/5 group hover:border-green-500/30 transition-all">
                                {renderAvatar(user.profile_image, user.username)}
                                <div>
                                    <span
                                        className="block text-[11px] font-black uppercase tracking-tight text-white italic">{user.username}</span>
                                    <span
                                        className="block text-[8px] font-black uppercase text-gray-600 tracking-widest">{user.id === event.owner_id ? "Organizator" : "Uczestnik"}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- MODALE --- */}

            {/* MODAL MAPY */}
            {isMapOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md"
                         onClick={() => setIsMapOpen(false)}></div>
                    <div
                        className="relative w-full max-w-6xl h-full max-h-[85vh] bg-[#0f0f0f] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col">
                        <div className="p-6 bg-black border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-black uppercase text-xs tracking-[0.3em] text-green-500 italic">Mapa
                                Wydarzenia</h3>
                            <button onClick={() => setIsMapOpen(false)}
                                    className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full text-gray-500 hover:text-white transition-all">✕
                            </button>
                        </div>
                        <div className="flex-1 relative">
                            {/* WYWOŁANIE ZAIMPORTOWANEGO KOMPONENTU */}
                            <EventMapComponent eventId={id}/>
                        </div>
                    </div>
                </div>
            )}

            {/* CZAT */}
            {isChatOpen && (
                <div
                    className="fixed bottom-8 right-8 w-full max-w-md h-[600px] bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-10">
                    <div className="bg-black p-6 flex justify-between items-center border-b border-white/5">
                        <h3 className="font-black uppercase text-[10px] tracking-[0.3em] text-green-500 italic">Czat wydarzenia</h3>
                        <button onClick={() => setIsChatOpen(false)}
                                className="text-gray-500 hover:text-white transition-all">✕
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0a0a0a] flex flex-col custom-scrollbar">
                        {messages.map((msg) => {
                            const isMe = msg.author.id === currentUserId;

                            // Formatowanie godziny
                            const messageTime = msg.created_at
                                ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
                                : "";

                            return (
                                <div key={msg.id}
                                     className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'self-end flex-row-reverse' : 'self-start flex-row'}`}>
                                    {!isMe && (
                                        <div
                                            className="mb-6"> {/* Zwiększony margines dolny avatara, by pasował do dodanej godziny */}
                                            {renderAvatar(msg.author.profile_image, msg.author.username, "w-7 h-7 text-[8px] rounded-full")}
                                        </div>
                                    )}

                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className={`px-4 py-2.5 rounded-[1.5rem] ${
                                            isMe
                                                ? 'bg-green-600 text-white rounded-br-none shadow-lg shadow-green-900/10'
                                                : 'bg-[#1a1a1a] text-gray-200 rounded-bl-none border border-white/5'
                                        }`}>
                                            <p className="text-sm font-medium">{msg.content}</p>
                                        </div>

                                        {/* Mała godzina pod wiadomością */}
                                        <span
                                            className={`text-[9px] font-black uppercase tracking-tighter mt-1 opacity-40 ${isMe ? 'mr-1' : 'ml-1'}`}>
                                {messageTime}
                            </span>
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
                        <button type="submit"
                                className="bg-green-600 hover:bg-green-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-green-900/30 transition-all active:scale-90">
                            🚀
                        </button>
                    </form>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .leaflet-popup-content-wrapper { border-radius: 1.5rem; padding: 5px; }
                .leaflet-container { font-family: inherit; background: #050505 !important; }
                .leaflet-tile-container { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
            `
            }}/>
        </div>
    );
}