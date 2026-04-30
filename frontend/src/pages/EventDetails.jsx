import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = "http://127.0.0.1:8000/api/events";

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);

  // Stany UI
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [newMessage, setNewMessage] = useState('');

  // Pobieranie szczegółów wydarzenia i uczestników
  const fetchEventData = async () => {
    const token = localStorage.getItem('token');
    try {
      // Pobieramy info o wydarzeniu (tytuł, opis)
      const resEvent = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const currentEvent = resEvent.data.find(e => e.id === parseInt(id));
      setEvent(currentEvent);

      // Tu w przyszłości dodasz endpoint GET /api/events/{id}/participants
      // Na razie symulujemy listę lub pobieramy ją z dostępnych danych
    } catch (err) {
      console.error("Błąd pobierania danych:", err);
    }
  };

  const fetchMessages = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API_URL}/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchEventData();
    if (isChatOpen) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [id, isChatOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInvite = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API_URL}/${id}/invite`, { email: inviteEmail }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Zaproszenie wysłane!");
      setIsInviteOpen(false);
      setInviteEmail('');
    } catch (err) {
      alert(err.response?.data?.detail || "Błąd wysyłania zaproszenia");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API_URL}/${id}/messages`, { content: newMessage }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewMessage('');
      fetchMessages();
    } catch (err) {}
  };

  if (!event) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Ładowanie...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-6">

      {/* NAGŁÓWEK */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white flex items-center gap-2">
          ← Wróć do listy
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => setIsChatOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold shadow-lg transition-all"
          >
            💬 Otwórz czat
          </button>
          <button className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg font-bold shadow-lg transition-all">
            💸 Finanse
          </button>
        </div>
      </div>

      {/* GŁÓWNA KARTA WYDARZENIA */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* LEWA KOLUMNA: OPIS */}
        <div className="md:col-span-2 bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-xl">
          <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            {event.title}
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed mb-6">
            {event.description || "Brak opisu dla tego wydarzenia."}
          </p>
          <div className="text-xs text-gray-500">Utworzono: {new Date(event.created_at).toLocaleDateString()}</div>
        </div>

        {/* PRAWA KOLUMNA: UCZESTNICY */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl h-fit">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-300 uppercase tracking-wider text-sm">Uczestnicy</h3>
            <button
              onClick={() => setIsInviteOpen(true)}
              className="text-blue-400 hover:text-blue-300 text-sm font-bold"
            >
              + Dodaj
            </button>
          </div>
          <div className="space-y-3">
            {/* Lista uczestników - na razie placeholder */}
            <div className="flex items-center gap-3 bg-gray-900 p-2 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                TY
              </div>
              <span className="text-sm font-medium">Ty (Organizator)</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ZAPROSZENIA */}
      {isInviteOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Zaproś znajomego</h2>
            <form onSubmit={handleInvite}>
              <input
                type="email"
                placeholder="email@znajomego.pl"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsInviteOpen(false)} className="flex-1 py-2 bg-gray-700 rounded-lg">Anuluj</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 rounded-lg font-bold">Wyślij</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PŁYWAJĄCE OKNO CZATU (Wysuwane z boku/dołu) */}
      {isChatOpen && (
        <div className="fixed bottom-6 right-6 w-full max-w-md h-[500px] bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="bg-gray-700 p-4 flex justify-between items-center border-b border-gray-600">
            <h3 className="font-bold">Czat Wydarzenia</h3>
            <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/50">
            {messages.map((msg) => (
              <div key={msg.id} className="group">
                <div className="text-[10px] text-blue-400 font-bold mb-1 ml-1 uppercase">
                  {msg.author.username}
                </div>
                <div className="bg-gray-700 p-3 rounded-2xl rounded-tl-none border border-gray-600 shadow-sm inline-block max-w-full">
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-gray-800 border-t border-gray-700 flex gap-2">
            <input
              type="text"
              placeholder="Napisz coś..."
              className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button type="submit" className="bg-blue-600 p-2 rounded-xl hover:bg-blue-500 transition-colors">
              Wyślij
            </button>
          </form>
        </div>
      )}

    </div>
  );
}