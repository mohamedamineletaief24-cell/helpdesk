import { useState } from 'react';
import { createTechnician } from '../api.js';

// Story 6.9: the administrator creates a technician account.
// The account is active at once and the server forces the role to "technician" (BR9).
export default function TechnicianForm({ onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Name, email and password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { account } = await createTechnician({ name, email, password });
      setSuccess(`Technician account created: ${account.email}`);
      setName('');
      setEmail('');
      setPassword('');
      if (onCreated) onCreated(account);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="ticket-form" onSubmit={handleSubmit} noValidate>
      <h2>Add a technician</h2>

      <label htmlFor="tech-name">Full name</label>
      <input
        id="tech-name"
        type="text"
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label htmlFor="tech-email">Email</label>
      <input
        id="tech-email"
        type="email"
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label htmlFor="tech-password">Password (8 characters or more)</label>
      <input
        id="tech-password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Creating...' : 'Create technician'}
      </button>
    </form>
  );
}
