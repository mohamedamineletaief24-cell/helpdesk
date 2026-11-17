import { useNavigate } from 'react-router-dom';
import { getSession, logout } from '../api.js';

// Top bar shared by the three role pages: title, who is logged in, log out.
export default function Header({ title }) {
  const navigate = useNavigate();
  const session = getSession();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p className="muted">
          {session ? `${session.name} (${session.role})` : ''}
        </p>
      </div>
      <button type="button" className="btn-secondary" onClick={handleLogout}>
        Log out
      </button>
    </header>
  );
}
