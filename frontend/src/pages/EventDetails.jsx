import React, {useState, useEffect, useRef} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import axios from 'axios';

const API_URL = "http://127.0.0.1:8000/api/events";

export default function EventDetails() {
    const {id} = useParams();
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);

    const [event, setEvent] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [newMessage, setNewMessage] = useState('');

    const fetchEventData = async () => {
        const token = localStorage.getItem('token');
        try {
            const resEvent = await axios.get(API_URL, {
                headers: {Authorization: `Bearer ${token}`}
            });
            const currentEvent = resEvent.data.find(e => e.id === parseInt(id));
            setEvent(currentEvent);
        } catch (err) {
            console.error("Błąd pobierania danych:", err);
        }
    };

    const fetchMessages = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/${id}/messages`, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setMessages(res.data);
        } catch (err) {}
    };

    useEffect(() => {
        fetchEventData();
        if (isChatOpen) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 3000);
            return () => clearInterval(interval);
        }
    }, [id, isChatOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
    }, [messages]);

    const handleInvite = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/${id}/invite`, {email: inviteEmail}, {
                headers: {Authorization: `Bearer ${token}`}
            });
            alert("Zaproszenie wysłane!");
            setIsInviteOpen(false);
            setInviteEmail('');
        } catch (err) {
            alert(err.response?.data?.detail || "Błąd wysyłania zaproszenia");
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
        } catch (err) {}
    };

    if (!event) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center text-green-500 font-black uppercase tracking-widest animate-pulse">
            Inicjalizacja widoku...
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans p-6 md:p-12">

            {/* DEKORACJA TŁA */}
            <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-green-500/5 blur-[120px] rounded-full pointer-events-none shadow-inner"></div>

            {/* NAWIGACJA GÓRNA */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6 relative z-10">
                <button onClick={() => navigate('/dashboard')}
                        className="text-gray-600 hover:text-white flex items-center gap-2 font-black uppercase text-[10px] tracking-[0.3em] transition-all">
                    ← Powrót do bazy
                </button>
                <div className="flex gap-4 w-full md:w-auto">
                    <button
                        onClick={() => setIsChatOpen(true)}
                        className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 transition-all"
                    >
                        💬 Czat
                    </button>
                    <button
                        onClick={() => navigate(`/events/${id}/finance`)}
                        className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-green-900/20 transition-all"
                    >
                        💸 Portfel
                    </button>
                </div>
            </div>

            {/* MAIN LAYOUT */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">

                {/* KARTA GŁÓWNA: SZCZEGÓŁY */}
                <div className="md:col-span-2 bg-[#0f0f0f] rounded-[3rem] p-10 border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                        <span className="text-[120px] font-black italic uppercase leading-none">INFO</span>
                    </div>

                    <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-6 leading-none">
                        {event.title}<span className="text-green-500">.</span>
                    </h1>

                    <p className="text-gray-500 text-lg font-bold leading-relaxed mb-10 max-w-xl">
                        {event.description || "To wydarzenie nie posiada jeszcze oficjalnego opisu."}
                    </p>

                    <div className="pt-8 border-t border-white/5 flex items-center gap-4">
                        <div className="px-4 py-2 bg-black rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                            Status: Aktywne
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-700">
                            Data utworzenia: {new Date(event.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* KARTA BOCZNA: UCZESTNICY */}
                <div className="bg-[#0f0f0f] rounded-[3rem] p-8 border border-white/5 shadow-2xl h-fit">
                    <div className="flex justify-between items-center mb-8 px-2">
                        <h3 className="font-black text-gray-500 uppercase tracking-[0.3em] text-[10px]">Ekipa</h3>
                        <button
                            onClick={() => setIsInviteOpen(true)}
                            className="bg-green-500/10 hover:bg-green-500/20 text-green-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                            + Zaproś
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-4 bg-black p-4 rounded-2xl border border-white/5 group hover:border-green-500/30 transition-all">
                            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-xs font-black italic shadow-lg shadow-green-900/40">
                                TY
                            </div>
                            <div>
                                <span className="block text-[11px] font-black uppercase tracking-tight text-white italic">Ty</span>
                                <span className="block text-[8px] font-black uppercase text-gray-600 tracking-widest">Organizator</span>
                            </div>
                        </div>
                        {/* Tu wpadną pozostali uczestnicy z mapowania */}
                    </div>
                </div>
            </div>

            {/* MODAL ZAPROSZENIA */}
            {isInviteOpen && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-6 backdrop-blur-xl">
                    <div className="bg-[#0f0f0f] p-10 rounded-[3rem] border border-white/10 w-full max-w-sm shadow-[0_0_100px_rgba(0,0,0,1)]">
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-center mb-8">Zaproś do <span className="text-green-500">Grup.</span></h2>
                        <form onSubmit={handleInvite} className="space-y-6">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Adres E-mail</label>
                                <input
                                    type="email"
                                    placeholder="znajomy@poczta.pl"
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm text-gray-200 shadow-inner"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setIsInviteOpen(false)}
                                        className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Anuluj</button>
                                <button type="submit" className="flex-1 py-5 bg-green-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-green-900/20">Wyślij</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* OKNO CZATU */}
            {isChatOpen && (
                <div className="fixed bottom-8 right-8 w-full max-w-md h-[600px] bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,1)] flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
                    <div className="bg-black p-6 flex justify-between items-center border-b border-white/5">
                        <h3 className="font-black uppercase text-[10px] tracking-[0.3em] text-green-500 italic">Czat Operacyjny</h3>
                        <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-gray-500 hover:text-white hover:bg-red-500/20 transition-all">✕</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0a0a0a] custom-scrollbar">
                        {messages.map((msg) => (
                            <div key={msg.id} className="group">
                                <div className="text-[8px] text-gray-600 font-black mb-2 ml-1 uppercase tracking-widest">
                                    {msg.author.username}
                                </div>
                                <div className="bg-[#151515] p-4 rounded-2xl rounded-tl-none border border-white/5 shadow-sm inline-block max-w-[90%]">
                                    <p className="text-sm font-bold text-gray-300 leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef}/>
                    </div>

                    <form onSubmit={handleSendMessage} className="p-6 bg-black border-t border-white/5 flex gap-3">
                        <input
                            type="text"
                            placeholder="Wiadomość..."
                            className="flex-1 bg-[#0a0a0a] border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 text-sm font-bold shadow-inner transition-all"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />
                        <button type="submit" className="bg-green-600 w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-green-500 transition-all shadow-lg shadow-green-900/30">
                            🚀
                        </button>
                    </form>
                </div>
            )}

        </div>
    );
}