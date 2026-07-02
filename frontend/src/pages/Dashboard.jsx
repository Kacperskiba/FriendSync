import React, {useState, useEffect} from 'react';
import axios from 'axios';
import {useNavigate} from 'react-router-dom';
import EventMapComponent from '../components/GlobalDashboardMap.jsx';
import { useWebSocket } from '../components/WebSocketContext';
import { useCurrency } from '../components/CurrencyContext';
import { notifyUserChanged } from '../services/preferences';
import {
    Map, Bell, Pencil, Trash2,
    CalendarDays, Calendar, ArrowRight, X, Check, Plus, UserPlus,
    UserMinus, TrendingDown, TrendingUp
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useDialog } from '../components/DialogContext';

import DatePicker, {registerLocale} from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {pl} from "date-fns/locale";

registerLocale("pl", pl);

import {API_BASE_URL} from '../services/api';

const API_URL = `${API_BASE_URL}/api/events`;
const FRIENDS_API = `${API_BASE_URL}/api/friends`;
const NOTIF_API = `${API_BASE_URL}/api/notifications`;
const BASE_URL = API_BASE_URL;

export default function Dashboard() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEventData, setNewEventData] = useState({title: '', description: '', event_date: null});

    const [currentUserId, setCurrentUserId] = useState(null);

    const [notifications, setNotifications] = useState([]);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const [activeFriendTab, setActiveFriendTab] = useState('list');
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [eventInvitations, setEventInvitations] = useState([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    const [isGlobalMapOpen, setIsGlobalMapOpen] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [editingEvent, setEditingEvent] = useState(null);

    const navigate = useNavigate();

    // Globalny WS z kontekstu – nie zamyka się przy zmianie strony
    const { connect, addListener } = useWebSocket();
    const { format: formatMoney } = useCurrency();
    const { confirm } = useDialog();

    const refreshFriends = async (token) => {
        try {
            const res = await axios.get(FRIENDS_API, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setFriends(res.data);
        } catch (err) {
            console.error("Błąd odświeżania znajomych:", err);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }

        const fetchUserProfile = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/users/me`, {
                    headers: {Authorization: `Bearer ${token}`}
                });
                setCurrentUserId(res.data.id);
                localStorage.setItem('username', res.data.username);
            } catch (err) {
                console.error("Błąd profilu:", err);
            }
        };

        const fetchInitialData = async () => {
            try {
                const [eventsRes, notifsRes, friendsRes, pendingRes] = await Promise.all([
                    axios.get(API_URL, {headers: {Authorization: `Bearer ${token}`}}),
                    axios.get(NOTIF_API, {headers: {Authorization: `Bearer ${token}`}}),
                    axios.get(FRIENDS_API, {headers: {Authorization: `Bearer ${token}`}}),
                    axios.get(`${FRIENDS_API}/pending`, {headers: {Authorization: `Bearer ${token}`}})
                ]);
                setEvents(eventsRes.data);
                setNotifications(notifsRes.data);
                setFriends(friendsRes.data);
                setPendingRequests(pendingRes.data);
            } catch (err) {
                console.error("Błąd pobierania danych:", err);
                setError("Nie udało się załadować danych. Możliwe, że sesja wygasła.");
                if (err.response?.status === 401) {
                    localStorage.removeItem('token');
                    notifyUserChanged();
                    navigate('/');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
        fetchInitialData();
        refreshFinances();
        refreshEventInvitations();
    }, [navigate]);

    // Gdy znamy userId – nawiąż WS i nasłuchuj wiadomości
    useEffect(() => {
        if (!currentUserId) return;

        const token = localStorage.getItem('token');

        // Nawiąż połączenie (ignoruje jeśli już otwarte)
        connect();

        // Daj WS ~500ms na onopen, potem odśwież znajomych żeby is_online był poprawny
        const timer = setTimeout(() => refreshFriends(token), 500);

        const refreshEvents = async () => {
            const t = localStorage.getItem('token');
            try {
                const res = await axios.get(API_URL, { headers: {Authorization: `Bearer ${t}`} });
                setEvents(res.data);
            } catch (err) {
                console.error("Błąd odświeżania eventów:", err);
            }
        };

        const refreshNotifs = async () => {
            const t = localStorage.getItem('token');
            try {
                const res = await axios.get(NOTIF_API, { headers: {Authorization: `Bearer ${t}`} });
                setNotifications(res.data);
            } catch (err) {
                console.error("Błąd odświeżania powiadomień:", err);
            }
        };

        const removeStatus = addListener("user_status", (msg) => {
            setFriends(prev => prev.map(f =>
                f.id === msg.user_id ? {...f, is_online: msg.is_online} : f
            ));
            setSelectedFriend(prev =>
                prev?.id === msg.user_id ? {...prev, is_online: msg.is_online} : prev
            );
        });

        const removeNewReq = addListener("friend_request_new", async () => {
            const t = localStorage.getItem('token');
            try {
                const res = await axios.get(`${FRIENDS_API}/pending`, {
                    headers: {Authorization: `Bearer ${t}`}
                });
                setPendingRequests(res.data);
            } catch (err) {
                console.error("Błąd pobierania zaproszeń:", err);
            }
            refreshNotifs();
        });

        const removeAccepted = addListener("friend_request_accepted", async () => {
            await refreshFriends(localStorage.getItem('token'));
            refreshNotifs();
        });

        // Lista eventów też powinna się odświeżać (np. po dodaniu/usunięciu uczestnika)
        const removeEventUpd = addListener("event_updated", () => {
            refreshEvents();
            refreshFinances();
        });

        const removeEventDel = addListener("event_deleted", (msg) => {
            refreshEvents();
            refreshFinances();
            // Zamknij modal edycji jeśli edytujemy właśnie usunięty event
            setEditingEvent(prev => (prev?.id === msg.event_id ? null : prev));
        });

        // Profil znajomego się zmienił — odśwież listę znajomych (zawiera avatar, bio, nick)
        const removeProfileUpd = addListener("profile_updated", async () => {
            await refreshFriends(localStorage.getItem('token'));
        });

        // Ktoś nas usunął ze znajomych
        const removeFriendRm = addListener("friend_removed", async () => {
            await refreshFriends(localStorage.getItem('token'));
            setSelectedFriend(prev => (prev ? null : prev));
        });

        // Nowe zaproszenie do wydarzenia
        const removeInvNew = addListener("event_invitation_new", () => {
            refreshEventInvitations();
            refreshNotifs();
        });

        // Ktoś odpowiedział na zaproszenie które wysłaliśmy
        const removeInvResolved = addListener("event_invitation_resolved", () => {
            refreshNotifs();
        });

        return () => {
            clearTimeout(timer);
            removeStatus();
            removeNewReq();
            removeAccepted();
            removeEventUpd();
            removeEventDel();
            removeProfileUpd();
            removeFriendRm();
            removeInvNew();
            removeInvResolved();
        };
    }, [currentUserId, connect, addListener]);

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
                    console.error("Błąd wyszukiwania", err);
                }
            } else {
                setSuggestions([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');

        const payload = {
            title: newEventData.title,
            description: newEventData.description || null,
            event_date: newEventData.event_date ? new Date(newEventData.event_date).toISOString() : null
        };

        try {
            if (editingEvent) {
                const response = await axios.put(`${API_URL}/${editingEvent.id}`, payload, {
                    headers: {Authorization: `Bearer ${token}`}
                });
                setEvents(events.map(ev => ev.id === editingEvent.id ? response.data : ev));
            } else {
                const response = await axios.post(API_URL, payload, {
                    headers: {Authorization: `Bearer ${token}`}
                });
                setEvents([...events, response.data]);
            }

            setIsModalOpen(false);
            setNewEventData({title: '', description: '', event_date: null});
            setEditingEvent(null);
        } catch (err) {
            alert("Nie udało się zapisać wydarzenia.");
        }
    };

    const handleDeleteEvent = async (e, eventId) => {
        e.stopPropagation();
        if (!await confirm("Czy na pewno chcesz usunąć to wydarzenie?", { danger: true })) return;

        try {
            await axios.delete(`${API_URL}/${eventId}`, {
                headers: {Authorization: `Bearer ${localStorage.getItem('token')}`}
            });
            setEvents(events.filter(ev => ev.id !== eventId));
        } catch (err) {
            alert("Błąd usuwania");
        }
    };

    const handleSendFriendRequest = async (e, directIdentifier = null) => {
        if (e) e.preventDefault();

        const targetIdentifier = directIdentifier || searchQuery;
        if (!targetIdentifier.trim()) return;

        const token = localStorage.getItem('token');
        try {
            await axios.post(`${FRIENDS_API}/request`, {friend_identifier: targetIdentifier}, {
                headers: {Authorization: `Bearer ${token}`}
            });
            alert("Zaproszenie wysłane!");
            setSearchQuery('');
            setSuggestions([]);
        } catch (err) {
            alert(err.response?.data?.detail || "Błąd wysyłania zaproszenia");
        }
    };

    const handleAcceptRequest = async (friendshipId) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${FRIENDS_API}/${friendshipId}/accept`, {}, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setPendingRequests(prev => prev.filter(req => req.friendship_id !== friendshipId));
            await refreshFriends(token);
        } catch (err) {
            alert("Nie udało się zaakceptować.");
        }
    };

    const handleMarkAsRead = async (notifId) => {
        const token = localStorage.getItem('token');
        try {
            await axios.put(`${NOTIF_API}/${notifId}/read`, {}, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setNotifications(prev => prev.map(n => n.id === notifId ? {...n, is_read: true} : n));
        } catch (err) {}
    };

    const [financeSummary, setFinanceSummary] = useState({ total_to_pay: 0, total_to_receive: 0 });

    const refreshEventInvitations = async () => {
        const t = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/invitations`, {
                headers: {Authorization: `Bearer ${t}`}
            });
            setEventInvitations(res.data);
        } catch (err) {
            console.error("Błąd zaproszeń do wydarzeń:", err);
        }
    };

    const handleAcceptEventInvitation = async (invId) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/invitations/${invId}/accept`, {}, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setEventInvitations(prev => prev.filter(i => i.id !== invId));
        } catch (err) {
            alert(err.response?.data?.detail || "Błąd akceptacji zaproszenia.");
        }
    };

    const handleDeclineEventInvitation = async (invId) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/invitations/${invId}/decline`, {}, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setEventInvitations(prev => prev.filter(i => i.id !== invId));
        } catch (err) {
            alert(err.response?.data?.detail || "Błąd odrzucenia zaproszenia.");
        }
    };

    const refreshFinances = async () => {
        const t = localStorage.getItem('token');
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me/finances/summary`, {
                headers: {Authorization: `Bearer ${t}`}
            });
            setFinanceSummary(res.data);
        } catch (err) {
            console.error("Błąd podsumowania finansów:", err);
        }
    };

    const handleRemoveFriend = async (friendId) => {
        if (!await confirm("Czy na pewno chcesz usunąć tego znajomego?", { danger: true })) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${FRIENDS_API}/${friendId}`, {
                headers: {Authorization: `Bearer ${token}`}
            });
            setFriends(prev => prev.filter(f => f.id !== friendId));
            setSelectedFriend(null);
        } catch (err) {
            alert(err.response?.data?.detail || "Błąd usuwania znajomego.");
        }
    };

    const handleClearAllNotifs = async () => {
        if (!await confirm("Usunąć wszystkie powiadomienia?", { danger: true })) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(NOTIF_API, { headers: {Authorization: `Bearer ${token}`} });
            setNotifications([]);
        } catch (err) {
            alert("Nie udało się wyczyścić powiadomień.");
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const renderAvatar = (imageUrl, name, sizeClasses = "w-10 h-10", isOnline = false) => {
        return (
            <div className="relative shrink-0">
                {imageUrl ? (
                    <img
                        src={`${BASE_URL}/${imageUrl}`}
                        alt={name}
                        className={`${sizeClasses} rounded-xl object-cover border border-white/10 shadow-lg`}
                        onError={(e) => {
                            e.target.src = "";
                            e.target.classList.add('hidden');
                        }}
                    />
                ) : (
                    <div
                        className={`${sizeClasses} bg-green-600 rounded-xl flex items-center justify-center font-black italic shadow-lg text-white`}>
                        {name ? name.substring(0, 1).toUpperCase() : '?'}
                    </div>
                )}
                <div
                    className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0f0f0f] shadow-sm transition-colors duration-500 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                ></div>
            </div>
        );
    };

    const formatEventDate = (dateString) => {
        if (!dateString) return "Brak daty";
        return new Date(dateString).toLocaleDateString('pl-PL', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <>
            <Navbar>
                {/* Globalny bilans: suma długów i należności ze wszystkich wyjazdów */}
                <div className="flex items-center gap-2">
                    <div
                        title="Łączna kwota, którą jesteś winien/winna ze wszystkich wyjazdów"
                        className="flex items-center gap-2.5 px-3 py-1.5 bg-[#0f0f0f] border border-red-500/20 rounded-xl shadow-md"
                    >
                        <TrendingDown size={16} className="text-red-500 shrink-0" />
                        <div className="leading-none">
                            <p className="text-[7px] font-black uppercase tracking-[0.15em] text-gray-500 mb-0.5">Do zapłaty</p>
                            <p className="text-[15px] font-black italic text-red-500 tracking-tight">
                                {formatMoney(financeSummary.total_to_pay)}
                            </p>
                        </div>
                    </div>
                    <div
                        title="Łączna kwota, którą inni są winni Tobie ze wszystkich wyjazdów"
                        className="flex items-center gap-2.5 px-3 py-1.5 bg-[#0f0f0f] border border-green-500/20 rounded-xl shadow-md"
                    >
                        <TrendingUp size={16} className="text-green-500 shrink-0" />
                        <div className="leading-none">
                            <p className="text-[7px] font-black uppercase tracking-[0.15em] text-gray-500 mb-0.5">Należność</p>
                            <p className="text-[15px] font-black italic text-green-500 tracking-tight">
                                {formatMoney(financeSummary.total_to_receive)}
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setIsGlobalMapOpen(true)}
                    title="Globalna mapa wyjazdów"
                    className="bg-[#0f0f0f] hover:bg-[#151515] text-white px-4 py-3 rounded-xl md:rounded-2xl transition-all border border-white/5 shadow-xl flex items-center justify-center"
                >
                    <Map size={20} />
                </button>
                <button
                    onClick={() => setIsNotifOpen(true)}
                    title="Powiadomienia"
                    className="relative bg-[#0f0f0f] hover:bg-[#151515] text-white px-4 py-3 rounded-xl md:rounded-2xl transition-all border border-white/5 shadow-xl flex items-center justify-center"
                >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span
                            className="absolute top-2 right-2 md:right-3 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0f0f0f]"></span>
                    )}
                </button>

                <button
                    onClick={() => {
                        setEditingEvent(null);
                        setNewEventData({title: '', description: '', event_date: null});
                        setIsModalOpen(true);
                    }}
                    className="bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[9px] md:text-[10px] tracking-widest px-4 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl transition-all shadow-xl shadow-green-900/20 text-center flex items-center justify-center gap-2"
                >
                    <Plus size={16} /> <span className="hidden sm:inline">Nowe wydarzenie</span>
                </button>
            </Navbar>

            <div
                className="min-h-screen xl:min-h-[calc(100vh_-_80px)] xl:h-[calc(100vh_-_80px)] bg-[#050505] text-white p-4 sm:p-6 md:p-8 font-sans relative flex flex-col overflow-x-hidden xl:overflow-hidden">

                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full"></div>
                </div>

                <div
                    className="relative z-40 flex-1 flex flex-col xl:flex-row gap-8 lg:gap-10 max-w-[1600px] w-full mx-auto min-h-0">

                <div className="flex-1 flex flex-col min-w-0 xl:overflow-hidden">
                    <div className="flex-1 xl:overflow-y-auto pr-0 xl:pr-2 pb-6 xl:pb-10 custom-scrollbar">
                        {loading && (
                            <div className="flex flex-col items-center mt-20 gap-4">
                                <div
                                    className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}

                        {error && (
                            <p className="text-red-500 font-black text-center mt-10 uppercase tracking-widest">{error}</p>
                        )}

                        {!loading && !error && events.length === 0 && (
                            <div
                                className="text-center mt-10 md:mt-20 p-10 md:p-20 bg-[#0f0f0f] rounded-[2rem] md:rounded-[3rem] border border-white/5 shadow-2xl">
                                <p className="text-gray-500 mb-8 font-black uppercase tracking-widest text-xs md:text-sm">Baza
                                    jest pusta.</p>
                                <button
                                    onClick={() => {
                                        setEditingEvent(null);
                                        setNewEventData({title: '', description: '', event_date: null});
                                        setIsModalOpen(true);
                                    }}
                                    className="w-full sm:w-auto bg-white text-black font-black uppercase text-[10px] md:text-xs tracking-widest px-8 py-4 md:px-10 md:py-5 rounded-xl md:rounded-2xl hover:bg-green-500 transition-all"
                                >
                                    Stwórz pierwsze wydarzenie
                                </button>
                            </div>
                        )}

                        {!loading && !error && events.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 md:gap-8">
                                {events.map((event) => (
                                    <div
                                        key={event.id}
                                        onClick={() => navigate(`/events/${event.id}`)}
                                        className="group bg-[#0f0f0f] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 hover:border-green-500/30 hover:bg-[#151515] transition-all cursor-pointer relative overflow-hidden shadow-2xl flex flex-col"
                                    >
                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <div
                                                    className="w-10 h-10 md:w-12 md:h-12 bg-black rounded-xl flex items-center justify-center text-green-500 group-hover:scale-110 transition-all">
                                                    <CalendarDays size={20} />
                                                </div>
                                                <div className="flex gap-2 relative z-20">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingEvent(event);
                                                            setNewEventData({
                                                                title: event.title,
                                                                description: event.description || '',
                                                                event_date: event.event_date ? new Date(event.event_date) : null
                                                            });
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="hover:text-green-500 transition-colors bg-black/50 p-2 rounded-lg border border-white/5"
                                                    ><Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteEvent(e, event.id)}
                                                        className="hover:text-red-500 transition-colors bg-black/50 p-2 rounded-lg border border-white/5"
                                                    ><Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <h2 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase mb-3 group-hover:text-green-500 transition-colors">
                                                {event.title}
                                            </h2>

                                            <div className="flex flex-col gap-1 mb-4 border-l-2 border-green-600 pl-3">
                                                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                                    <Calendar size={11} /> {formatEventDate(event.event_date)}
                                                </p>
                                            </div>

                                            <p className="text-gray-500 text-[10px] md:text-xs font-bold leading-relaxed line-clamp-2 mb-6 flex-1">
                                                {event.description || "Brak opisu."}
                                            </p>

                                            <div
                                                className="pt-6 border-t border-white/5 flex justify-between items-center mt-auto">
                                                <span
                                                    className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-green-500/50 group-hover:text-green-500 transition-colors flex items-center gap-2">
                                                    Szczegóły <ArrowRight size={12} />
                                                </span>
                                                <span
                                                    className="text-[8px] md:text-[9px] text-gray-700 font-black uppercase tracking-widest">
                                                    {new Date(event.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div
                                            className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full xl:w-[450px] shrink-0 flex flex-col h-[500px] xl:h-full pb-8 xl:pb-0">
                    <div
                        className="bg-[#0f0f0f] rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col flex-1 min-h-0">

                        <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase mb-6 shrink-0">Twoja <span
                            className="text-green-500">Ekipa.</span></h2>

                        <div
                            className="flex flex-col sm:flex-row gap-2 mb-6 bg-black p-1 rounded-2xl border border-white/5 shrink-0">
                            <button
                                onClick={() => setActiveFriendTab('list')}
                                className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all ${activeFriendTab === 'list' ? 'bg-[#151515] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Lista znajomych
                            </button>
                            <button
                                onClick={() => setActiveFriendTab('pending')}
                                className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all ${activeFriendTab === 'pending' ? 'bg-[#151515] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'} flex items-center justify-center gap-2`}
                            >
                                Oczekujące
                                {(pendingRequests.length + eventInvitations.length) > 0 && <span
                                    className="bg-green-600 text-white px-2 py-0.5 rounded-full text-[8px]">{pendingRequests.length + eventInvitations.length}</span>}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {activeFriendTab === 'list' && (
                                <div className="space-y-6">

                                    <div className="relative">
                                        <form onSubmit={(e) => handleSendFriendRequest(e)}
                                              className="flex flex-col sm:flex-row gap-2 relative z-20">
                                            <input
                                                type="text" required placeholder="Nick lub e-mail..."
                                                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                                className="flex-1 bg-black border border-white/5 rounded-xl md:rounded-2xl px-5 py-3 outline-none focus:border-green-500/50 transition-all font-bold text-xs md:text-sm text-gray-200 min-w-0"
                                            />
                                            <button type="submit"
                                                    className="bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[9px] md:text-[10px] tracking-widest px-4 py-3 sm:py-0 rounded-xl md:rounded-2xl transition-all">
                                                Zaproś
                                            </button>
                                        </form>

                                        {suggestions.length > 0 && (
                                            <div
                                                className="absolute top-[110%] left-0 right-0 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden">
                                                {suggestions.map(user => (
                                                    <div
                                                        key={user.id}
                                                        onClick={() => handleSendFriendRequest(null, user.username)}
                                                        className="p-4 border-b border-white/5 hover:bg-[#252525] cursor-pointer transition-all flex items-center justify-between group"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            {renderAvatar(user.profile_image, user.username, "w-10 h-10")}
                                                            <div>
                                                                <p className="font-bold text-sm text-gray-200 group-hover:text-green-500 transition-colors">{user.username}</p>
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mt-1">{user.email}</p>
                                                            </div>
                                                        </div>
                                                        <span
                                                            className="text-[10px] font-black uppercase tracking-widest text-green-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                            Zaproś <UserPlus size={12} />
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3 pb-4">
                                        {friends.length === 0 ? (
                                            <p className="text-gray-600 text-center text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-10">
                                                Brak znajomych na liście
                                            </p>
                                        ) : (
                                            friends.map(friend => (
                                                <div
                                                    key={friend.id}
                                                    onClick={() => setSelectedFriend(friend)}
                                                    className="group bg-black p-4 rounded-xl md:rounded-2xl border border-white/5 flex items-center gap-4 hover:border-green-500/30 hover:bg-[#0a0a0a] transition-all cursor-pointer"
                                                >
                                                    {renderAvatar(friend.profile_image, friend.username, "w-10 h-10", friend.is_online)}

                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-xs md:text-sm text-gray-200 truncate group-hover:text-green-500 transition-colors">
                                                            {friend.username}
                                                        </p>
                                                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-600 truncate">
                                                            {friend.email}
                                                        </p>
                                                    </div>

                                                    <div
                                                        className="text-gray-700 group-hover:text-green-500 transition-colors text-[10px] flex items-center">
                                                        {friend.is_online ? (
                                                            <span
                                                                className="text-green-500/50 italic font-black uppercase tracking-tighter">Online</span>
                                                        ) : (
                                                            <ArrowRight size={14} />
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeFriendTab === 'pending' && (
                                <div className="space-y-6 pb-4">
                                    <div className="space-y-3">
                                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">Znajomi</p>
                                        {pendingRequests.length === 0 ? (
                                            <p className="text-gray-700 text-center text-[9px] md:text-[10px] font-black uppercase tracking-widest py-4">
                                                Brak zaproszeń do znajomych
                                            </p>
                                        ) : (
                                            pendingRequests.map(req => (
                                                <div key={req.friendship_id}
                                                     className="bg-black p-4 rounded-xl md:rounded-2xl border border-white/5 flex flex-col gap-3">
                                                    <div className="flex items-center gap-3">
                                                        {renderAvatar(req.user.profile_image, req.user.username, "w-8 h-8")}
                                                        <div>
                                                            <p className="font-bold text-xs md:text-sm text-gray-200 truncate">{req.user.username}</p>
                                                            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-600">chce
                                                                dołączyć do znajomych</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAcceptRequest(req.friendship_id)}
                                                        className="w-full bg-white hover:bg-gray-200 text-black font-black uppercase text-[8px] md:text-[9px] tracking-widest px-4 py-3 rounded-xl transition-all shadow-lg"
                                                    >
                                                        Akceptuj
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">Wyjazdy</p>
                                        {eventInvitations.length === 0 ? (
                                            <p className="text-gray-700 text-center text-[9px] md:text-[10px] font-black uppercase tracking-widest py-4">
                                                Brak zaproszeń do wyjazdów
                                            </p>
                                        ) : (
                                            eventInvitations.map(inv => (
                                                <div key={inv.id}
                                                     className="bg-black p-4 rounded-xl md:rounded-2xl border border-white/5 flex flex-col gap-3">
                                                    <div className="flex items-center gap-3">
                                                        {renderAvatar(inv.inviter.profile_image, inv.inviter.username, "w-8 h-8")}
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-xs md:text-sm text-gray-200 truncate">
                                                                {inv.inviter.username}
                                                            </p>
                                                            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-600 truncate">
                                                                zaprasza do „{inv.event.title}”
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleAcceptEventInvitation(inv.id)}
                                                            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[8px] md:text-[9px] tracking-widest px-3 py-3 rounded-xl transition-all flex items-center justify-center gap-1"
                                                        >
                                                            <Check size={12} /> Akceptuj
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeclineEventInvitation(inv.id)}
                                                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-black uppercase text-[8px] md:text-[9px] tracking-widest px-3 py-3 rounded-xl transition-all flex items-center justify-center gap-1"
                                                        >
                                                            <X size={12} /> Odrzuć
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200] backdrop-blur-xl">
                    <div
                        className="bg-[#0f0f0f] rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 w-full max-w-lg border border-white/10 shadow-2xl relative">
                        <button onClick={() => setIsModalOpen(false)}
                                className="absolute top-4 md:top-6 right-6 md:right-8 text-gray-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                        <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-center mb-6 md:mb-8">
                            {editingEvent ? "Edytuj " : "Nowy "}<span className="text-green-500">Projekt.</span>
                        </h2>

                        <form onSubmit={handleCreateEvent} className="space-y-4 md:space-y-5">
                            <div>
                                <label
                                    className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Tytuł
                                    wyjazdu</label>
                                <input
                                    type="text" required maxLength={100}
                                    className="w-full bg-black border border-white/5 rounded-xl md:rounded-2xl px-5 py-3 md:px-6 md:py-4 outline-none focus:border-green-500/50 transition-all font-bold text-xs md:text-sm text-gray-200"
                                    placeholder="Np. Berlin 2026"
                                    value={newEventData.title}
                                    onChange={(e) => setNewEventData({...newEventData, title: e.target.value})}
                                />
                            </div>

                            <div>
                                <label
                                    className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Data
                                    i godzina startu</label>
                                <div className="relative w-full">
                                    <DatePicker
                                        selected={newEventData.event_date}
                                        onChange={(date) => setNewEventData({...newEventData, event_date: date})}
                                        showTimeInput
                                        timeInputLabel="Godzina:"
                                        dateFormat="d MMMM yyyy, HH:mm"
                                        locale="pl"
                                        placeholderText="Wybierz datę z kalendarza..."
                                        className="w-full bg-black border border-white/5 rounded-xl md:rounded-2xl px-5 py-3 md:px-6 md:py-4 outline-none focus:border-green-500/50 transition-all font-bold text-xs md:text-sm text-gray-200 cursor-pointer"
                                    />
                                    <span
                                        className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 z-10 text-gray-400">
                                        <Calendar size={14} />
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label
                                    className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Krótki
                                    opis</label>
                                <textarea
                                    rows={2}
                                    className="w-full bg-black border border-white/5 rounded-xl md:rounded-2xl px-5 py-3 md:px-6 md:py-4 outline-none focus:border-green-500/50 transition-all font-bold text-xs md:text-sm text-gray-200 resize-none custom-scrollbar"
                                    placeholder="O czym warto pamiętać?"
                                    value={newEventData.description}
                                    onChange={(e) => setNewEventData({...newEventData, description: e.target.value})}
                                />
                            </div>

                            <div className="pt-2">
                                <button type="submit"
                                        className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[9px] md:text-[10px] tracking-widest py-4 md:py-5 rounded-xl md:rounded-2xl shadow-xl shadow-green-900/20 transition-all">
                                    {editingEvent ? 'Zapisz zmiany' : 'Stwórz'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isNotifOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-end p-4 md:p-6 z-[200]">
                    <div
                        className="bg-[#0f0f0f] rounded-[2rem] p-6 w-full max-w-sm border border-white/10 shadow-2xl mt-16 md:mt-20 relative animate-in slide-in-from-right-8 fade-in">
                        <button onClick={() => setIsNotifOpen(false)}
                                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                        <h3 className="text-lg md:text-xl font-black italic tracking-tighter uppercase mb-4 border-b border-white/5 pb-4">Aktualności</h3>

                        {notifications.length > 0 && (
                            <button
                                onClick={handleClearAllNotifs}
                                className="w-full mb-4 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black uppercase text-[9px] tracking-widest px-4 py-3 rounded-xl border border-red-500/20 transition-all"
                            >
                                <Trash2 size={14} /> Wyczyść wszystkie
                            </button>
                        )}

                        <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <p className="text-gray-600 text-center text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-10">Wszystko
                                    przeczytane</p>
                            ) : (
                                notifications.map(notif => (
                                    <div key={notif.id}
                                         className={`p-4 rounded-xl md:rounded-2xl border transition-all cursor-default ${notif.is_read ? 'bg-black border-transparent opacity-50' : 'bg-[#151515] border-green-500/30 shadow-lg shadow-green-900/10'}`}>
                                        <p className="text-[10px] md:text-xs text-gray-300 font-medium mb-3">{notif.message}</p>
                                        <div className="flex justify-between items-center">
                                            <span
                                                className="text-[8px] font-black uppercase tracking-widest text-gray-600">
                                                {new Date(notif.created_at).toLocaleDateString()}
                                            </span>
                                            {!notif.is_read && (
                                                <button
                                                    onClick={() => handleMarkAsRead(notif.id)}
                                                    className="text-[8px] font-black uppercase tracking-widest text-green-500 hover:text-green-400 flex items-center gap-1"
                                                >
                                                    <Check size={11} /> Zrozumiałem
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedFriend && (
                <div
                    className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={() => setSelectedFriend(null)}>
                    <div
                        className="bg-[#0f0f0f] w-full max-w-md rounded-[2.5rem] border border-white/10 p-8 shadow-2xl animate-in zoom-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center text-center">
                            {renderAvatar(selectedFriend.profile_image, selectedFriend.username, "w-24 h-24", selectedFriend.is_online)}

                            <h3 className="mt-4 text-2xl font-black italic uppercase tracking-tighter">
                                {selectedFriend.username}
                            </h3>

                            <p className="text-[10px] font-black uppercase text-green-500 tracking-[0.2em] mb-4">
                                {selectedFriend.is_online ? "Online" : "Offline"}
                            </p>

                            {selectedFriend.tags && (
                                <div className="flex flex-wrap justify-center gap-2 mb-6">
                                    {selectedFriend.tags.split(',').map((tag, idx) => (
                                        <span key={idx}
                                              className="bg-white/5 text-[9px] font-black uppercase px-3 py-1 rounded-full border border-white/10 text-gray-400">
                                #{tag.trim()}
                            </span>
                                    ))}
                                </div>
                            )}

                            <div className="w-full bg-black/40 rounded-2xl p-4 border border-white/5 mb-6">
                                <p className="text-[8px] font-black uppercase text-gray-600 tracking-widest mb-2">O
                                    mnie:</p>
                                <p className="text-xs text-gray-300 leading-relaxed italic">
                                    {selectedFriend.bio || "Ten użytkownik jeszcze nie dodał opisu."}
                                </p>
                            </div>

                            <div className="w-full flex flex-col sm:flex-row gap-2">
                                <button
                                    onClick={() => handleRemoveFriend(selectedFriend.id)}
                                    className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <UserMinus size={14} /> Usuń znajomego
                                </button>
                                <button
                                    onClick={() => setSelectedFriend(null)}
                                    className="flex-1 py-4 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-green-500 transition-all"
                                >
                                    Zamknij
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isGlobalMapOpen && (
                <div
                    className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 md:p-10 z-[250] animate-in fade-in duration-300">
                    <div
                        className="bg-[#0f0f0f] border border-white/10 rounded-[2rem] md:rounded-[3rem] w-full h-full max-w-[1400px] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)]">

                        <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-[#111]">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
                                    Globalna <span className="text-green-500">Mapa Wyjazdów</span>
                                </h2>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                                    Przeglądaj wszystkie destynacje swojej ekipy
                                </p>
                            </div>
                            <button
                                onClick={() => setIsGlobalMapOpen(false)}
                                className="bg-white/5 hover:bg-red-500/20 hover:text-red-500 text-white w-12 h-12 rounded-2xl transition-all flex items-center justify-center"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 relative bg-black">
                            <EventMapComponent/>
                        </div>

                        <div className="p-4 bg-[#0a0a0a] text-center">
                            <p className="text-[8px] font-black uppercase text-gray-700 tracking-[0.3em]">
                                Tryb podglądu • Aby dodać punkt, wejdź w konkretne wydarzenie
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .react-datepicker-wrapper { width: 100%; display: block; }
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
        </>
    );
}