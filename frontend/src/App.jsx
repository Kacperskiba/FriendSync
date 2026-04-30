import {Routes, Route} from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import EventDetails from './pages/EventDetails';
import EventMap from "./pages/EventMap.jsx";
import EventFinance from "./pages/EventFinance.jsx";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<AuthPage/>}/>
            <Route path="/dashboard" element={<Dashboard/>}/>
            <Route path="/events/:id" element={<EventDetails/>}/>
            <Route path="/events/:event_id/map" element={<EventMap />} />
            <Route path="/events/:id/finance" element={<EventFinance/>}/>
        </Routes>
    );
}