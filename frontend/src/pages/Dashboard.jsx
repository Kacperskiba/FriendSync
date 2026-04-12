import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = "http://127.0.0.1:8000/api/events";

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- NOWE STANY DO OBSŁUGI MODALA ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventData, setNewEventData] = useState({ title: '', description: '' });

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    const fetchEvents = async () => {
      try {
        const response = await axios.get(API_URL, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEvents(response.data);
      } catch (err) {
        console.error("Błąd pobierania wydarzeń:", err);
        setError("Nie udało się załadować wydarzeń. Możliwe, że sesja wygasła.");
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

  // --- NOWA FUNKCJA: TWORZENIE WYDARZENIA ---
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const response = await axios.post(API_URL, newEventData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Dodajemy nowo utworzone wydarzenie do obecnej listy na ekranie!
      setEvents([...events, response.data]);

      // Zamykamy modal i czyścimy formularz
      setIsModalOpen(false);
      setNewEventData({ title: '', description: '' });
    } catch (err) {
      console.error("Błąd podczas tworzenia:", err);
      alert("Nie udało się utworzyć wydarzenia.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans relative">

      {/* Pasek nawigacji górnej */}
      <div className="flex justify-between items-center mb-10 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Moje Wydarzenia
        </h1>
        <div className="flex gap-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-lg"
          >
            + Nowe Wydarzenie
          </button>
          <button
            onClick={handleLogout}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors border border-gray-700"
          >
            Wyloguj się
          </button>
        </div>
      </div>

      {/* Główna zawartość */}
      <div className="max-w-5xl mx-auto">
        {loading && <p className="text-gray-400 animate-pulse text-center mt-10">Ładowanie Twoich planów...</p>}
        {error && <p className="text-red-400 text-center mt-10">{error}</p>}

        {!loading && !error && events.length === 0 && (
          <div className="text-center mt-20 p-10 bg-gray-800 rounded-2xl border border-gray-700">
             <p className="text-gray-400 mb-4 text-lg">Wygląda na to, że masz wolny kalendarz!</p>
             <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
             >
               Utwórz pierwsze wydarzenie
             </button>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all cursor-pointer group"
              >
                <h2 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">{event.title}</h2>
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

      {/* --- WYSKAKUJĄCY MODAL DO TWORZENIA --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">Utwórz nowe wydarzenie</h2>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Tytuł wyjazdu / spotkania</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="np. Wypad w Tatry"
                  value={newEventData.title}
                  onChange={(e) => setNewEventData({...newEventData, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Opis (opcjonalnie)</label>
                <textarea
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Zabieramy namioty i dużo jedzenia!"
                  value={newEventData.description}
                  onChange={(e) => setNewEventData({...newEventData, description: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-colors shadow-lg"
                >
                  Zapisz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}