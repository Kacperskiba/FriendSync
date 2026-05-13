import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { useWebSocket } from './WebSocketContext';
import { ArrowRight } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function ChangeView({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, 13);
    }, [center, map]);
    return null;
}

// Funkcja generująca kolor na podstawie ID wydarzenia (Hashed Color)
const getEventColor = (eventId) => {
    const colors = [
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
    ];
    return colors[eventId % colors.length];
};

// Funkcja tworząca dynamiczną ikonę SVG
const createDynamicIcon = (votes, eventId) => {
    const color = getEventColor(eventId);
    const baseWidth = 25;
    const baseHeight = 41;
    const factor = Math.min(baseWidth + (votes * 4), 60) / baseWidth;

    const w = baseWidth * factor;
    const h = baseHeight * factor;

    const svgTemplate = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1" width="${w}" height="${h}">
            <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
        </svg>
    `;

    return L.divIcon({
        className: "custom-event-icon",
        html: svgTemplate,
        iconSize: [w, h],
        iconAnchor: [w / 2, h],
        popupAnchor: [0, -h],
    });
};

export default function GlobalDashboardMap() {
    const navigate = useNavigate();
    const [eventLocations, setEventLocations] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [mapCenter, setMapCenter] = useState([52.2297, 21.0122]);

    const token = localStorage.getItem('token');
    const { addListener } = useWebSocket();

    const fetchAllLocations = async () => {
        try {
            const eventsRes = await axios.get(`${API_BASE_URL}/api/events`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const locationPromises = eventsRes.data.map(event =>
                axios.get(`${API_BASE_URL}/api/events/${event.id}/locations`, {
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

    useEffect(() => {
        const removeUpd = addListener("event_updated", () => fetchAllLocations());
        const removeDel = addListener("event_deleted", () => fetchAllLocations());
        return () => { removeUpd(); removeDel(); };
    }, [addListener]);

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
            {/* Search Bar */}
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
                        icon={createDynamicIcon(loc.votes_count || 0, loc.event_id)}
                    >
                        <Popup>
                            <div className="p-2 min-w-[200px] font-sans">
                                {/* Kolor tytułu zgodny z kolorem pinezki */}
                                <p
                                    className="text-[7px] font-black uppercase mb-1"
                                    style={{ color: getEventColor(loc.event_id) }}
                                >
                                    {loc.event_title}
                                </p>
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
                                        className="text-[9px] font-black uppercase bg-black text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                                    >
                                        Szczegóły <ArrowRight size={10} />
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
                .custom-event-icon { background: none !important; border: none !important; }
            `}} />
        </div>
    );
}