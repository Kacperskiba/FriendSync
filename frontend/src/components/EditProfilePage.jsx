import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { ArrowLeft } from 'lucide-react';
import Navbar from './Navbar';

export default function EditProfilePage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Stan formularza
    const [profileData, setProfileData] = useState({
        username: '',
        email: '',
        confirmEmail: '',
        bio: '',
        tags: '',
        currentPassword: '',
        password: '',
        confirmPassword: ''
    });

    const [currentImage, setCurrentImage] = useState(null);
    const [newFile, setNewFile] = useState(null);
    const fileInputRef = useRef(null);

    const token = localStorage.getItem('token');

    // Pobranie aktualnych danych użytkownika przy wejściu na stronę
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // Ustawiamy dane pobrane z backendu
                setProfileData(prev => ({
                    ...prev,
                    username: res.data.username,
                    // Emaila nie wpisujemy domyślnie w pola "nowy email",
                    // żeby użytkownik wiedział, że są to pola do zmiany
                    bio: res.data.bio || '',
                    tags: res.data.tags || ''
                }));
                setCurrentImage(res.data.profile_image);
                setLoading(false);
            } catch (err) {
                console.error("Błąd pobierania danych", err);
                // Jeśli token wygasł lub jest błąd, wróć do logowania/dashboardu
                navigate('/dashboard');
            }
        };

        if (token) {
            fetchUserData();
        } else {
            navigate('/');
        }
    }, [token, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prosta walidacja przed wysyłką
        if (profileData.email && profileData.email !== profileData.confirmEmail) {
            alert("Podane adresy email nie są identyczne!");
            return;
        }
        if (profileData.password && profileData.password !== profileData.confirmPassword) {
            alert("Hasła nie są identyczne!");
            return;
        }

        const formData = new FormData();

        // Zawsze wysyłamy nazwę użytkownika, bio i tagi
        formData.append('username', profileData.username);
        formData.append('bio', profileData.bio);
        formData.append('tags', profileData.tags);

        // Backend wymaga potwierdzenia obecnym hasłem dla zmiany emaila/hasła
        const sensitiveChange = !!profileData.email || !!profileData.password;
        if (sensitiveChange) {
            if (!profileData.currentPassword) {
                alert("Wpisz obecne hasło, aby zmienić email lub hasło.");
                return;
            }
            formData.append('current_password', profileData.currentPassword);
        }

        // Dodajemy email tylko jeśli użytkownik coś wpisał
        if (profileData.email) {
            formData.append('email', profileData.email);
            formData.append('confirm_email', profileData.confirmEmail);
        }

        // Dodajemy hasło tylko jeśli użytkownik coś wpisał
        if (profileData.password) {
            formData.append('password', profileData.password);
            formData.append('confirm_password', profileData.confirmPassword);
        }

        // Dodajemy zdjęcie jeśli zostało wybrane
        if (newFile) {
            formData.append('profile_image', newFile);
        }

        try {
            await axios.patch(`${API_BASE_URL}/api/users/me`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert("Profil zaktualizowany pomyślnie!");
            navigate('/dashboard');
        } catch (err) {
            const errorMsg = err.response?.data?.detail || "Wystąpił błąd podczas zapisu.";
            alert(errorMsg);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-white font-black italic uppercase tracking-widest">
            Wczytywanie profilu...
        </div>
    );

    return (
        <>
            <Navbar>
                <button
                    onClick={() => navigate('/dashboard')}
                    title="Powrót do pulpitu"
                    className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border border-white/5 transition-all shadow-lg flex items-center gap-2"
                >
                    <ArrowLeft size={16} /> <span className="hidden sm:inline">Powrót</span>
                </button>
            </Navbar>

            <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 font-sans">
                <div className="max-w-2xl mx-auto mt-10 relative">

                    {/* Efekt tła (Blur) */}
                    <div className="absolute -top-20 -left-20 w-64 h-64 bg-green-500/10 blur-[100px] rounded-full pointer-events-none"></div>

                <h1 className="text-4xl md:text-5xl font-black italic uppercase mb-10 tracking-tighter">
                    Edytuj <span className="text-green-500 font-black">Profil.</span>
                </h1>

                <form onSubmit={handleSubmit} className="relative z-10 space-y-6 md:space-y-8 bg-[#0f0f0f] p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 shadow-2xl">

                    {/* SEKCJA: AVATAR */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 mb-10 pb-10 border-b border-white/5">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current.click()}>
                            {newFile || currentImage ? (
                                <img
                                    src={newFile ? URL.createObjectURL(newFile) : `${API_BASE_URL}/${currentImage}`}
                                    className="w-32 h-32 rounded-3xl object-cover border-2 border-green-500/30 shadow-xl group-hover:brightness-50 transition-all"
                                    alt="Avatar"
                                />
                            ) : (
                                <div className="w-32 h-32 bg-green-600 rounded-3xl flex items-center justify-center text-5xl font-black italic uppercase">
                                    {profileData.username[0]}
                                </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className="text-[10px] font-black uppercase tracking-widest bg-black/60 px-3 py-1 rounded-full">Zmień</span>
                            </div>
                        </div>
                        <input
                            type="file" ref={fileInputRef} hidden
                            onChange={(e) => setNewFile(e.target.files[0])}
                            accept="image/*"
                        />
                        <div className="text-center sm:text-left">
                            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Twoje zdjęcie</p>
                            <p className="text-[9px] text-gray-600 uppercase mt-2 leading-relaxed">
                                Kliknij awatar, aby przesłać nowe zdjęcie.<br/>
                            </p>
                        </div>
                    </div>

                    {/* SEKCJA: DANE PUBLICZNE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-500 ml-2 tracking-widest">Nick</label>
                            <input
                                className="w-full bg-black border border-white/5 rounded-xl px-5 py-4 text-xs font-bold outline-none focus:border-green-500/50 transition-all"
                                value={profileData.username}
                                onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-500 ml-2 tracking-widest text-green-500/50">Tagi (po przecinku)</label>
                            <input
                                className="w-full bg-black border border-white/5 rounded-xl px-5 py-4 text-xs font-bold outline-none focus:border-green-500/50 transition-all text-green-500"
                                placeholder="piwo, gokarty, góry..."
                                value={profileData.tags}
                                onChange={(e) => setProfileData({...profileData, tags: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-500 ml-2 tracking-widest">O Tobie (Bio)</label>
                        <textarea
                            rows="3"
                            className="w-full bg-black border border-white/5 rounded-xl px-5 py-4 text-xs font-bold outline-none focus:border-green-500/50 transition-all resize-none leading-relaxed"
                            placeholder="Napisz coś ciekawego o sobie..."
                            value={profileData.bio}
                            onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                        />
                    </div>

                    {/* SEKCJA: DANE WRAŻLIWE (Email i Hasło) */}
                    <div className="pt-8 border-t border-white/5 space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-white/5"></div>
                            <p className="text-[10px] font-black uppercase text-gray-600 tracking-[0.3em]">Bezpieczeństwo</p>
                            <div className="h-px flex-1 bg-white/5"></div>
                        </div>

                        {/* Email */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-gray-600 ml-2">Nowy E-mail</label>
                                <input
                                    type="email" placeholder="nowy@email.com"
                                    className="w-full bg-black border border-white/5 rounded-xl px-5 py-3 text-[11px] font-bold outline-none focus:border-green-500/50 transition-all"
                                    value={profileData.email}
                                    onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-gray-600 ml-2">Potwierdź E-mail</label>
                                <input
                                    type="email" placeholder="potwierdź@email.com"
                                    className="w-full bg-black border border-white/5 rounded-xl px-5 py-3 text-[11px] font-bold outline-none focus:border-green-500/50 transition-all"
                                    value={profileData.confirmEmail}
                                    onChange={(e) => setProfileData({...profileData, confirmEmail: e.target.value})}
                                />
                            </div>
                        </div>

                        {/* Obecne hasło — wymagane do zmiany emaila/hasła */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-gray-600 ml-2">Obecne hasło (wymagane do zmiany emaila/hasła)</label>
                            <input
                                type="password" placeholder="••••••••"
                                autoComplete="current-password"
                                className="w-full bg-black border border-white/5 rounded-xl px-5 py-3 text-[11px] outline-none focus:border-green-500/50 transition-all"
                                value={profileData.currentPassword}
                                onChange={(e) => setProfileData({...profileData, currentPassword: e.target.value})}
                            />
                        </div>

                        {/* Hasło */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-gray-600 ml-2">Nowe Hasło</label>
                                <input
                                    type="password" placeholder="••••••••"
                                    className="w-full bg-black border border-white/5 rounded-xl px-5 py-3 text-[11px] outline-none focus:border-red-500/50 transition-all"
                                    value={profileData.password}
                                    onChange={(e) => setProfileData({...profileData, password: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-gray-600 ml-2">Potwierdź Hasło</label>
                                <input
                                    type="password" placeholder="••••••••"
                                    className="w-full bg-black border border-white/5 rounded-xl px-5 py-3 text-[11px] outline-none focus:border-red-500/50 transition-all"
                                    value={profileData.confirmPassword}
                                    onChange={(e) => setProfileData({...profileData, confirmPassword: e.target.value})}
                                />
                            </div>
                        </div>
                        <p className="text-[8px] text-gray-700 uppercase text-center font-bold tracking-widest italic">
                            Wypełnij poniższe pola tylko jeśli chcesz wprowadzić zmiany
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-xs tracking-[0.3em] py-5 rounded-2xl transition-all shadow-2xl shadow-green-900/20 active:scale-[0.98]"
                    >
                        Zapisz wszystkie zmiany
                    </button>
                </form>
            </div>
            </div>
        </>
    );
}