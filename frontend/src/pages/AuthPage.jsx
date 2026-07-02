import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { notifyUserChanged } from '../services/preferences';

const API_URL = `${API_BASE_URL}/api/users`;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/forgot-password`, { email: formData.email });
      setForgotEmailSent(true);
    } catch (err) {
      alert("Błąd: " + (err.response?.data?.detail || "Problem z serwerem"));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLogin && formData.password !== formData.confirmPassword) {
      alert("Hasła nie są identyczne!");
      return;
    }

    // Soft-walidacja po stronie klienta — backend i tak waliduje twardo.
    if (!isLogin) {
      const pw = formData.password || '';
      const classes = (/[a-z]/.test(pw) ? 1 : 0) + (/[A-Z]/.test(pw) ? 1 : 0)
                    + (/\d/.test(pw) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
      if (pw.length < 10 || classes < 3) {
        alert("Hasło musi mieć min. 10 znaków i zawierać co najmniej 3 z 4: małą literę, dużą literę, cyfrę, znak specjalny.");
        return;
      }
    }

    try {
      if (isLogin) {
        const params = new URLSearchParams();
        params.append('username', formData.email);
        params.append('password', formData.password);
        const res = await axios.post(`${API_URL}/login`, params);
        localStorage.setItem('token', res.data.access_token);
        notifyUserChanged();
        // Jeśli user trafił tu z linku zaproszeniowego — wróć na stronę dołączania.
        const pendingInvite = sessionStorage.getItem('pending_invite');
        navigate(pendingInvite ? `/join/${pendingInvite}` : '/dashboard');
      } else {
        // REJESTRACJA JAKO FORMDATA
        const data = new FormData();
        data.append('email', formData.email);
        data.append('username', formData.username);
        data.append('password', formData.password);
        if (profileImage) {
          data.append('profile_image', profileImage);
        }

        await axios.post(`${API_URL}/register`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert("Profil stworzony!");
        setIsLogin(true);
      }
    } catch (err) {
      alert("Błąd: " + (err.response?.data?.detail || "Problem z serwerem"));
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans text-white">
      <div className="max-w-md w-full bg-[#0f0f0f] rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">
            Friend<span className="text-green-500">Sync.</span>
          </h1>
        </div>

        {isForgotPassword ? (
          <div className="space-y-5">
            {forgotEmailSent ? (
              <>
                <p className="text-center text-xs font-bold text-gray-300 leading-relaxed">
                  Jeśli konto o podanym adresie istnieje, wysłaliśmy e-mail z linkiem do resetu hasła.
                  Sprawdź skrzynkę (także spam) — link jest ważny 30 minut.
                </p>
                <button
                  onClick={() => { setIsForgotPassword(false); setForgotEmailSent(false); }}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[11px] tracking-widest py-5 rounded-2xl transition-all shadow-lg shadow-green-900/20"
                >
                  Wróć do logowania
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Podaj e-mail konta, a wyślemy link do ustawienia nowego hasła.
                </p>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Email</label>
                  <input name="email" type="email" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm" onChange={handleChange} />
                </div>
                <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[11px] tracking-widest py-5 rounded-2xl transition-all shadow-lg shadow-green-900/20">
                  Wyślij link resetujący
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => setIsForgotPassword(false)} className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors">
                    Wróć do logowania
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="flex flex-col items-center mb-6">
              <div
                onClick={() => fileInputRef.current.click()}
                className="w-24 h-24 rounded-full bg-black border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-green-500/50 transition-all overflow-hidden mb-2"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-gray-500 font-black uppercase">Dodaj Foto</span>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          )}

          <div>
            <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Email</label>
            <input name="email" type="email" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm" onChange={handleChange} />
          </div>

          {!isLogin && (
            <div>
              <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Nazwa użytkownika</label>
              <input name="username" type="text" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm" onChange={handleChange} />
            </div>
          )}

          <div>
            <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Hasło</label>
            <input name="password" type="password" required autoComplete={isLogin ? "current-password" : "new-password"} minLength={isLogin ? undefined : 10} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm" onChange={handleChange} />
          </div>

          {!isLogin && (
            <div>
              <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Powtórz Hasło</label>
              <input name="confirmPassword" type="password" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm" onChange={handleChange} />
            </div>
          )}

          <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[11px] tracking-widest py-5 rounded-2xl transition-all shadow-lg shadow-green-900/20">
            {isLogin ? "Zaloguj się" : "Stwórz profil"}
          </button>

          {isLogin && (
            <div className="text-center">
              <button type="button" onClick={() => setIsForgotPassword(true)} className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-green-500 transition-colors">
                Zapomniałeś hasła?
              </button>
            </div>
          )}
        </form>
        )}

        {!isForgotPassword && (
        <div className="mt-8 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors">
            {isLogin ? "Brak konta? Zarejestruj się" : "Masz konto? Zaloguj się"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}