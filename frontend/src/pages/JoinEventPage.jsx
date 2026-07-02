import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CalendarDays, Users, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

const API_URL = `${API_BASE_URL}/api/events`;

export default function JoinEventPage() {
    const { token: inviteToken } = useParams();
    const navigate = useNavigate();

    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    const [isJoining, setIsJoining] = useState(false);

    const authToken = localStorage.getItem('token');

    useEffect(() => {
        axios.get(`${API_URL}/join/${inviteToken}`)
            .then(res => setPreview(res.data))
            .catch(err => setError(err.response?.data?.detail || "Link zaproszeniowy jest nieprawidłowy lub wygasł."));
    }, [inviteToken]);

    const handleJoin = async () => {
        if (!authToken) {
            // Zapamiętujemy link i wysyłamy na logowanie — AuthPage wróci tu po zalogowaniu.
            sessionStorage.setItem('pending_invite', inviteToken);
            navigate('/');
            return;
        }
        setIsJoining(true);
        try {
            const res = await axios.post(`${API_URL}/join/${inviteToken}`, {}, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            sessionStorage.removeItem('pending_invite');
            navigate(`/events/${res.data.event_id}`);
        } catch (err) {
            setError(err.response?.data?.detail || "Nie udało się dołączyć do wydarzenia.");
            setIsJoining(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans text-white">
            <div className="max-w-md w-full bg-[#0f0f0f] rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-white/5 relative overflow-hidden shadow-2xl text-center">
                <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-8">
                    Friend<span className="text-green-500">Sync.</span>
                </h1>

                {error ? (
                    <>
                        <p className="text-red-400 font-bold text-sm mb-8">{error}</p>
                        <button
                            onClick={() => navigate(authToken ? '/dashboard' : '/')}
                            className="w-full bg-white/5 hover:bg-white/10 text-gray-300 font-black uppercase text-[11px] tracking-widest py-5 rounded-2xl transition-all"
                        >
                            Wróć do aplikacji
                        </button>
                    </>
                ) : !preview ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-green-500" size={32} />
                    </div>
                ) : (
                    <>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-3">
                            {preview.inviter.username} zaprasza Cię do wydarzenia
                        </p>
                        <h2 className="text-2xl font-black italic uppercase tracking-tight mb-4">{preview.event.title}</h2>

                        {preview.description && (
                            <p className="text-xs font-medium text-gray-400 leading-relaxed mb-6">{preview.description}</p>
                        )}

                        <div className="flex justify-center gap-6 mb-8 text-gray-400">
                            {preview.event.event_date && (
                                <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                    <CalendarDays size={14} className="text-green-500" />
                                    {new Date(preview.event.event_date).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                            )}
                            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                <Users size={14} className="text-green-500" />
                                {preview.participants_count} os.
                            </span>
                        </div>

                        <button
                            onClick={handleJoin}
                            disabled={isJoining}
                            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black uppercase text-[11px] tracking-widest py-5 rounded-2xl transition-all shadow-lg shadow-green-900/20"
                        >
                            {isJoining ? "Dołączanie..." : (authToken ? "Dołącz do wydarzenia" : "Zaloguj się, aby dołączyć")}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
