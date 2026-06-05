import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import Navbar from '../components/Navbar';
import { useWebSocket } from '../components/WebSocketContext';
import { useCurrency } from '../components/CurrencyContext';
import { useDialog } from '../components/DialogContext';

import {
    ArrowLeft, ArrowRight, CheckCircle, Sparkles, Handshake,
    ShoppingCart, ShoppingBag, Banknote, Check, ChevronDown, ChevronRight
} from 'lucide-react';

const SETTLEMENT_PREFIX = 'Rozliczenie';

export default function EventFinance() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [expenses, setExpenses] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [summary, setSummary] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expenseData, setExpenseData] = useState({ title: '', amount: '' });
    const [selectedUsers, setSelectedUsers] = useState([]);

    // Które grupy długów/należności rozwinięte (klucz = userId).
    const [openDebts, setOpenDebts] = useState({});
    const [openCreds, setOpenCreds] = useState({});
    // Które wydatki rozwinięte w logu (klucz = expense.id).
    const [openExpenses, setOpenExpenses] = useState({});

    const token = localStorage.getItem('token');
    const headers = { headers: { Authorization: `Bearer ${token}` } };

    const { addListener } = useWebSocket();
    const { format: formatMoney } = useCurrency();
    const { confirm } = useDialog();

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

    // --- SPŁATY ---
    const handleSettleShare = async (shareId, label) => {
        if (!await confirm(`Oznaczyć ${label} jako spłacone?`, { confirmText: 'Oznacz' })) return;
        try {
            await axios.post(`${API_BASE_URL}/api/events/${id}/shares/${shareId}/settle`, {}, headers);
            fetchData();
        } catch (err) {
            alert("Błąd: " + (err.response?.data?.detail || "Nieznany błąd"));
        }
    };

    const handleSettleAllWith = async (creditorId, total) => {
        const name = getUsername(creditorId);
        if (!await confirm(`Spłacić CAŁY dług wobec ${name} (${formatMoney(total)})?`, { confirmText: 'Spłać całość' })) return;
        try {
            await axios.post(`${API_BASE_URL}/api/events/${id}/creditors/${creditorId}/settle-all`, {}, headers);
            fetchData();
        } catch (err) {
            alert("Błąd: " + (err.response?.data?.detail || "Nieznany błąd"));
        }
    };

    // --- DODAWANIE WYDATKU ---
    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (selectedUsers.length === 0) {
            alert("Musisz zaznaczyć przynajmniej jedną osobę!");
            return;
        }

        const totalAmount = parseFloat(expenseData.amount);
        if (!(totalAmount > 0)) {
            alert("Kwota musi być dodatnia.");
            return;
        }

        // Podział w groszach: pierwsi R = total % N dostają +1 grosz.
        const totalCents = Math.round(totalAmount * 100);
        const n = selectedUsers.length;
        const baseCents = Math.floor(totalCents / n);
        const remainder = totalCents - baseCents * n;

        const shares = selectedUsers.map((userId, idx) => ({
            user_id: userId,
            amount: ((baseCents + (idx < remainder ? 1 : 0)) / 100),
        }));

        const payload = {
            amount: totalCents / 100,
            description: expenseData.title,
            shares,
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

    const isSettlementExp = (exp) => exp.description?.startsWith(SETTLEMENT_PREFIX);

    // --- DANE POCHODNE: szczegółowe długi/należności po realnych shares ---
    const myDebtsByCreditor = useMemo(() => {
        if (!currentUser) return [];
        const map = new Map();
        expenses.forEach(exp => {
            if (isSettlementExp(exp)) return;
            if (exp.payer_id === currentUser.id) return;
            (exp.shares || []).forEach(sh => {
                if (sh.user_id !== currentUser.id) return;
                if (sh.is_settled) return;
                if (!map.has(exp.payer_id)) map.set(exp.payer_id, { items: [], total: 0 });
                const slot = map.get(exp.payer_id);
                slot.items.push({
                    shareId: sh.id,
                    expenseId: exp.id,
                    description: exp.description || 'Zakup',
                    amount: sh.amount,
                    date: exp.created_at,
                });
                slot.total += sh.amount;
            });
        });
        return Array.from(map.entries()).map(([creditorId, v]) => ({
            creditorId, total: v.total, items: v.items,
        }));
    }, [expenses, currentUser]);

    const myReceivablesByDebtor = useMemo(() => {
        if (!currentUser) return [];
        const map = new Map();
        expenses.forEach(exp => {
            if (isSettlementExp(exp)) return;
            if (exp.payer_id !== currentUser.id) return;
            (exp.shares || []).forEach(sh => {
                if (sh.user_id === currentUser.id) return;
                if (sh.is_settled) return;
                if (!map.has(sh.user_id)) map.set(sh.user_id, { items: [], total: 0 });
                const slot = map.get(sh.user_id);
                slot.items.push({
                    shareId: sh.id,
                    expenseId: exp.id,
                    description: exp.description || 'Zakup',
                    amount: sh.amount,
                    date: exp.created_at,
                });
                slot.total += sh.amount;
            });
        });
        return Array.from(map.entries()).map(([debtorId, v]) => ({
            debtorId, total: v.total, items: v.items,
        }));
    }, [expenses, currentUser]);

    const purchaseExpenses = useMemo(
        () => expenses.filter(exp => !isSettlementExp(exp)),
        [expenses]
    );
    const settlementExpenses = useMemo(
        () => expenses.filter(exp => isSettlementExp(exp)),
        [expenses]
    );

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black tracking-tighter animate-pulse uppercase text-xl italic">Synchronizacja portfela...</div>;

    return (
        <>
            <Navbar>
                <button
                    onClick={() => navigate(`/events/${id}`)}
                    title="Powrót do wydarzenia"
                    className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border border-white/5 transition-all shadow-lg flex items-center gap-2"
                >
                    <ArrowLeft size={16} /> <span className="hidden sm:inline">Powrót</span>
                </button>
                <button
                    onClick={() => {
                        setSelectedUsers(participants.map(p => p.id));
                        setIsModalOpen(true);
                    }}
                    className="bg-green-600 hover:bg-green-500 text-white px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-green-900/30 active:scale-95"
                >
                    + Dodaj Wydatek
                </button>
            </Navbar>

            <div className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans relative">
                <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-500/5 blur-[120px] rounded-full"></div>
                </div>

                <div className="max-w-6xl mx-auto relative z-10">

                    {/* HEADER */}
                    <div className="mb-8 md:mb-12">
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black italic tracking-tighter uppercase leading-none">Portfel<span className="text-green-500">.</span></h1>
                        {summary && (
                            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
                                Łączny koszt wydarzenia: <span className="text-white">{formatMoney(summary.total_event_cost)}</span>
                            </p>
                        )}
                    </div>

                {/* DASHBOARD: DŁUGI / NALEŻNOŚCI Z ROZWIJANYMI POZYCJAMI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-10 md:mb-16">

                    {/* DO SPŁATY */}
                    <div className="bg-[#0f0f0f] border border-red-500/10 rounded-[2rem] md:rounded-[3rem] p-5 sm:p-8 md:p-10 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 md:mb-8">
                            <h3 className="text-[10px] font-black text-red-500/50 uppercase tracking-[0.4em]">Do spłaty</h3>
                            <span className="bg-red-500/10 text-red-500 text-[9px] px-4 py-1.5 rounded-full font-black italic border border-red-500/20">DEBT</span>
                        </div>
                        <div className="space-y-4">
                            {myDebtsByCreditor.length > 0 ? myDebtsByCreditor.map(group => {
                                const expanded = !!openDebts[group.creditorId];
                                return (
                                    <div key={group.creditorId} className="bg-black/40 rounded-[2rem] border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setOpenDebts(s => ({ ...s, [group.creditorId]: !expanded }))}
                                            className="w-full flex justify-between items-center gap-3 p-4 sm:p-6 text-left hover:bg-white/[0.02] transition-all rounded-[2rem]"
                                        >
                                            <div className="flex items-center gap-3">
                                                {expanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                                                <div>
                                                    <p className="text-[8px] text-gray-700 uppercase font-black mb-1 tracking-widest">Odbiorca:</p>
                                                    <p className="font-black text-lg sm:text-xl md:text-2xl tracking-tighter text-gray-200 italic uppercase break-words">{getUsername(group.creditorId)}</p>
                                                    <p className="text-[9px] text-gray-600 uppercase font-bold tracking-widest mt-1">{group.items.length} {group.items.length === 1 ? 'zakup' : 'zakupów'}</p>
                                                </div>
                                            </div>
                                            <p className="text-xl sm:text-2xl md:text-3xl font-black text-red-500 tracking-tighter shrink-0">-{formatMoney(group.total)}</p>
                                        </button>

                                        {expanded && (
                                            <div className="px-6 pb-6 space-y-2">
                                                {group.items.map(it => (
                                                    <div key={it.shareId} className="flex justify-between items-center bg-black/40 rounded-xl p-4 border border-white/5">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-black text-white truncate">{it.description}</p>
                                                            <p className="text-[8px] text-gray-700 font-bold uppercase mt-1">{new Date(it.date).toLocaleDateString()}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3 flex-shrink-0">
                                                            <span className="text-sm font-black text-red-400">-{formatMoney(it.amount)}</span>
                                                            <button
                                                                onClick={() => handleSettleShare(it.shareId, `"${it.description}" (${formatMoney(it.amount)})`)}
                                                                className="text-[8px] font-black uppercase tracking-widest bg-red-500/5 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-lg px-3 py-2 transition-all"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => handleSettleAllWith(group.creditorId, group.total)}
                                                    className="w-full mt-3 py-3 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all"
                                                >
                                                    Spłać całość ({formatMoney(group.total)}) <CheckCircle size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-10 opacity-20 flex flex-col items-center">
                                    <Sparkles size={40} className="mb-4 text-white" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Brak długów</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* NALEŻNOŚCI */}
                    <div className="bg-[#0f0f0f] border border-green-500/10 rounded-[2rem] md:rounded-[3rem] p-5 sm:p-8 md:p-10 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 md:mb-8">
                            <h3 className="text-[10px] font-black text-green-500/50 uppercase tracking-[0.4em]">Należności</h3>
                            <span className="bg-green-500/10 text-green-500 text-[9px] px-4 py-1.5 rounded-full font-black italic border border-green-500/20">CREDIT</span>
                        </div>
                        <div className="space-y-4">
                            {myReceivablesByDebtor.length > 0 ? myReceivablesByDebtor.map(group => {
                                const expanded = !!openCreds[group.debtorId];
                                return (
                                    <div key={group.debtorId} className="bg-black/40 rounded-[2rem] border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setOpenCreds(s => ({ ...s, [group.debtorId]: !expanded }))}
                                            className="w-full flex justify-between items-center gap-3 p-4 sm:p-6 text-left hover:bg-white/[0.02] transition-all rounded-[2rem]"
                                        >
                                            <div className="flex items-center gap-3">
                                                {expanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                                                <div>
                                                    <p className="text-[8px] text-gray-700 uppercase font-black mb-1 tracking-widest">Dłużnik:</p>
                                                    <p className="font-black text-lg sm:text-xl md:text-2xl tracking-tighter text-gray-200 italic uppercase break-words">{getUsername(group.debtorId)}</p>
                                                    <p className="text-[9px] text-gray-600 uppercase font-bold tracking-widest mt-1">{group.items.length} {group.items.length === 1 ? 'zakup' : 'zakupów'}</p>
                                                </div>
                                            </div>
                                            <p className="text-xl sm:text-2xl md:text-3xl font-black text-green-500 tracking-tighter shrink-0">+{formatMoney(group.total)}</p>
                                        </button>

                                        {expanded && (
                                            <div className="px-6 pb-6 space-y-2">
                                                {group.items.map(it => (
                                                    <div key={it.shareId} className="flex justify-between items-center bg-black/40 rounded-xl p-4 border border-white/5">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-black text-white truncate">{it.description}</p>
                                                            <p className="text-[8px] text-gray-700 font-bold uppercase mt-1">{new Date(it.date).toLocaleDateString()}</p>
                                                        </div>
                                                        <span className="text-sm font-black text-green-400">+{formatMoney(it.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-10 opacity-20 flex flex-col items-center">
                                    <Handshake size={40} className="mb-4 text-white" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Czysta karta</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* HISTORIA OPERACJI */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 px-0 sm:px-4">

                    {/* KOLUMNA: ZAKUPY Z PEŁNYM ROZBICIEM */}
                    <div>
                        <div className="flex items-center gap-4 mb-8">
                            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] whitespace-nowrap flex items-center gap-2">
                                <ShoppingCart size={14} /> Log zakupów
                            </h3>
                            <div className="h-px flex-1 bg-white/5"></div>
                        </div>
                        <div className="space-y-3">
                            {purchaseExpenses.length > 0 ? [...purchaseExpenses].reverse().map(exp => {
                                const expanded = !!openExpenses[exp.id];
                                const beneficiaries = (exp.shares || []).filter(s => s.user_id !== exp.payer_id);
                                return (
                                    <div key={exp.id} className="bg-[#0f0f0f] hover:bg-[#131313] rounded-[2rem] border border-white/5 transition-all">
                                        <button
                                            type="button"
                                            onClick={() => setOpenExpenses(s => ({ ...s, [exp.id]: !expanded }))}
                                            className="w-full p-5 flex justify-between items-center text-left group"
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                {expanded ? <ChevronDown size={14} className="text-gray-600 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />}
                                                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center grayscale group-hover:grayscale-0 transition-all border border-white/5 text-gray-400 group-hover:text-green-500 flex-shrink-0">
                                                    <ShoppingBag size={18} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-black text-sm text-white uppercase tracking-tight italic truncate">{exp.description || "Zakup"}</h4>
                                                    <p className="text-[8px] font-black text-green-500 uppercase tracking-widest">
                                                        {getUsername(exp.payer_id)} zapłacił(a) za {beneficiaries.length} {beneficiaries.length === 1 ? 'osobę' : 'osoby'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0 ml-3">
                                                <p className="text-lg font-black text-white italic tracking-tighter">{formatMoney(exp.amount)}</p>
                                                <p className="text-[8px] text-gray-700 font-bold uppercase">{new Date(exp.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </button>

                                        {expanded && (
                                            <div className="px-5 pb-5 space-y-2 border-t border-white/5 pt-4">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-gray-700 mb-2">Rozbicie:</p>
                                                {(exp.shares || []).map(sh => (
                                                    <div key={sh.id} className="flex justify-between items-center bg-black/40 rounded-lg px-4 py-2.5 border border-white/5">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <ArrowRight size={10} className={sh.is_settled ? "text-green-500" : "text-gray-600"} />
                                                            <span className={`text-[11px] font-black uppercase tracking-tight ${sh.is_settled ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                                                {getUsername(sh.user_id)}
                                                                {sh.user_id === exp.payer_id && <span className="text-[8px] text-green-500 ml-2">(siebie)</span>}
                                                            </span>
                                                            {sh.is_settled && sh.user_id !== exp.payer_id && (
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-green-500 ml-1">✓ spłacone</span>
                                                            )}
                                                        </div>
                                                        <span className={`text-xs font-black tracking-tighter ${sh.is_settled ? 'text-gray-600 line-through' : 'text-white'}`}>
                                                            {formatMoney(sh.amount)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : <p className="text-center py-10 text-gray-800 font-black uppercase text-[9px] tracking-widest">Brak zakupów</p>}
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
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-10 h-10 bg-green-500/5 rounded-xl flex items-center justify-center border border-green-500/20 text-green-500 flex-shrink-0">
                                            <Check size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-sm text-gray-400 uppercase tracking-tight italic truncate">{exp.description || 'Spłata'}</h4>
                                            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                                {getUsername(exp.payer_id)} <ArrowRight size={9} /> {getUsername(exp.shares?.[0]?.user_id)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-3">
                                        <p className="text-lg font-black text-green-500 italic tracking-tighter">{formatMoney(exp.amount)}</p>
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
                    <div className="bg-[#0f0f0f] p-6 sm:p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-white/10 w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-[0_0_100px_rgba(0,0,0,1)] relative">
                        <div className="absolute top-0 left-0 w-full h-2 bg-green-600"></div>
                        <h2 className="text-3xl md:text-4xl font-black mb-3 text-center uppercase italic tracking-tighter">Nowy Koszt<span className="text-green-500">.</span></h2>
                        <p className="text-center text-[9px] uppercase tracking-widest text-gray-600 font-bold mb-8">
                            Zaznacz osoby, dla których kupujesz — możesz dla siebie, dla innych, lub dla siebie+innych.
                        </p>
                        <form onSubmit={handleAddExpense} className="space-y-6 md:space-y-8">
                            <div>
                                <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-4 mb-3 block">Opis transakcji</label>
                                <input
                                    type="text"
                                    placeholder="Np. Restauracja, Paliwo..."
                                    required
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 md:px-8 md:py-5 outline-none focus:border-green-500/50 transition-all font-bold text-gray-200"
                                    value={expenseData.title}
                                    onChange={(e) => setExpenseData({...expenseData, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-4 mb-3 block">Kwota całkowita</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    required
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 md:px-8 md:py-6 outline-none focus:border-green-500 transition-all font-black text-3xl md:text-4xl text-green-500 tracking-tighter"
                                    value={expenseData.amount}
                                    onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-4 mb-4 block">Komu kupujesz?</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/50 p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 max-h-56 overflow-y-auto custom-scrollbar">
                                    {participants.map(p => (
                                        <label key={p.id} className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl cursor-pointer transition-all border-2 ${selectedUsers.includes(p.id) ? 'bg-green-600/10 border-green-600/50' : 'bg-black border-transparent hover:border-white/10'}`}>
                                            <input type="checkbox" className="hidden" checked={selectedUsers.includes(p.id)} onChange={() => toggleUser(p.id)} />
                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedUsers.includes(p.id) ? 'bg-green-600 border-green-600' : 'border-gray-800'}`}>
                                                {selectedUsers.includes(p.id) && <Check size={12} strokeWidth={4} className="text-white" />}
                                            </div>
                                            <span className={`text-[11px] font-black uppercase tracking-tight ${selectedUsers.includes(p.id) ? 'text-white' : 'text-gray-600'}`}>
                                                {p.username}{currentUser && p.id === currentUser.id ? ' (ja)' : ''}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {selectedUsers.length > 0 && expenseData.amount && (
                                    <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-3 text-center">
                                        Po podziale: ~{formatMoney(parseFloat(expenseData.amount || 0) / selectedUsers.length)} / osobę
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3 sm:gap-4 pt-2 md:pt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 md:py-6 bg-white/5 hover:bg-white/10 rounded-2xl md:rounded-3xl font-black uppercase text-[11px] tracking-widest transition-all text-gray-500">Anuluj</button>
                                <button type="submit" className="flex-1 py-4 md:py-6 bg-green-600 hover:bg-green-500 rounded-2xl md:rounded-3xl font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-green-900/40 transition-all active:scale-95">Zapisz wydatki</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </>
    );
}
