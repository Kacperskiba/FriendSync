import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Importy oryginalnych zasobów Leafleta
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

function ChangeView({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, 13);
    }, [center, map]);
    return null;
}

// Funkcja tworząca skalowaną, oryginalną ikonę
const getScaledIcon = (votes) => {
    const baseWidth = 25;
    const baseHeight = 41;
    // Skalowanie: +4px szerokości za każdy głos, max 60px szerokości
    const factor = Math.min(baseWidth + (votes * 4), 60) / baseWidth;

    return L.icon({
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
        iconSize: [baseWidth * factor, baseHeight * factor],
        iconAnchor: [(baseWidth * factor) / 2, baseHeight * factor], // Dół pinezki
        popupAnchor: [1, -baseHeight * factor],
        shadowSize: [baseHeight * factor, baseHeight * factor] // Cień też rośnie
    });
};

export default function GlobalDashboardMap() {
    const navigate = useNavigate();
    const [eventLocations, setEventLocations] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [mapCenter, setMapCenter] = useState([52.2297, 21.0122]);

    const token = localStorage.getItem('token');

    const fetchAllLocations = async () => {
        try {
            const eventsRes = await axios.get(`http://127.0.0.1:8000/api/events`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const locationPromises = eventsRes.data.map(event =>
                axios.get(`http://127.0.0.1:8000/api/events/${event.id}/locations`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then(res => res.data.map(loc => ({
                    ...loc,
                    event_title: event.title,
                    event_id: event.id
                })))
            );

            const allResults = await Promise.all(locationPromises);
            const flattened = allResults.flat();
            setEventLocations(flattened);

            if (flattened.length > 0) {
                const topLocation = flattened.reduce((prev, current) =>
                    ((prev.votes_count || 0) > (current.votes_count || 0)) ? prev : current
                );
                setMapCenter([topLocation.latitude, topLocation.longitude]);
            }
        } catch (err) {
            console.error("Błąd pobierania punktów", err);
        }
    };

    useEffect(() => { fetchAllLocations(); }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`);
            if (res.data && res.data.length > 0) {
                const { lat, lon } = res.data[0];
                setMapCenter([parseFloat(lat), parseFloat(lon)]);
            }
        } catch (err) {
            alert("Nie znaleziono miejsca");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full w-full relative bg-black">

            {/* Search Bar - Identyczny jak w mapie eventowej */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md">
                <form onSubmit={handleSearch} className="flex gap-2 bg-[#0f0f0f]/90 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl">
                    <input
                        className="flex-1 bg-black border border-white/5 rounded-xl px-4 py-2 text-xs outline-none focus:border-green-500/50 text-white font-bold"
                        placeholder="Szukaj lokalizacji na mapie..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" disabled={loading} className="bg-green-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all hover:bg-green-500">
                        {loading ? "..." : "Skocz"}
                    </button>
                </form>
            </div>

            <MapContainer center={mapCenter} zoom={6} className="h-full w-full z-0">
                <ChangeView center={mapCenter} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {eventLocations.map(loc => (
                    <Marker
                        key={`${loc.event_id}-${loc.id}`}
                        position={[loc.latitude, loc.longitude]}
                        icon={getScaledIcon(loc.votes_count || 0)}
                    >
                        <Popup>
                            <div className="p-2 min-w-[200px] font-sans">
                                <p className="text-[7px] font-black text-green-600 uppercase mb-1">{loc.event_title}</p>
                                <h3 className="font-black uppercase italic tracking-tighter text-lg leading-tight mb-2 text-black">
                                    {loc.name}
                                </h3>

                                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Głosy</p>
                                        <p className="text-lg font-black text-black leading-none">{loc.votes_count || 0}</p>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/events/${loc.event_id}`)}
                                        className="text-[9px] font-black uppercase bg-black text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors"
                                    >
                                        Szczegóły →
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            <style dangerouslySetInnerHTML={{ __html: `
                .leaflet-container { background: #050505 !important; }
                .leaflet-popup-content-wrapper { border-radius: 1.5rem; }
            `}} />
        </div>
    );
}