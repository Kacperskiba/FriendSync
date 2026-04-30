import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ikony
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

let LeaderIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [35, 50],
    iconAnchor: [17, 50],
    className: 'filter-hue-rotate-[140deg] brightness-125' // Neonowy zielony dla lidera
});

L.Marker.prototype.options.icon = DefaultIcon;

export default function EventMap() {
    const { event_id } = useParams();
    const navigate = useNavigate();
    const [locations, setLocations] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    const token = localStorage.getItem('token');

    const fetchLocations = async () => {
        try {
            const res = await axios.get(`http://127.0.0.1:8000/api/events/${event_id}/locations`);
            setLocations(res.data);
        } catch (err) {
            console.error("Błąd pobierania pinezek", err);
        }
    };

    useEffect(() => { fetchLocations(); }, [event_id]);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`http://127.0.0.1:8000/api/events/${event_id}/locations`,
                { name: searchQuery, address: searchQuery },
                { headers: { Authorization: `Bearer ${token}` }}
            );
            setSearchQuery("");
            fetchLocations();
        } catch (err) {
            alert("Nie znaleziono adresu lub błąd serwera");
        } finally { setLoading(false); }
    };

    const handleVote = async (locId, val) => {
        try {
            await axios.post(`http://127.0.0.1:8000/api/locations/${locId}/votes`,
                { vote_value: val },
                { headers: { Authorization: `Bearer ${token}` }}
            );
            fetchLocations();
        } catch (err) { alert("Błąd podczas głosowania"); }
    };

    const maxVotes = Math.max(...locations.map(l => l.votes_count || 0), 1);

    return (
        <div className="h-screen w-full flex flex-col bg-[#050505] text-white overflow-hidden font-sans">

            {/* FLOATING HEADER */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-[1000]">
                <div className="bg-[#0f0f0f]/90 backdrop-blur-xl border border-white/10 p-4 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row gap-4 items-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl border border-white/5 transition-all"
                    >
                        ← Wstecz
                    </button>

                    <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full">
                        <input
                            className="flex-1 bg-black border border-white/5 rounded-xl px-6 py-3 text-sm outline-none focus:border-green-500/50 transition-all font-bold placeholder:text-gray-700"
                            placeholder="Gdzie uderzamy? (Pizzeria, Kino...)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[10px] tracking-widest px-8 py-3 rounded-xl shadow-lg shadow-green-900/20 disabled:opacity-50 transition-all"
                        >
                            {loading ? "..." : "Dodaj"}
                        </button>
                    </form>
                </div>
            </div>

            {/* MAP CONTAINER */}
            <div className="flex-1 relative z-0">
                <MapContainer center={[53.1235, 18.0084]} zoom={13} className="h-full w-full grayscale-[0.2] brightness-[0.9]">
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />

                    {locations.map(loc => (
                        <Marker
                            key={loc.id}
                            position={[loc.latitude, loc.longitude]}
                            icon={loc.votes_count >= maxVotes && loc.votes_count > 0 ? LeaderIcon : DefaultIcon}
                        >
                            <Popup>
                                <div className="p-2 min-w-[180px] font-sans">
                                    <h3 className="font-black uppercase italic tracking-tighter text-lg leading-tight mb-1 text-black">
                                        {loc.name}
                                    </h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">
                                        {loc.address || "Brak adresu"}
                                    </p>

                                    <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                                        <div>
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Punkty</p>
                                            <p className="text-xl font-black text-black leading-none">{loc.votes_count}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleVote(loc.id, 1)}
                                                className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg active:scale-90"
                                            >
                                                ▲
                                            </button>
                                            <button
                                                onClick={() => handleVote(loc.id, -1)}
                                                className="w-10 h-10 bg-white border border-gray-200 text-black rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors shadow-sm active:scale-90"
                                            >
                                                ▼
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                {/* Wskaźnik Legendy w rogu */}
                <div className="absolute bottom-6 left-6 z-[1000] bg-black/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Lider głosowania</span>
                    </div>
                </div>
            </div>

            {/* Styl dla Popup Leaflet - musimy go wstrzyknąć przez style */}
            <style dangerouslySetInnerHTML={{ __html: `
                .leaflet-popup-content-wrapper {
                    background: white;
                    border-radius: 1.5rem;
                    padding: 8px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                }
                .leaflet-popup-tip {
                    background: white;
                }
                .leaflet-container {
                    font-family: inherit;
                }
            `}} />
        </div>
    );
}