import { Routes, Route } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import EventDetails from './pages/EventDetails'; // --- NOWY IMPORT ---

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      {/* Znacznik :id oznacza, że to miejsce jest dynamiczne (np. /events/1, /events/5) */}
      <Route path="/events/:id" element={<EventDetails />} />
    </Routes>
  );
}