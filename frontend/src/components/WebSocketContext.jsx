import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../services/api';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
    const socketRef = useRef(null);
    const listenersRef = useRef([]);
    const [isConnected, setIsConnected] = useState(false);

    const connect = useCallback((userId) => {
        // Nie otwieraj nowego połączenia jeśli już jest aktywne
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

        const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
        const socket = new WebSocket(`${wsUrl}/ws/users/${userId}`);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log("WS globalny połączony, user:", userId);
            setIsConnected(true);
        };

        socket.onmessage = (event) => {
            listenersRef.current.forEach(fn => fn(event.data));
        };

        socket.onerror = (err) => {
            console.error("WS błąd:", err);
        };

        socket.onclose = () => {
            console.log("WS rozłączony");
            setIsConnected(false);
            socketRef.current = null;
        };
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
    }, []);

    // Zwraca funkcję do usunięcia listenera (cleanup)
    const addListener = useCallback((fn) => {
        listenersRef.current.push(fn);
        return () => {
            listenersRef.current = listenersRef.current.filter(l => l !== fn);
        };
    }, []);

    return (
        <WebSocketContext.Provider value={{ connect, disconnect, addListener, isConnected }}>
            {children}
        </WebSocketContext.Provider>
    );
}

export const useWebSocket = () => useContext(WebSocketContext);