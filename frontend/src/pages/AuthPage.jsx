import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = "http://127.0.0.1:8000/api/users";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLogin && formData.password !== formData.confirmPassword) {
      alert("Hasła nie są identyczne!");
      return;
    }

    try {
      if (isLogin) {
        const params = new URLSearchParams();
        params.append('username', formData.email);
        params.append('password', formData.password);
        const res = await axios.post(`${API_URL}/login`, params);
        localStorage.setItem('token', res.data.access_token);
        navigate('/dashboard');
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
      <div className="max-w-md w-full bg-[#0f0f0f] rounded-[3rem] p-10 border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">
            Friend<span className="text-green-500">Sync.</span>
          </h1>
        </div>

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
            <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Email / Login</label>
            <input name="email" type="text" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm" onChange={handleChange} />
          </div>

          {!isLogin && (
            <div>
              <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Nazwa użytkownika</label>
              <input name="username" type="text" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm" onChange={handleChange} />
            </div>
          )}

          <div>
            <label className="text-[9px] font-black uppercase text-gray-500 ml-2 mb-1 block italic">Hasło</label>
            <input name="password" type="password" required className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-green-500/50 transition-all font-bold text-sm" onChange={handleChange} />
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
        </form>

        <div className="mt-8 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors">
            {isLogin ? "Brak konta? Zarejestruj się" : "Masz konto? Zaloguj się"}
          </button>
        </div>
      </div>
    </div>
  );
}