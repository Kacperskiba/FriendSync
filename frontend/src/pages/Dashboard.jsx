import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = "http://127.0.0.1:8000/api/events";

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Sprawdzamy czy użytkownik ma "bilet" (token)
    const token = localStorage.getItem('token');

    // Jeśli nie ma tokena, wyrzucamy go z powrotem na stronę logowania
    if (!token) {
      navigate('/');
      return;
    }

    // 2. Jeśli mamy token, uderzamy do backendu po wydarzenia
    const fetchEvents = async () => {
      try {
        const response = await axios.get(API_URL, {
          // Musimy "pokazać" nasz bilet bramkarzowi (FastAPI) w nagłówku
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setEvents(response.data);
      } catch (err) {
        console.error("Błąd pobierania wydarzeń:", err);
        setError("Nie udało się załadować wydarzeń. Możliwe, że sesja wygasła.");
        // W razie błędu autoryzacji (np. wygasły token), bezpiecznie czyścimy localStorage i wylogowujemy
        if (err.response?.status === 401) {
             localStorage.removeItem('token');
             navigate('/');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
      {/* Pasek nawigacji górnej */}
      <div className="flex justify-between items-center mb-10 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Moje Wydarzenia
        </h1>
        <button
          onClick={handleLogout}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors border border-gray-700"
        >
          Wyloguj się
        </button>
      </div>

      {/* Główna zawartość */}
      <div className="max-w-5xl mx-auto">
        {loading && <p className="text-gray-400 animate-pulse text-center mt-10">Ładowanie Twoich planów...</p>}
        {error && <p className="text-red-400 text-center mt-10">{error}</p>}

        {!loading && !error && events.length === 0 && (
          <div className="text-center mt-20 p-10 bg-gray-800 rounded-2xl border border-gray-700">
             <p className="text-gray-400 mb-4 text-lg">Wygląda na to, że masz wolny kalendarz!</p>
             {/* Tutaj w przyszłości dodamy przycisk do tworzenia nowego wydarzenia */}
             <button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
               Utwórz pierwsze wydarzenie
             </button>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-gray-500 transition-colors cursor-pointer"
              >
                <h2 className="text-xl font-bold mb-2">{event.title}</h2>
                {event.description && <p className="text-gray-400 text-sm line-clamp-2">{event.description}</p>}

                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center text-xs text-gray-500">
                    <span>ID: {event.id}</span>
                    <span>Utworzono: {new Date(event.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}