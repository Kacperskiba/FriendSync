import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = "http://127.0.0.1:8000/api/users";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        // LOGOWANIE
        const params = new URLSearchParams();
        params.append('username', formData.email);
        params.append('password', formData.password);

        const res = await axios.post(`${API_URL}/login`, params);
        localStorage.setItem('token', res.data.access_token);
        navigate('/dashboard');

      } else {
        // REJESTRACJA
        await axios.post(`${API_URL}/register`, {
          email: formData.email,
          username: formData.username,
          password: formData.password
        });
        alert("Konto stworzone! Możesz się zalogować.");
        setIsLogin(true);
      }
    } catch (err) {
      console.error("Pełny błąd z serwera:", err.response?.data);
      let message = "Coś poszło nie tak";
      const detail = err.response?.data?.detail;

      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail.map(d => `${d.loc[1]}: ${d.msg}`).join(", ");
      }

      alert("Błąd: " + message);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans text-white">
      <div className="max-w-md w-full bg-[#0f0f0f] rounded-[3rem] shadow-[0_20px_80px_rgba(0,0,0,0.8)] p-10 border border-white/5 relative overflow-hidden">

        {/* Dekoracyjny blask w tle */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-500/5 blur-[100px] rounded-full"></div>

        <div className="text-center mb-12">
          <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-2">
            Friend<span className="text-green-500">Sync.</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600">
            {isLogin ? "System Autoryzacji" : "Dołącz do ekipy"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* --- POLA TYLKO DLA LOGOWANIA --- */}
          {isLogin && (
            <div className="group">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-2 mb-2 block group-focus-within:text-green-500 transition-colors">
                Email / Login
              </label>
              <input
                name="email"
                type="text"
                required
                className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm text-gray-200 shadow-inner"
                placeholder="Twój login"
                onChange={handleChange}
              />
            </div>
          )}

          {/* --- POLA TYLKO DLA REJESTRACJI --- */}
          {!isLogin && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-2 mb-2 block">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm text-gray-200 shadow-inner"
                  placeholder="email@example.com"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-2 mb-2 block">Nazwa użytkownika</label>
                <input
                  name="username"
                  type="text"
                  required
                  className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm text-gray-200 shadow-inner"
                  placeholder="TwojaNazwa"
                  onChange={handleChange}
                />
              </div>
            </div>
          )}

          {/* --- WSPÓLNE POLE HASŁA --- */}
          <div className="group">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 ml-2 mb-2 block group-focus-within:text-green-500 transition-colors">
              Hasło
            </label>
            <input
              name="password"
              type="password"
              required
              className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm text-gray-200 shadow-inner"
              placeholder="••••••••"
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[11px] tracking-[0.2em] py-5 rounded-2xl shadow-[0_10px_40px_rgba(34,197,94,0.2)] transition-all active:scale-[0.97] mt-8"
          >
            {isLogin ? "Zaloguj do bazy" : "Stwórz profil"}
          </button>
        </form>

        <div className="mt-10 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-colors"
          >
            {isLogin ? "Brak konta? Zarejestruj się" : "Masz konto? Wróć do logowania"}
          </button>
        </div>
      </div>
    </div>
  );
}