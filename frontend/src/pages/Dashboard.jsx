import React, {useState, useEffect, useRef} from 'react';
import axios from 'axios';
import {useNavigate} from 'react-router-dom';

const API_URL = "http://127.0.0.1:8000/api/events";
const FRIENDS_API = "http://127.0.0.1:8000/api/friends";
const NOTIF_API = "http://127.0.0.1:8000/api/notifications";
const BASE_URL = "http://127.0.0.1:8000";

export default function Dashboard() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Stany Modali i Menu
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [newEventData, setNewEventData] = useState({title: '', description: ''});

    // Inicjalizacja z localStorage
    const [username, setUsername] = useState(localStorage.getItem('username') || 'Użytkownik');
    const [profileImage, setProfileImage] = useState(null);

    // Stany: Powiadomienia
    const [notifications, setNotifications] = useState([]);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    // Stany: Znajomi
    const [activeFriendTab, setActiveFriendTab] = useState('list'); // 'list' lub 'pending'
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);

    // NOWE STANY: Wyszukiwarka znajomych
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState({
        username: '',
        email: '',
        confirmEmail: '',
        password: '',
        confirmPassword: ''
    });
    const [editFile, setEditFile] = useState(null);
    const editFileInputRef = useRef(null);

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

        const fetchUserProfile = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/users/me`, {
                    headers: {Authorization: `Bearer ${token}`}
                });
                setUsername(res.data.username);
                setProfileImage(res.data.profile_image); // Pobieramy zdjęcie z backendu
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
                    navigate('/');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
        fetchInitialData();

        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [navigate]);

    // NOWY UseEffect: Automatyczne wyszukiwanie użytkowników przy pisaniu (Debounce)
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
                headers: {Authorization: `Bearer ${token}`}
            });
            setEvents([...events, response.data]);
            setIsModalOpen(false);
            setNewEventData({title: '', description: ''});
        } catch (err) {
            alert("Nie udało się utworzyć wydarzenia.");
        }
    };

    // ZAKTUALIZOWANA FUNKCJA: Zapraszanie ze wsparciem wyszukiwarki
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
            const acceptedReq = pendingRequests.find(req => req.friendship_id === friendshipId);
            if (acceptedReq) {
                setFriends(prev => [...prev, acceptedReq.user]);
            }
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
        } catch (err) {
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const renderAvatar = (imageUrl, name, sizeClasses = "w-10 h-10") => {
        if (imageUrl) {
            return (
                <img
                    src={`${BASE_URL}/${imageUrl}`}
                    alt={name}
                    className={`${sizeClasses} rounded-xl object-cover border border-white/10 shadow-lg`}
                    onError={(e) => {
                        e.target.src = "";
                        e.target.classList.add('hidden');
                    }}
                />
            );
        }
        return (
            <div
                className={`${sizeClasses} bg-green-600 rounded-xl flex items-center justify-center font-black italic shadow-lg text-white shrink-0`}>
                {name.substring(0, 1).toUpperCase()}
            </div>
        );
    };

    const openEditModal = () => {
        setEditData({username: username, email: '', password: ''}); // Możesz pobrać email z zapisanego profilu
        setIsEditModalOpen(true);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const formData = new FormData();

        if (editData.username) formData.append('username', editData.username);
        if (editData.email) {
            formData.append('email', editData.email);
            formData.append('confirm_email', editData.confirmEmail);
        }
        if (editData.password) {
            formData.append('password', editData.password);
            formData.append('confirm_password', editData.confirmPassword);
        }
        if (editFile) formData.append('profile_image', editFile);

        try {
            const res = await axios.patch(`${BASE_URL}/api/users/me`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setUsername(res.data.username);
            setProfileImage(res.data.profile_image);
            setIsEditModalOpen(false);
            alert("Profil zaktualizowany!");
        } catch (err) {
            alert(err.response?.data?.detail || "Błąd aktualizacji");
        }
    };

    return (
        // RWD KONTENER: Na małych ekranach pozwala na scrollowanie (min-h-screen), a na dużych (xl:h-screen) blokuje je
        <div
            className="min-h-screen xl:h-screen bg-[#050505] text-white p-4 sm:p-6 md:p-8 font-sans relative flex flex-col overflow-x-hidden xl:overflow-hidden">

            {/* Dekoracyjne tło */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full"></div>
            </div>

            {/* HEADER - Z-INDEX 100: Gwarantuje, że menu wysunie się nad WSZYSTKIM innym */}
            <div
                className="relative z-[100] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 max-w-[1600px] w-full mx-auto shrink-0">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase">
                        Friend <span className="text-green-500 font-black">Sync.</span>
                    </h1>
                    <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.4em] text-gray-600 mt-2">Centrum
                        dowodzenia wyjazdami</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full lg:w-auto">
                    {/* PRZYCISK DZWONKA */}
                    <button
                        onClick={() => setIsNotifOpen(true)}
                        className="relative bg-[#0f0f0f] hover:bg-[#151515] text-white font-black uppercase text-lg md:text-xl px-4 py-3 md:px-5 md:py-4 rounded-xl md:rounded-2xl transition-all border border-white/5 shadow-xl"
                    >
                        🔔
                        {unreadCount > 0 && (
                            <span
                                className="absolute top-2 right-2 md:right-3 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0f0f0f]"></span>
                        )}
                    </button>

                    {/* PRZYCISK NOWE WYDARZENIE */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[9px] md:text-[10px] tracking-widest px-6 py-4 md:px-8 md:py-4 rounded-xl md:rounded-2xl transition-all shadow-[0_10px_30px_rgba(34,197,94,0.2)] text-center"
                    >
                        + Nowe wydarzenie
                    </button>

                    {/* MENU UŻYTKOWNIKA */}
                    <div className="relative w-full sm:w-auto mt-2 sm:mt-0" ref={menuRef}>
                        <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 bg-[#0f0f0f] border border-white/5 p-2 pr-5 rounded-xl md:rounded-2xl hover:border-white/20 transition-all shadow-xl">
                            {/* SZUKAJ TEGO FRAGMENTU W HEADERZE */}
                            <div className="flex items-center gap-3">
                                {renderAvatar(profileImage, username)} {/* Zamiast starego div z inicjałem */}
                                <span className="text-[10px] font-black uppercase tracking-widest block">
                                {username}
                            </span>
                            </div>
                            <span
                                className={`text-[8px] transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {isUserMenuOpen && (
                            <div
                                className="absolute right-0 lg:right-0 left-0 lg:left-auto mt-4 w-full sm:w-56 bg-[#0f0f0f] border border-white/10 rounded-2xl md:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden py-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-6 py-4 border-b border-white/5 mb-2">
                                    <p className="text-[8px] font-black uppercase text-gray-600 tracking-[0.2em] mb-1">Zalogowany
                                        jako</p>
                                    <p className="text-xs font-black italic text-green-500 truncate">{username}</p>
                                </div>
                                <button onClick={() => navigate('/settings')}
                                        className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3">⚙️
                                    Ustawienia
                                </button>
                                <button
                                    onClick={() => {
                                        setIsUserMenuOpen(false);
                                        openEditModal();
                                    }}
                                    className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3"
                                >
                                    👤 Edytuj Profil
                                </button>
                                <div className="h-px bg-white/5 my-2 mx-4"></div>
                                <button onClick={handleLogout}
                                        className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-3">🚪
                                    Wyloguj sesję
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* KONTENER ZAWARTOŚCI - Z-INDEX 40: Jest poniżej Headera */}
            <div
                className="relative z-40 flex-1 flex flex-col xl:flex-row gap-8 lg:gap-10 max-w-[1600px] w-full mx-auto min-h-0">

                {/* LEWA KOLUMNA: WYDARZENIA */}
                <div className="flex-1 flex flex-col min-w-0 xl:overflow-hidden">
                    {/* WŁASNY SCROLL DLA WYDARZEŃ TYLKO NA DESKTOPIE (xl) */}
                    <div className="flex-1 xl:overflow-y-auto pr-0 xl:pr-2 pb-6 xl:pb-10 custom-scrollbar">
                        {loading && (
                            <div className="flex flex-col items-center mt-20 gap-4">
                                <div
                                    className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}

                        {error &&
                            <p className="text-red-500 font-black text-center mt-10 uppercase tracking-widest">{error}</p>}

                        {!loading && !error && events.length === 0 && (
                            <div
                                className="text-center mt-10 md:mt-20 p-10 md:p-20 bg-[#0f0f0f] rounded-[2rem] md:rounded-[3rem] border border-white/5 shadow-2xl">
                                <p className="text-gray-500 mb-8 font-black uppercase tracking-widest text-xs md:text-sm">Baza
                                    jest pusta.</p>
                                <button onClick={() => setIsModalOpen(true)}
                                        className="w-full sm:w-auto bg-white text-black font-black uppercase text-[10px] md:text-xs tracking-widest px-8 py-4 md:px-10 md:py-5 rounded-xl md:rounded-2xl hover:bg-green-500 transition-all">
                                    Stwórz pierwsze wydarzenie
                                </button>
                            </div>
                        )}

                        {!loading && !error && events.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 md:gap-8">
                                {events.map((event) => (
                                    <div key={event.id} onClick={() => navigate(`/events/${event.id}`)}
                                         className="group bg-[#0f0f0f] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 hover:border-green-500/30 hover:bg-[#151515] transition-all cursor-pointer relative overflow-hidden shadow-2xl">
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-6">
                                                <div
                                                    className="w-10 h-10 md:w-12 md:h-12 bg-black rounded-xl flex items-center justify-center text-lg md:text-xl grayscale group-hover:grayscale-0 transition-all">🗺️
                                                </div>
                                                <span
                                                    className="text-[8px] md:text-[9px] font-black text-gray-700 uppercase tracking-widest bg-black px-3 py-1 rounded-full border border-white/5">ID: {event.id}</span>
                                            </div>
                                            <h2 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase mb-3 group-hover:text-green-500 transition-colors">
                                                {event.title}
                                            </h2>
                                            {event.description && (
                                                <p className="text-gray-500 text-[10px] md:text-xs font-bold leading-relaxed line-clamp-2 mb-8">
                                                    {event.description}
                                                </p>
                                            )}
                                            <div
                                                className="pt-6 border-t border-white/5 flex justify-between items-center">
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/events/${event.id}/map`);
                                                }}
                                                        className="text-[8px] md:text-[9px] font-black uppercase tracking-widest bg-black hover:bg-green-600 px-4 py-2 rounded-xl transition-all border border-white/10">
                                                    Mapa 📍
                                                </button>
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

                {/* PRAWA KOLUMNA: SIDEBAR ZNAJOMYCH */}
                {/* RWD: Na telefonie ma sztywną wysokość np. 500px, na PC rozciąga się na h-full */}
                <div className="w-full xl:w-[450px] shrink-0 flex flex-col h-[500px] xl:h-full pb-8 xl:pb-0">
                    <div
                        className="bg-[#0f0f0f] rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col flex-1 min-h-0">

                        <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase mb-6 shrink-0">Twoja <span
                            className="text-green-500">Ekipa.</span></h2>

                        {/* Zakładki */}
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
                                {pendingRequests.length > 0 && <span
                                    className="bg-green-600 text-white px-2 py-0.5 rounded-full text-[8px]">{pendingRequests.length}</span>}
                            </button>
                        </div>

                        {/* Zawartość zakładek */}
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {activeFriendTab === 'list' && (
                                <div className="space-y-6">

                                    {/* NOWA SEKCJA WYSZUKIWARKI I ZAPRASZANIA */}
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

                                        {/* DROPDOWN PODPOWIEDZI */}
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
                                                            {/* Awatar z Twojej funkcji renderującej */}
                                                            {renderAvatar(user.profile_image, user.username, "w-10 h-10")}
                                                            <div>
                                                                <p className="font-bold text-sm text-gray-200 group-hover:text-green-500 transition-colors">{user.username}</p>
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mt-1">{user.email}</p>
                                                            </div>
                                                        </div>
                                                        <span
                                                            className="text-[10px] font-black uppercase tracking-widest text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            Zaproś +
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3 pb-4">
                                        {friends.length === 0 ? (
                                            <p className="text-gray-600 text-center text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-10">Brak
                                                znajomych na liście</p>
                                        ) : (
                                            friends.map(friend => (
                                                <div key={friend.id}
                                                     className="bg-black p-4 rounded-xl md:rounded-2xl border border-white/5 flex items-center gap-4">
                                                    {renderAvatar(friend.profile_image, friend.username)} {/* Zamiast starego div */}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-xs md:text-sm text-gray-200 truncate">{friend.username}</p>
                                                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-600 truncate">{friend.email}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeFriendTab === 'pending' && (
                                <div className="space-y-3 pb-4">
                                    {pendingRequests.length === 0 ? (
                                        <p className="text-gray-600 text-center text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-10">Brak
                                            oczekujących zaproszeń</p>
                                    ) : (
                                        pendingRequests.map(req => (
                                            <div key={req.friendship_id}
                                                 className="bg-black p-4 rounded-xl md:rounded-2xl border border-white/5 flex flex-col gap-3">
                                                <div className="flex items-center gap-3">
                                                    {renderAvatar(req.user.profile_image, req.user.username, "w-8 h-8")} {/* Dodane zdjęcie */}
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
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* MODAL: TWORZENIE WYDARZENIA */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200] backdrop-blur-xl">
                    <div
                        className="bg-[#0f0f0f] rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 w-full max-w-md border border-white/10 shadow-2xl relative">
                        <button onClick={() => setIsModalOpen(false)}
                                className="absolute top-4 md:top-6 right-6 md:right-8 text-gray-500 hover:text-white font-bold text-xl">✕
                        </button>
                        <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-center mb-6 md:mb-8">Nowy <span
                            className="text-green-500">Projekt.</span></h2>
                        <form onSubmit={handleCreateEvent} className="space-y-4 md:space-y-6">
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
                                    className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2 mb-2 block">Krótki
                                    opis</label>
                                <textarea
                                    rows={3}
                                    className="w-full bg-black border border-white/5 rounded-xl md:rounded-2xl px-5 py-3 md:px-6 md:py-4 outline-none focus:border-green-500/50 transition-all font-bold text-xs md:text-sm text-gray-200 resize-none"
                                    placeholder="O czym warto pamiętać?"
                                    value={newEventData.description}
                                    onChange={(e) => setNewEventData({...newEventData, description: e.target.value})}
                                />
                            </div>
                            <div className="pt-2">
                                <button type="submit"
                                        className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[9px] md:text-[10px] tracking-widest py-4 md:py-5 rounded-xl md:rounded-2xl shadow-xl shadow-green-900/20 transition-all">
                                    Zapisz
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: POWIADOMIENIA */}
            {isNotifOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-end p-4 md:p-6 z-[200]">
                    <div
                        className="bg-[#0f0f0f] rounded-[2rem] p-6 w-full max-w-sm border border-white/10 shadow-2xl mt-16 md:mt-20 relative animate-in slide-in-from-right-8 fade-in">
                        <button onClick={() => setIsNotifOpen(false)}
                                className="absolute top-6 right-6 text-gray-500 hover:text-white font-bold">✕
                        </button>
                        <h3 className="text-lg md:text-xl font-black italic tracking-tighter uppercase mb-6 border-b border-white/5 pb-4">Aktualności</h3>

                        <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <p className="text-gray-600 text-center text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-10">Wszystko
                                    przeczytane</p>
                            ) : (
                                notifications.map(notif => (
                                    <div key={notif.id}
                                         className={`p-4 rounded-xl md:rounded-2xl border transition-all cursor-default ${notif.is_read ? 'bg-black border-transparent opacity-50' : 'bg-[#151515] border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.05)]'}`}>
                                        <p className="text-[10px] md:text-xs text-gray-300 font-medium mb-3">{notif.message}</p>
                                        <div className="flex justify-between items-center">
                                            <span
                                                className="text-[8px] font-black uppercase tracking-widest text-gray-600">
                                                {new Date(notif.created_at).toLocaleDateString()}
                                            </span>
                                            {!notif.is_read && (
                                                <button
                                                    onClick={() => handleMarkAsRead(notif.id)}
                                                    className="text-[8px] font-black uppercase tracking-widest text-green-500 hover:text-green-400"
                                                >
                                                    ✓ Zrozumiałem
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
            {isEditModalOpen && (
                <div
                    className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[210] backdrop-blur-xl">
                    <div
                        className="bg-[#0f0f0f] rounded-[2rem] p-8 w-full max-w-md border border-white/10 shadow-2xl relative">
                        <button onClick={() => setIsEditModalOpen(false)}
                                className="absolute top-6 right-6 text-gray-500 hover:text-white">✕
                        </button>
                        <h2 className="text-2xl font-black italic uppercase text-center mb-8">Edytuj <span
                            className="text-green-500">Profil.</span></h2>

                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            {/* Zmiana zdjęcia */}
                            <div className="flex flex-col items-center mb-6">
                                <div
                                    onClick={() => editFileInputRef.current.click()}
                                    className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-dashed border-white/10 hover:border-green-500 cursor-pointer transition-all"
                                >
                                    {editFile ? (
                                        <img src={URL.createObjectURL(editFile)}
                                             className="w-full h-full object-cover"/>
                                    ) : (
                                        renderAvatar(profileImage, username, "w-full h-full")
                                    )}
                                </div>
                                <p className="text-[8px] font-black uppercase tracking-widest text-gray-600 mt-2">Kliknij
                                    by zmienić foto</p>
                                <input type="file" ref={editFileInputRef} className="hidden"
                                       onChange={(e) => setEditFile(e.target.files[0])}/>
                            </div>

                            <input
                                type="text" placeholder="Nazwa użytkownika"
                                className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm"
                                value={editData.username}
                                onChange={(e) => setEditData({...editData, username: e.target.value})}
                            />

                            {/* EMAIL + POWTÓRZENIE */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input
                                    type="email" placeholder="Nowy email"
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-3 outline-none focus:border-green-500/50 transition-all font-bold text-xs"
                                    value={editData.email}
                                    onChange={(e) => setEditData({...editData, email: e.target.value})}
                                />
                                <input
                                    type="email" placeholder="Powtórz email"
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-3 outline-none focus:border-green-500/50 transition-all font-bold text-xs"
                                    value={editData.confirmEmail}
                                    onChange={(e) => setEditData({...editData, confirmEmail: e.target.value})}
                                />
                            </div>

                            {/* HASŁO + POWTÓRZENIE */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input
                                    type="password" placeholder="Nowe hasło"
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-3 outline-none focus:border-green-500/50 transition-all font-bold text-xs"
                                    onChange={(e) => setEditData({...editData, password: e.target.value})}
                                />
                                <input
                                    type="password" placeholder="Powtórz hasło"
                                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-3 outline-none focus:border-green-500/50 transition-all font-bold text-xs"
                                    onChange={(e) => setEditData({...editData, confirmPassword: e.target.value})}
                                />
                            </div>

                            <button type="submit"
                                    className="w-full bg-green-600 text-white font-black uppercase text-[10px] py-5 rounded-2xl hover:bg-green-500 transition-all mt-4">
                                Zaktualizuj Profil
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}