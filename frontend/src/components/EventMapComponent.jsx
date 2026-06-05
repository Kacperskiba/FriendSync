import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { useWebSocket } from './WebSocketContext';
import { useDialog } from './DialogContext';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Importy oryginalnych zasobów Leafleta
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

function ChangeView({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, 15);
    }, [center, map]);
    return null;
}

// Nasłuch zdarzeń mapy: prawy przycisk myszy = szybkie dodanie punktu.
function MapEvents({ onAddPoint }) {
    useMapEvents({
        contextmenu(e) {
            e.originalEvent?.preventDefault?.();
            onAddPoint(e.latlng);
        },
    });
    return null;
}

// Funkcja tworząca skalowaną ikonę (spójna z Twoim dashboardem)
const getScaledIcon = (votes) => {
    const baseWidth = 25;
    const baseHeight = 41;
    const factor = Math.min(baseWidth + (votes * 4), 60) / baseWidth;

    return L.icon({
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
        iconSize: [baseWidth * factor, baseHeight * factor],
        iconAnchor: [(baseWidth * factor) / 2, baseHeight * factor],
        popupAnchor: [1, -baseHeight * factor],
        shadowSize: [baseHeight * factor, baseHeight * factor]
    });
};

export default function EventMapComponent({ eventId, focusCoords = null }) {
    const [locations, setLocations] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [mapCenter, setMapCenter] = useState(focusCoords || [52.2297, 21.0122]);

    const token = localStorage.getItem('token');
    const { addListener } = useWebSocket();
    const { confirm } = useDialog();

    const fetchLocations = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/events/${eventId}/locations`);
            setLocations(res.data);

            // Centrujemy na ostatnio dodanej lokalizacji — chyba że mamy wskazany
            // konkretny punkt (focusCoords), wtedy nie nadpisujemy widoku.
            if (res.data.length > 0 && !focusCoords) {
                const latest = res.data[res.data.length - 1];
                setMapCenter([latest.latitude, latest.longitude]);
            }
        } catch (err) {
            console.error("Błąd pobierania", err);
        }
    };

    useEffect(() => { if(eventId) fetchLocations(); }, [eventId]);

    // Gdy z zewnątrz wskazano punkt do pokazania — wycentruj mapę na nim.
    useEffect(() => {
        if (focusCoords) setMapCenter(focusCoords);
    }, [focusCoords]);

    useEffect(() => {
        if (!eventId) return;
        const remove = addListener("event_updated", (msg) => {
            if (msg.event_id !== parseInt(eventId)) return;
            fetchLocations();
        });
        return remove;
    }, [eventId, addListener]);

    const handleSearch = async (e) => {
        e.preventDefault();
        // USUNIĘTO: if (locations.length >= 1) return; -> Teraz pozwalamy na wiele

        setLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/api/events/${eventId}/locations`,
                { name: searchQuery, address: searchQuery },
                { headers: { Authorization: `Bearer ${token}` }}
            );
            setSearchQuery("");
            fetchLocations(); // Odświeżamy listę, aby pokazać nowy marker
        } catch (err) {
            alert("Nie znaleziono adresu lub wystąpił błąd");
        } finally { setLoading(false); }
    };

    const handleVote = async (locId, val) => {
        try {
            await axios.post(`${API_BASE_URL}/api/locations/${locId}/votes`,
                { vote_value: val },
                { headers: { Authorization: `Bearer ${token}` }}
            );
            fetchLocations();
        } catch (err) {
            console.error("Błąd głosowania:", err);
            alert("Nie udało się oddać głosu.");
        }
    };

    // Prawy przycisk myszy na mapie — dodaje punkt bez wpisywania nazwy.
    // Nazwę próbujemy ustalić przez reverse-geocoding (Nominatim), z fallbackiem.
    const handleAddAtPoint = async (latlng) => {
        const { lat, lng } = latlng;
        let name = `Punkt (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&accept-language=pl`);
            const data = await res.json();
            if (data && data.display_name) {
                name = data.display_name.split(',').slice(0, 2).join(',').trim();
            }
        } catch {
            // brak nazwy z geokodera — zostaje fallback ze współrzędnymi
        }
        try {
            await axios.post(`${API_BASE_URL}/api/events/${eventId}/locations`,
                { name, latitude: lat, longitude: lng },
                { headers: { Authorization: `Bearer ${token}` }}
            );
            fetchLocations();
        } catch (err) {
            alert("Nie udało się dodać punktu.");
        }
    };

    const handleDeleteLocation = async (loc) => {
        if (!await confirm(`Usunąć punkt „${loc.name}" z mapy?`, { danger: true })) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/locations/${loc.id}`,
                { headers: { Authorization: `Bearer ${token}` }}
            );
            fetchLocations();
        } catch (err) {
            alert(err.response?.data?.detail || "Nie udało się usunąć punktu.");
        }
    };

    return (
        <div className="h-full w-full relative bg-black">

            {/* Search Bar - Zawsze widoczny, aby móc dodawać kolejne propozycje */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md">
                <form onSubmit={handleSearch} className="flex flex-col gap-2">
                    <div className="flex gap-2 bg-[#0f0f0f]/90 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl">
                        <input
                            className="flex-1 bg-black border border-white/5 rounded-xl px-4 py-2 text-xs outline-none focus:border-green-500/50 text-white font-bold"
                            placeholder="Zaproponuj kolejne miejsce..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-green-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all hover:bg-green-500 disabled:opacity-50"
                        >
                            {loading ? "..." : "Dodaj"}
                        </button>
                    </div>

                    {/* Podpowiedź o prawym przycisku myszy + licznik propozycji */}
                    <div className="self-center bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">
                            PPM na mapie = szybki punkt
                            {locations.length > 0 && <> · <span className="text-green-500">{locations.length}</span> {locations.length === 1 ? 'punkt' : 'propozycji'}</>}
                        </p>
                    </div>
                </form>
            </div>

            <MapContainer center={mapCenter} zoom={13} className="h-full w-full z-0">
                <ChangeView center={mapCenter} />
                <MapEvents onAddPoint={handleAddAtPoint} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {locations.map(loc => (
                    <Marker
                        key={loc.id}
                        position={[loc.latitude, loc.longitude]}
                        icon={getScaledIcon(loc.votes_count || 0)}
                    >
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
                                            <ChevronUp size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleVote(loc.id, -1)}
                                            className="w-10 h-10 bg-white border border-gray-200 text-black rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors shadow-sm active:scale-90"
                                        >
                                            <ChevronDown size={18} />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDeleteLocation(loc)}
                                    className="w-full mt-3 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border border-red-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors"
                                >
                                    <Trash2 size={12} /> Usuń punkt
                                </button>
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