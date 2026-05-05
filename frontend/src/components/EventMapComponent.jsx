import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Komponent do automatycznego centrowania mapy
function ChangeView({ center }) {
    const map = useMap();
    if (center) {
        map.setView(center, 15);
    }
    return null;
}

// Ikony
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

export default function EventMapComponent({ eventId }) {
    const [locations, setLocations] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [mapCenter, setMapCenter] = useState([52.2297, 21.0122]);

    const token = localStorage.getItem('token');

    const fetchLocations = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/events/${eventId}/locations`);
            setLocations(res.data);

            if (res.data.length > 0) {
                setMapCenter([res.data[0].latitude, res.data[0].longitude]);
            }
        } catch (err) {
            console.error("Błąd pobierania", err);
        }
    };

    useEffect(() => { if(eventId) fetchLocations(); }, [eventId]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (locations.length >= 1) return;

        setLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/api/events/${eventId}/locations`,
                { name: searchQuery, address: searchQuery },
                { headers: { Authorization: `Bearer ${token}` }}
            );
            setSearchQuery("");
            fetchLocations();
        } catch (err) {
            alert("Nie znaleziono adresu");
        } finally { setLoading(false); }
    };

    // Funkcja głosowania
    const handleVote = async (locId, val) => {
    const token = localStorage.getItem('token');
    try {
        // Logika: wysyłamy po prostu wartość głosu (1 lub -1)
        // Jeśli backend odejmuje wartość zamiast ustawiać stan,
        // upewnij się, że nie wysyłasz "val" wielokrotnie.
        await axios.post(`${API_BASE_URL}/api/locations/${locId}/votes`,
            { vote_value: val },
            { headers: { Authorization: `Bearer ${token}` }}
        );

        // Po udanym głosowaniu odświeżamy dane z serwera,
        // aby mieć pewność, że wyświetlamy stan z bazy danych
        fetchLocations();
    } catch (err) {
        console.error("Błąd głosowania:", err);
        alert("Nie udało się oddać głosu. Możliwe, że już zagłosowałeś?");
    }
};

    return (
        <div className="h-full w-full relative">

            {/* Search / Info Bar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md">
                {locations.length === 0 ? (
                    <form onSubmit={handleSearch} className="flex gap-2 bg-[#0f0f0f]/90 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl">
                        <input
                            className="flex-1 bg-black border border-white/5 rounded-xl px-4 py-2 text-xs outline-none focus:border-green-500/50 text-white font-bold"
                            placeholder="Ustaw miejsce spotkania..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" disabled={loading} className="bg-green-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all hover:bg-green-500">
                            {loading ? "..." : "Ustaw"}
                        </button>
                    </form>
                ) : (
                    <div className="bg-[#0f0f0f]/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl text-center shadow-2xl flex items-center justify-between px-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                                Cel ustalony
                            </p>
                        </div>
                        <p className="text-[10px] font-bold text-gray-500 italic">
                            {locations[0].name}
                        </p>
                    </div>
                )}
            </div>

            <MapContainer center={mapCenter} zoom={13} className="h-full w-full z-0">
                <ChangeView center={mapCenter} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {locations.map(loc => (
                    <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={DefaultIcon}>
                        <Popup>
                            <div className="p-2 min-w-[180px] font-sans">
                                <h3 className="font-black uppercase italic tracking-tighter text-lg leading-tight mb-1 text-black">
                                    {loc.name}
                                </h3>

                                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Głosy</p>
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
        </div>
    );
}