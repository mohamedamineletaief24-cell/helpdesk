import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { register, getSession, ROLE_HOME } from '../api.js';

const STEPS = ['Send your request', 'The administrator approves it', 'Log in and open tickets'];

// Story 6.10: a visitor asks for an account. The account stays "pending"
// until the administrator approves it (6.11), so nobody can log in right away.
export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Already logged in: nothing to do here
  const session = getSession();
  if (session && ROLE_HOME[session.role]) {
    return <Navigate to={ROLE_HOME[session.role]} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-layout">
      <aside className="login-side">
        <h2>Ask for an account. Wait for approval.</h2>
        <p>Every new account is checked by the administrator before it can be used.</p>
        <ol className="lifecycle">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </aside>

      <main className="login-main">
        {sent ? (
          <div className="login-form">
            <h1>Request sent</h1>
            <p className="success" role="status">
              Your request was sent. You can log in once the administrator has approved your account.
            </p>
            <Link to="/login" className="btn-secondary btn-link">Back to log in</Link>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <h1>Create an account</h1>

            <label htmlFor="reg-name">Full name</label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="reg-password">Password (8 characters or more)</label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <label htmlFor="reg-confirm">Confirm the password</label>
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            {error && <p className="error" role="alert">{error}</p>}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send my request'}
            </button>

            <p className="form-link">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
