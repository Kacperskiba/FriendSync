import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ChevronDown, Settings, User, LogOut } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { useWebSocket } from './WebSocketContext';
import { notifyUserChanged } from '../services/preferences';

// Globalny pasek nawigacji widoczny na każdej stronie po zalogowaniu.
// Stałe elementy: logo FriendSync (lewo) i menu użytkownika z avatarem (prawo).
// Akcje specyficzne dla danej strony przekazujemy przez `children` — każda
// strona wstawia tu swój własny zestaw przycisków (np. czat, portfel, powrót).
export default function Navbar({ children, leftActions }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { disconnect, isConnected } = useWebSocket();
    const menuRef = useRef(null);

    const [username, setUsername] = useState(localStorage.getItem('username') || 'Użytkownik');
    const [profileImage, setProfileImage] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Pobierz profil zalogowanego użytkownika. Odświeżamy przy każdej zmianie
    // trasy, dzięki czemu avatar/nick są aktualne np. po edycji profilu.
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        axios.get(`${API_BASE_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
            setUsername(res.data.username);
            setProfileImage(res.data.profile_image);
            localStorage.setItem('username', res.data.username);
        }).catch(() => {});
    }, [location.pathname]);

    // Zamknij menu po kliknięciu poza nim.
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        disconnect(); // zamknij WS → backend ustawi offline
        setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            notifyUserChanged();
            navigate('/');
        }, 300);
    };

    const renderAvatar = () => (
        <div className="relative shrink-0">
            {profileImage ? (
                <img
                    src={`${API_BASE_URL}/${profileImage}`}
                    alt={username}
                    className="w-10 h-10 rounded-xl object-cover border border-white/10 shadow-lg"
                    onError={(e) => { e.target.src = ''; e.target.classList.add('hidden'); }}
                />
            ) : (
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center font-black italic shadow-lg text-white">
                    {username ? username.substring(0, 1).toUpperCase() : '?'}
                </div>
            )}
            {/* Kropka aktywności: zielona+puls gdy WS połączony, czerwona gdy nie */}
            <div
                className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0f0f0f] shadow-sm transition-colors duration-500 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
            ></div>
        </div>
    );

    return (
        <nav className="sticky top-0 z-[150] bg-[#050505] text-white">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-3 lg:py-0 lg:h-20 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 md:gap-4">
                {/* Logo + akcje przyklejone do lewej strony */}
                <div className="flex items-center gap-3 md:gap-4">
                    <Link
                        to="/dashboard"
                        className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase shrink-0 hover:opacity-80 transition-opacity"
                    >
                        Friend <span className="text-green-500 font-black">Sync.</span>
                    </Link>
                    {leftActions}
                </div>

                {/* Akcje danej strony + menu użytkownika */}
                <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
                    {children}

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center gap-3 bg-[#0f0f0f] border border-white/5 p-2 pr-3 sm:pr-5 rounded-xl md:rounded-2xl hover:border-white/20 transition-all shadow-xl"
                        >
                            {renderAvatar()}
                            <span className="hidden sm:block text-[10px] font-black uppercase tracking-widest max-w-[140px] truncate">
                                {username}
                            </span>
                            <ChevronDown
                                size={14}
                                className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-4 w-56 bg-[#0f0f0f] border border-white/10 rounded-2xl md:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden py-3 animate-in fade-in slide-in-from-top-2 duration-200 z-[200]">
                                <div className="px-6 py-4 border-b border-white/5 mb-2">
                                    <p className="text-[8px] font-black uppercase text-gray-600 tracking-[0.2em] mb-1">
                                        Zalogowany jako
                                    </p>
                                    <p className="text-xs font-black italic text-green-500 truncate">{username}</p>
                                </div>
                                <button
                                    onClick={() => { setIsMenuOpen(false); navigate('/settings'); }}
                                    className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3"
                                >
                                    <Settings size={14} /> Ustawienia
                                </button>
                                <button
                                    onClick={() => { setIsMenuOpen(false); navigate('/edit-profile'); }}
                                    className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3"
                                >
                                    <User size={14} /> Edytuj Profil
                                </button>
                                <div className="h-px bg-white/5 my-2 mx-4"></div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-3"
                                >
                                    <LogOut size={14} /> Wyloguj się
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
