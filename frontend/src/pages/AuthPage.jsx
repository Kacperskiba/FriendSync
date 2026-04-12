import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // --- NOWY IMPORT ---

const API_URL = "http://127.0.0.1:8000/api/users";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate(); // --- INICJALIZACJA NAWIGACJI ---

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
        params.append('username', formData.email); // FastAPI oczekuje klucza 'username' w OAuth2
        params.append('password', formData.password);

        const res = await axios.post(`${API_URL}/login`, params);
        localStorage.setItem('token', res.data.access_token);

        // Zamiast tylko wyświetlać alert, przenosimy użytkownika do aplikacji!
        navigate('/dashboard');

      } else {
        // REJESTRACJA
        await axios.post(`${API_URL}/register`, {
          email: formData.email,
          username: formData.username,
          password: formData.password
        });
        alert("Konto stworzone! Możesz się zalogować.");
        setIsLogin(true); // Automatycznie wracamy na ekran logowania
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-sans text-white">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            FriendSync
          </h1>
          <p className="text-gray-400 mt-2">
            {isLogin ? "Witaj ponownie!" : "Dołącz do nas już dziś"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* --- POLA TYLKO DLA LOGOWANIA --- */}
          {isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email / Login</label>
              <input
                name="email"
                type="text"
                required
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="email@example.com lub TwojaNazwa"
                onChange={handleChange}
              />
            </div>
          )}

          {/* --- POLA TYLKO DLA REJESTRACJI --- */}
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="email@example.com"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nazwa użytkownika</label>
                <input
                  name="username"
                  type="text"
                  required
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="TwojaUnikalnaNazwa"
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          {/* --- WSPÓLNE POLE HASŁA --- */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Hasło</label>
            <input
              name="password"
              type="password"
              required
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="••••••••"
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-lg shadow-lg transform transition active:scale-95"
          >
            {isLogin ? "Zaloguj się" : "Utwórz konto"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isLogin ? "Nie masz konta? Zarejestruj się" : "Masz już konto? Zaloguj się"}
          </button>
        </div>
      </div>
    </div>
  );
}