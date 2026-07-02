import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

const API_URL = `${API_BASE_URL}/api/users`;

export default function ResetPasswordPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Hasła nie są identyczne!");
            return;
        }
        // Soft-walidacja jak przy rejestracji — backend i tak waliduje twardo.
        const classes = (/[a-z]/.test(password) ? 1 : 0) + (/[A-Z]/.test(password) ? 1 : 0)
                      + (/\d/.test(password) ? 1 : 0) + (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
        if (password.length < 10 || classes < 3) {
            setError("Hasło musi mieć min. 10 znaków i zawierać co najmniej 3 z 4: małą literę, dużą literę, cyfrę, znak specjalny.");
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.post(`${API_URL}/reset-password`, { token, new_password: password });
            setIsDone(true);
        } catch (err) {
            setError(err.response?.data?.detail || "Nie udało się zmienić hasła.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans text-white">
            <div className="max-w-md w-full bg-[#0f0f0f] rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-white/5 relative overflow-hidden shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">
                        Friend<span className="text-green-500">Sync.</span>
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Nowe hasło</p>
                </div>

                {isDone ? (
                    <div className="space-y-5 text-center">
                        <p className="text-xs font-bold text-gray-300 leading-relaxed">
                            Hasło zostało zmienione. Możesz się teraz zalogować.
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[11px] tracking-widest py-5 rounded-2xl transition-all shadow-lg shadow-green-900/20"
                        >
                            Przejdź do logowania
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Nowe hasło</label>
                            <input
                                type="password" required autoComplete="new-password" minLength={10}
                                className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm"
                                value={password} onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Powtórz nowe hasło</label>
                            <input
                                type="password" required autoComplete="new-password"
                                className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm"
                                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <p className="text-red-400 font-bold text-xs text-center">{error}</p>
                        )}

                        <button
                            type="submit" disabled={isSubmitting}
                            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black uppercase text-[11px] tracking-widest py-5 rounded-2xl transition-all shadow-lg shadow-green-900/20"
                        >
                            {isSubmitting ? "Zapisywanie..." : "Ustaw nowe hasło"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
