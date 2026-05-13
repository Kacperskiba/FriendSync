import {Routes, Route} from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import EventDetails from './pages/EventDetails';
import EventFinance from "./pages/EventFinance.jsx";
import EditProfilePage from "./components/EditProfilePage.jsx";
import { WebSocketProvider } from './components/WebSocketContext';

export default function App() {
    return (
        <WebSocketProvider>
            <Routes>
                <Route path="/" element={<AuthPage/>}/>
                <Route path="/dashboard" element={<Dashboard/>}/>
                <Route path="/events/:id" element={<EventDetails/>}/>
                <Route path="/events/:id/finance" element={<EventFinance/>}/>
                <Route path="/edit-profile" element={<EditProfilePage />} />
            </Routes>
        </WebSocketProvider>
    );
}