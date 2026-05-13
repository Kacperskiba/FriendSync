import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../services/api';
import { prefStorage } from '../services/preferences';

const WebSocketContext = createContext(null);

const NOTIF_SOUND_TYPES = new Set([
    'friend_request_new',
    'friend_request_accepted',
    'event_invitation_new',
    'event_invitation_resolved',
]);

function playDing() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.3);
        setTimeout(() => ctx.close(), 500);
    } catch {}
}

export function WebSocketProvider({ children }) {
    const socketRef = useRef(null);
    const listenersRef = useRef([]);
    const reconnectTimerRef = useRef(null);
    const shouldReconnectRef = useRef(false);
    const [isConnected, setIsConnected] = useState(false);

    const openSocket = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
        const socket = new WebSocket(`${wsUrl}/ws?token=${encodeURIComponent(token)}`);
        socketRef.current = socket;

        socket.onopen = () => {
            if (socketRef.current !== socket) return; // stary socket - ignoruj
            console.log("WS połączony");
            setIsConnected(true);
        };

        socket.onmessage = (event) => {
            if (socketRef.current !== socket) return;
            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch {
                console.warn("WS: nieprawidłowy JSON", event.data);
                return;
            }
            if (prefStorage.get('notif_sound') === '1' && NOTIF_SOUND_TYPES.has(msg.type)) {
                playDing();
            }
            listenersRef.current.forEach(({ type, fn }) => {
                if (type === '*' || type === msg.type) fn(msg);
            });
        };

        socket.onerror = (err) => {
            if (socketRef.current !== socket) return;
            console.error("WS błąd:", err);
        };

        socket.onclose = () => {
            const isCurrent = socketRef.current === socket;
            console.log("WS rozłączony", isCurrent ? "(aktualny)" : "(stary)");
            if (isCurrent) {
                setIsConnected(false);
                socketRef.current = null;
                if (shouldReconnectRef.current && localStorage.getItem('token')) {
                    reconnectTimerRef.current = setTimeout(openSocket, 2000);
                }
            }
        };
    }, []);

    const connect = useCallback(() => {
        shouldReconnectRef.current = true;
        openSocket();
    }, [openSocket]);

    const disconnect = useCallback(() => {
        shouldReconnectRef.current = false;
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (socketRef.current) {
            // NIE nullujemy socketRef.current — niech onclose to zrobi (z poprawnym checkiem)
            socketRef.current.close();
        }
    }, []);

    const addListener = useCallback((type, fn) => {
        const entry = { type, fn };
        listenersRef.current.push(entry);
        return () => {
            listenersRef.current = listenersRef.current.filter(l => l !== entry);
        };
    }, []);

    useEffect(() => {
        // Auto-connect przy mount jeśli token jest w localStorage
        if (localStorage.getItem('token')) {
            shouldReconnectRef.current = true;
            openSocket();
        }
        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (socketRef.current) socketRef.current.close();
        };
    }, [openSocket]);

    return (
        <WebSocketContext.Provider value={{ connect, disconnect, addListener, isConnected }}>
            {children}
        </WebSocketContext.Provider>
    );
}

export const useWebSocket = () => useContext(WebSocketContext);
