import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

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

    const fetchData = async () => {
        setLoading(true);
        try {
            const resMe = await axios.get('http://127.0.0.1:8000/api/users/me', headers);
            setCurrentUser(resMe.data);

            const [resExp, resUsers, resSummary] = await Promise.all([
                axios.get(`http://127.0.0.1:8000/api/events/${id}/expenses`, headers),
                axios.get(`http://127.0.0.1:8000/api/events/${id}/participants`, headers),
                axios.get(`http://127.0.0.1:8000/api/events/${id}/finances/summary`, headers)
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
            await axios.post(`http://127.0.0.1:8000/api/events/${id}/expenses`, payload, headers);
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

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black tracking-tighter animate-pulse uppercase">Wczytywanie finansów...</div>;

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div>
                        <button onClick={() => navigate(`/events/${id}`)} className="text-gray-600 hover:text-green-500 mb-2 flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-widest">
                            ← Powrót
                        </button>
                        <h1 className="text-5xl font-black italic tracking-tighter uppercase">Portfel <span className="text-green-500">.</span></h1>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-green-600 hover:bg-green-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-[0_10px_30px_rgba(34,197,94,0.3)]"
                    >
                        + Nowy Wydatek
                    </button>
                </div>

                {/* DASHBOARD: IN / OUT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">

                    {/* MUSZĘ ODDAĆ (OUT) */}
                    <div className="bg-[#0f0f0f] border border-red-500/10 rounded-[2.5rem] p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xs font-black text-red-500 uppercase tracking-[0.3em]">Twoje długi</h3>
                            <span className="bg-red-500/10 text-red-500 text-[10px] px-3 py-1 rounded-full font-black italic">OUT</span>
                        </div>
                        <div className="space-y-4">
                            {myDebts.length > 0 ? myDebts.map((s, i) => (
                                <div key={i} className="flex justify-between items-center bg-gradient-to-r from-black to-transparent p-5 rounded-2xl border border-white/5">
                                    <div>
                                        <p className="text-[9px] text-gray-600 uppercase font-black mb-1">Wyślij do:</p>
                                        <p className="font-black text-xl tracking-tight text-gray-200">{getUsername(s.to_user_id)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-red-500">-{s.amount.toFixed(2)}</p>
                                        <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest">PLN</p>
                                    </div>
                                </div>
                            )) : <p className="text-gray-700 font-bold uppercase text-xs tracking-widest py-4">Wszystko spłacone ✨</p>}
                        </div>
                    </div>

                    {/* DOSTANĘ (IN) */}
                    <div className="bg-[#0f0f0f] border border-green-500/10 rounded-[2.5rem] p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xs font-black text-green-500 uppercase tracking-[0.3em]">Wpływy</h3>
                            <span className="bg-green-500/10 text-green-500 text-[10px] px-3 py-1 rounded-full font-black italic">IN</span>
                        </div>
                        <div className="space-y-4">
                            {myReceivables.length > 0 ? myReceivables.map((s, i) => (
                                <div key={i} className="flex justify-between items-center bg-gradient-to-r from-black to-transparent p-5 rounded-2xl border border-white/5">
                                    <div>
                                        <p className="text-[9px] text-gray-600 uppercase font-black mb-1">Czekasz na przelew od:</p>
                                        <p className="font-black text-xl tracking-tight text-gray-200">{getUsername(s.from_user_id)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-green-500">+{s.amount.toFixed(2)}</p>
                                        <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest">PLN</p>
                                    </div>
                                </div>
                            )) : <p className="text-gray-700 font-bold uppercase text-xs tracking-widest py-4">Nikt nic nie wisi 🤝</p>}
                        </div>
                    </div>
                </div>

                {/* HISTORIA OPERACJI */}
                <div className="px-2">
                    <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] mb-8">Historia zakupów</h3>
                    <div className="space-y-4">
                        {expenses.length > 0 ? [...expenses].reverse().map(exp => (
                            <div key={exp.id} className="bg-[#0f0f0f] hover:bg-[#151515] p-6 rounded-[2rem] border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center transition-all group">
                                <div className="flex items-center gap-6 mb-4 md:mb-0">
                                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">🛒</div>
                                    <div>
                                        <h4 className="font-black text-lg text-white mb-1 uppercase tracking-tight">{exp.description || "Zakup"}</h4>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Płatnik: {getUsername(exp.payer_id)}</span>
                                            <span className="text-[9px] text-gray-700 font-bold uppercase tracking-widest">{new Date(exp.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-left md:text-right">
                                    <p className="text-xl font-black text-white italic">{exp.amount.toFixed(2)} PLN</p>
                                    <p className="text-[8px] text-gray-700 font-black uppercase tracking-widest">Podzielone na {exp.shares.length} osoby</p>
                                </div>
                            </div>
                        )) : <div className="text-center text-gray-800 py-10 font-black uppercase text-xs tracking-widest">Brak danych</div>}
                    </div>
                </div>
            </div>

            {/* MODAL: DODAWANIE (NAPRAWIONY) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
                    <div className="bg-[#0f0f0f] p-10 rounded-[3rem] border border-white/10 w-full max-w-lg shadow-[0_0_80px_rgba(0,0,0,1)]">
                        <h2 className="text-2xl font-black mb-8 text-center uppercase italic tracking-tighter">Nowy Koszt <span className="text-green-500">+</span></h2>

                        <form onSubmit={handleAddExpense} className="space-y-6">
                            <div>
                                <label className="text-[9px] text-gray-600 font-black uppercase tracking-widest ml-2 mb-2 block">Co kupiłeś?</label>
                                <input
                                    type="text"
                                    placeholder="Np. Bilety na koncert"
                                    required
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500 transition-all font-bold text-sm"
                                    value={expenseData.title}
                                    onChange={(e) => setExpenseData({...expenseData, title: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="text-[9px] text-gray-600 font-black uppercase tracking-widest ml-2 mb-2 block">Kwota (PLN)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    required
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500 transition-all font-black text-xl text-green-500"
                                    value={expenseData.amount}
                                    onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="text-[9px] text-gray-600 font-black uppercase tracking-widest ml-2 mb-4 block">Dla kogo to było?</label>
                                <div className="grid grid-cols-2 gap-2 bg-black/50 p-4 rounded-3xl border border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
                                    {participants.map(p => (
                                        <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedUsers.includes(p.id) ? 'bg-green-500/10 border-green-500/20' : 'border-transparent hover:bg-white/5'}`}>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={selectedUsers.includes(p.id)}
                                                onChange={() => toggleUser(p.id)}
                                            />
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedUsers.includes(p.id) ? 'bg-green-500 border-green-500' : 'border-gray-700'}`}>
                                                {selectedUsers.includes(p.id) && <span className="text-[10px] text-black font-black">✓</span>}
                                            </div>
                                            <span className={`text-xs font-bold uppercase tracking-tight ${selectedUsers.includes(p.id) ? 'text-white' : 'text-gray-500'}`}>
                                                {p.username}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-5 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                                >
                                    Anuluj
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-5 bg-green-600 hover:bg-green-500 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-green-900/20 transition-all"
                                >
                                    Dodaj wydatek
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}