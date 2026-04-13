import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Naprawa ikon Leaflet w React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Ikona dla lidera (z największą liczbą głosów)
let LeaderIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [35, 50],
    iconAnchor: [17, 50],
    className: 'filter-hue-rotate-90' // Prosta zmiana koloru CSS
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

    // Obsługa Geocodingu (Nominatim API)
    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`http://127.0.0.1:8000/api/events/${event_id}/locations`,
                { name: searchQuery, address: searchQuery },
                { headers: { Authorization: `Bearer ${token}` }}
            );
            setSearchQuery("");
            fetchLocations();
        } catch (err) {
            alert("Nie znaleziono adresu lub błąd serwera");
        } finally { setLoading(false); }
    };

    // Głosowanie
    const handleVote = async (locId, val) => {
        try {
            await axios.post(`http://127.0.0.1:8000/api/locations/${locId}/votes`,
                { vote_value: val },
                { headers: { Authorization: `Bearer ${token}` }}
            );
            fetchLocations();
        } catch (err) { alert("Błąd podczas głosowania"); }
    };

    // Znajdź max głosów dla wyróżnienia lidera
    const maxVotes = Math.max(...locations.map(l => l.votes_count || 0), 1);

    return (
        <div className="h-screen w-full flex flex-col bg-gray-900 text-white">
            {/* Header z wyszukiwarką */}
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex flex-wrap gap-4 items-center">
                <button onClick={() => navigate(-1)} className="bg-gray-700 px-4 py-2 rounded">← Powrót</button>
                <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <input
                        className="flex-1 bg-gray-900 border border-gray-600 rounded px-4 py-2"
                        placeholder="Wyszukaj adres (np. Pizzeria Bydgoszcz)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" disabled={loading} className="bg-blue-600 px-6 py-2 rounded disabled:opacity-50">
                        {loading ? "Szukanie..." : "Dodaj"}
                    </button>
                </form>
            </div>

            {/* Mapa OpenStreetMap */}
            <div className="flex-1 relative z-0">
                <MapContainer center={[53.1235, 18.0084]} zoom={13} className="h-full w-full">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                    {locations.map(loc => (
                        <Marker
                            key={loc.id}
                            position={[loc.latitude, loc.longitude]}
                            icon={loc.votes_count >= maxVotes && loc.votes_count > 0 ? LeaderIcon : DefaultIcon}
                        >
                            <Popup className="custom-popup">
                                <div className="text-gray-900 p-2">
                                    <h3 className="font-bold text-lg">{loc.name}</h3>
                                    <p className="text-sm text-gray-600">{loc.description}</p>
                                    <div className="mt-3 flex items-center justify-between border-t pt-2">
                                        <div className="font-bold">Głosy: {loc.votes_count}</div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleVote(loc.id, 1)} className="bg-green-500 text-white px-2 py-1 rounded text-xs">▲ Up</button>
                                            <button onClick={() => handleVote(loc.id, -1)} className="bg-red-500 text-white px-2 py-1 rounded text-xs">▼ Down</button>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}