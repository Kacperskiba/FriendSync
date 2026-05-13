import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { useWebSocket } from '../components/WebSocketContext';

// --- IMPORT IKON LUCIDE ---
import {
    ArrowLeft, ArrowRight, CheckCircle, Sparkles, Handshake,
    ShoppingCart, ShoppingBag, Banknote, Check
} from 'lucide-react';

export default function EventFinance() {
    const { id } = useParams();
    const navigate = useNavigate();

    // DANE
    const [expenses, setExpenses] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [summary, setSummary] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // MODAL & FORM
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expenseData, setExpenseData] = useState({ title: '', amount: '' });
    const [selectedUsers, setSelectedUsers] = useState([]);

    const token = localStorage.getItem('token');
    const headers = { headers: { Authorization: `Bearer ${token}` } };

    const { addListener } = useWebSocket();

    const fetchData = async () => {
        setLoading(true);
        try {
            const resMe = await axios.get(`${API_BASE_URL}/api/users/me`, headers);
            setCurrentUser(resMe.data);

            const [resExp, resUsers, resSummary] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/events/${id}/expenses`, headers),
                axios.get(`${API_BASE_URL}/api/events/${id}/participants`, headers),
                axios.get(`${API_BASE_URL}/api/events/${id}/finances/summary`, headers)
            ]);

            setExpenses(resExp.data || []);
            setParticipants(resUsers.data || []);
            setSummary(resSummary.data);
        } catch (err) {
            console.error("Błąd pobierania danych:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (id) fetchData(); }, [id]);

    useEffect(() => {
        if (!id) return;
        const removeUpd = addListener("event_updated", (msg) => {
            if (msg.event_id !== parseInt(id)) return;
            fetchData();
        });
        const removeDel = addListener("event_deleted", (msg) => {
            if (msg.event_id !== parseInt(id)) return;
            navigate('/dashboard');
        });
        return () => { removeUpd(); removeDel(); };
    }, [id, addListener, navigate]);

    // LOGIKA ROZLICZENIA (ZAPŁACONE)
    const handleSettle = async (toUserId, amount) => {
        const targetUser = getUsername(toUserId);
        if (!window.confirm(`Czy na pewno chcesz oznaczyć dług wobec ${targetUser} (${amount.toFixed(2)} PLN) jako spłacony?`)) return;

        const payload = {
            amount: amount,
            description: `Rozliczenie długu: do ${targetUser}`,
            shares: [{ user_id: toUserId, amount: amount }]
        };

        try {
            await axios.post(`${API_BASE_URL}/api/events/${id}/expenses`, payload, headers);
            fetchData();
        } catch (err) {
            alert("Błąd zapisu spłaty: " + (err.response?.data?.detail || "Nieznany błąd"));
        }
    };

    // LOGIKA DODAWANIA WYDATKU
    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (selectedUsers.length === 0) {
            alert("Musisz zaznaczyć przynajmniej jedną osobę!");
            return;
        }

        const totalAmount = parseFloat(expenseData.amount);
        const sharePerPerson = totalAmount / selectedUsers.length;

        const payload = {
            amount: totalAmount,
            description: expenseData.title,
            shares: selectedUsers.map(userId => ({
                user_id: userId,
                amount: sharePerPerson
            }))
        };

        try {
            await axios.post(`${API_BASE_URL}/api/events/${id}/expenses`, payload, headers);
            setIsModalOpen(false);
            setExpenseData({ title: '', amount: '' });
            setSelectedUsers([]);
            fetchData();
        } catch (err) {
            alert("Błąd zapisu: " + (err.response?.data?.detail || "Nieznany błąd"));
        }
    };

    const toggleUser = (userId) => {
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(uid => uid !== userId) : [...prev, userId]
        );
    };

    const getUsername = (uid) => participants.find(p => p.id === parseInt(uid))?.username || `Użytkownik ${uid}`;

    // PRZELEWY AGREGOWANE
    const myDebts = useMemo(() => summary?.settlements?.filter(s => s.from_user_id === currentUser?.id) || [], [summary, currentUser]);
    const myReceivables = useMemo(() => summary?.settlements?.filter(s => s.to_user_id === currentUser?.id) || [], [summary, currentUser]);

    // FILTROWANIE LOGÓW
    const purchaseExpenses = useMemo(() =>
        expenses.filter(exp => !exp.description?.startsWith("Rozliczenie długu")),
        [expenses]
    );

    const settlementExpenses = useMemo(() =>
        expenses.filter(exp => exp.description?.startsWith("Rozliczenie długu")),
        [expenses]
    );

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black tracking-tighter animate-pulse uppercase text-xl italic">Synchronizacja portfela...</div>;

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans relative">
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-500/5 blur-[120px] rounded-full"></div>
            </div>

            <div className="max-w-6xl mx-auto relative z-10">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div>
                        <button onClick={() => navigate(`/events/${id}`)} className="text-gray-600 hover:text-green-500 mb-4 flex items-center gap-2 transition-all text-[10px] font-black uppercase tracking-[0.3em]">
                            <ArrowLeft size={14} /> Powrót do wydarzenia
                        </button>
                        <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-none">Portfel<span className="text-green-500">.</span></h1>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-green-600 hover:bg-green-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-[0_10px_40px_rgba(34,197,94,0.3)] active:scale-95"
                    >
                        + Dodaj Wydatek
                    </button>
                </div>

                {/* DASHBOARD: IN / OUT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    <div className="bg-[#0f0f0f] border border-red-500/10 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-[10px] font-black text-red-500/50 uppercase tracking-[0.4em]">Do spłaty</h3>
                            <span className="bg-red-500/10 text-red-500 text-[9px] px-4 py-1.5 rounded-full font-black italic border border-red-500/20">DEBT</span>
                        </div>
                        <div className="space-y-6">
                            {myDebts.length > 0 ? myDebts.map((s, i) => (
                                <div key={i} className="bg-black/40 p-6 rounded-[2rem] border border-white/5 flex flex-col gap-5">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-[8px] text-gray-700 uppercase font-black mb-1 tracking-widest">Odbiorca:</p>
                                            <p className="font-black text-2xl tracking-tighter text-gray-200 italic uppercase">{getUsername(s.to_user_id)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-black text-red-500 tracking-tighter">-{s.amount.toFixed(2)}</p>
                                            <p className="text-[8px] text-gray-700 font-black uppercase tracking-widest">PLN</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleSettle(s.to_user_id, s.amount)}
                                        className="w-full py-4 flex items-center justify-center gap-2 bg-red-500/5 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all"
                                    >
                                        Oznacz jako zapłacone <CheckCircle size={14} />
                                    </button>
                                </div>
                            )) : (
                                <div className="text-center py-10 opacity-20 flex flex-col items-center">
                                    <Sparkles size={40} className="mb-4 text-white" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Brak długów</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#0f0f0f] border border-green-500/10 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-[10px] font-black text-green-500/50 uppercase tracking-[0.4em]">Należności</h3>
                            <span className="bg-green-500/10 text-green-500 text-[9px] px-4 py-1.5 rounded-full font-black italic border border-green-500/20">CREDIT</span>
                        </div>
                        <div className="space-y-4">
                            {myReceivables.length > 0 ? myReceivables.map((s, i) => (
                                <div key={i} className="flex justify-between items-center bg-black/40 p-6 rounded-[2rem] border border-white/5">
                                    <div>
                                        <p className="text-[8px] text-gray-700 uppercase font-black mb-1 tracking-widest">Dłużnik:</p>
                                        <p className="font-black text-2xl tracking-tighter text-gray-200 italic uppercase">{getUsername(s.from_user_id)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black text-green-500 tracking-tighter">+{s.amount.toFixed(2)}</p>
                                        <p className="text-[8px] text-gray-700 font-black uppercase tracking-widest">PLN</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-10 opacity-20 flex flex-col items-center">
                                    <Handshake size={40} className="mb-4 text-white" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Czysta karta</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* HISTORIA OPERACJI - ROZDZIELONA */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 px-4">

                    {/* KOLUMNA: ZAKUPY */}
                    <div>
                        <div className="flex items-center gap-4 mb-8">
                            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] whitespace-nowrap flex items-center gap-2">
                                <ShoppingCart size={14} /> Log zakupów
                            </h3>
                            <div className="h-px flex-1 bg-white/5"></div>
                        </div>
                        <div className="space-y-3">
                            {purchaseExpenses.length > 0 ? [...purchaseExpenses].reverse().map(exp => (
                                <div key={exp.id} className="bg-[#0f0f0f] hover:bg-[#131313] p-5 rounded-[2rem] border border-white/5 flex justify-between items-center transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center grayscale group-hover:grayscale-0 transition-all border border-white/5 text-gray-400 group-hover:text-green-500">
                                            <ShoppingBag size={18} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-sm text-white uppercase tracking-tight italic">{exp.description || "Zakup"}</h4>
                                            <p className="text-[8px] font-black text-green-500 uppercase tracking-widest">{getUsername(exp.payer_id)} zapłacił(a)</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-white italic tracking-tighter">{exp.amount.toFixed(2)}</p>
                                        <p className="text-[8px] text-gray-700 font-bold uppercase">{new Date(exp.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            )) : <p className="text-center py-10 text-gray-800 font-black uppercase text-[9px] tracking-widest">Brak zakupów</p>}
                        </div>
                    </div>

                    {/* KOLUMNA: SPŁATY */}
                    <div>
                        <div className="flex items-center gap-4 mb-8">
                            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] whitespace-nowrap flex items-center gap-2">
                                <Banknote size={14} /> Log spłat
                            </h3>
                            <div className="h-px flex-1 bg-white/5"></div>
                        </div>
                        <div className="space-y-3">
                            {settlementExpenses.length > 0 ? [...settlementExpenses].reverse().map(exp => (
                                <div key={exp.id} className="bg-[#0f0f0f]/50 hover:bg-[#131313] p-5 rounded-[2rem] border border-green-500/10 flex justify-between items-center transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-green-500/5 rounded-xl flex items-center justify-center border border-green-500/20 text-green-500">
                                            <Check size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-sm text-gray-400 uppercase tracking-tight italic">Spłata długu</h4>
                                            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                                {getUsername(exp.payer_id)} <ArrowRight size={9} /> {getUsername(exp.shares[0]?.user_id)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-green-500 italic tracking-tighter">{exp.amount.toFixed(2)}</p>
                                        <p className="text-[8px] text-gray-700 font-bold uppercase">{new Date(exp.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            )) : <p className="text-center py-10 text-gray-800 font-black uppercase text-[9px] tracking-widest">Brak spłat</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL: DODAWANIE */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 backdrop-blur-xl">
                    <div className="bg-[#0f0f0f] p-12 rounded-[4rem] border border-white/10 w-full max-w-xl shadow-[0_0_100px_rgba(0,0,0,1)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-green-600"></div>
                        <h2 className="text-4xl font-black mb-10 text-center uppercase italic tracking-tighter">Nowy Koszt<span className="text-green-500">.</span></h2>
                        <form onSubmit={handleAddExpense} className="space-y-8">
                            <div>
                                <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-4 mb-3 block">Opis transakcji</label>
                                <input
                                    type="text"
                                    placeholder="Np. Restauracja, Paliwo..."
                                    required
                                    className="w-full bg-black border border-white/5 rounded-2xl px-8 py-5 outline-none focus:border-green-500/50 transition-all font-bold text-gray-200"
                                    value={expenseData.title}
                                    onChange={(e) => setExpenseData({...expenseData, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-4 mb-3 block">Kwota całkowita (PLN)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    required
                                    className="w-full bg-black border border-white/5 rounded-2xl px-8 py-6 outline-none focus:border-green-500 transition-all font-black text-4xl text-green-500 tracking-tighter"
                                    value={expenseData.amount}
                                    onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-4 mb-4 block">Podział na osoby</label>
                                <div className="grid grid-cols-2 gap-3 bg-black/50 p-6 rounded-[2.5rem] border border-white/5 max-h-56 overflow-y-auto">
                                    {participants.map(p => (
                                        <label key={p.id} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 ${selectedUsers.includes(p.id) ? 'bg-green-600/10 border-green-600/50' : 'bg-black border-transparent hover:border-white/10'}`}>
                                            <input type="checkbox" className="hidden" checked={selectedUsers.includes(p.id)} onChange={() => toggleUser(p.id)} />
                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedUsers.includes(p.id) ? 'bg-green-600 border-green-600' : 'border-gray-800'}`}>
                                                {selectedUsers.includes(p.id) && <Check size={12} strokeWidth={4} className="text-white" />}
                                            </div>
                                            <span className={`text-[11px] font-black uppercase tracking-tight ${selectedUsers.includes(p.id) ? 'text-white' : 'text-gray-600'}`}>{p.username}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-6 bg-white/5 hover:bg-white/10 rounded-3xl font-black uppercase text-[11px] tracking-widest transition-all text-gray-500">Anuluj</button>
                                <button type="submit" className="flex-1 py-6 bg-green-600 hover:bg-green-500 rounded-3xl font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-green-900/40 transition-all active:scale-95">Zapisz wydatki</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}