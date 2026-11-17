import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import UserPage from './pages/UserPage.jsx';
import TechnicianPage from './pages/TechnicianPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import RouteGuard from './components/RouteGuard.jsx';
import { getSession, ROLE_HOME } from './api.js';

// "/" and unknown URLs: logged in -> page of my role, otherwise -> login
function Home() {
  const session = getSession();
  const target = session ? ROLE_HOME[session.role] || '/login' : '/login';
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/user" element={<RouteGuard role="user"><UserPage /></RouteGuard>} />
      <Route path="/technician" element={<RouteGuard role="technician"><TechnicianPage /></RouteGuard>} />
      <Route path="/admin" element={<RouteGuard role="admin"><AdminPage /></RouteGuard>} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
