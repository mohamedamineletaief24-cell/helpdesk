import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { login, getSession, ROLE_HOME } from '../api.js';

const STEPS = ['Ouvert', 'En cours', 'Résolu', 'Fermé'];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in: go straight to the page of the role
  const session = getSession();
  if (session && ROLE_HOME[session.role]) {
    return <Navigate to={ROLE_HOME[session.role]} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { role } = await login(email, password);
      navigate(ROLE_HOME[role] || '/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-layout">
      <aside className="login-side">
        <h2>Report it. Follow it. Close it.</h2>
        <p>School IT incidents, from the first report to the fix.</p>
        <ol className="lifecycle">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </aside>

      <main className="login-main">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h1>Log in</h1>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="error" role="alert">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>

          <p className="form-link">
            No account yet? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
