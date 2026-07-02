import {Routes, Route} from 'react-router-dom';
import { useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import EventDetails from './pages/EventDetails';
import EventFinance from "./pages/EventFinance.jsx";
import EditProfilePage from "./components/EditProfilePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import JoinEventPage from "./pages/JoinEventPage.jsx";
import { WebSocketProvider } from './components/WebSocketContext';
import { CurrencyProvider } from './components/CurrencyContext';
import { DialogProvider } from './components/DialogContext';
import { applyAppearancePrefs } from './services/preferences';

export default function App() {
    useEffect(() => {
        applyAppearancePrefs();
        const onChange = () => applyAppearancePrefs();
        window.addEventListener('user_prefs_changed', onChange);
        return () => window.removeEventListener('user_prefs_changed', onChange);
    }, []);

    return (
        <CurrencyProvider>
            <WebSocketProvider>
                <DialogProvider>
                    <Routes>
                        <Route path="/" element={<AuthPage/>}/>
                        <Route path="/dashboard" element={<Dashboard/>}/>
                        <Route path="/events/:id" element={<EventDetails/>}/>
                        <Route path="/events/:id/finance" element={<EventFinance/>}/>
                        <Route path="/edit-profile" element={<EditProfilePage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/join/:token" element={<JoinEventPage />} />
                    </Routes>
                </DialogProvider>
            </WebSocketProvider>
        </CurrencyProvider>
    );
}
