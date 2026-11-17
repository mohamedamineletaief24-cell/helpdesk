import { useState } from 'react';
import { createTicket } from '../api.js';

const CATEGORIES = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'network', label: 'Network' },
  { value: 'software', label: 'Software' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

// Form to open a ticket. onCreated(ticket) lets the parent page react
// (story 6.3 will use it to refresh the list of my tickets).
export default function TicketForm({ onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('hardware');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    setLoading(true);
    try {
      const ticket = await createTicket({ title, description, category, priority });
      setSuccess(`Ticket created: ${ticket.title}`);
      setTitle('');
      setDescription('');
      setCategory('hardware');
      setPriority('medium');
      if (onCreated) onCreated(ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="ticket-form" onSubmit={handleSubmit} noValidate>
      <h2>Open a ticket</h2>

      <label htmlFor="ticket-title">Title</label>
      <input
        id="ticket-title"
        type="text"
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Example: Projector does not turn on in room B12"
      />

      <label htmlFor="ticket-description">Description</label>
      <textarea
        id="ticket-description"
        rows={5}
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What happened, where, and since when?"
      />

      <div className="form-row">
        <div>
          <label htmlFor="ticket-category">Category</label>
          <select id="ticket-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ticket-priority">Priority</label>
          <select id="ticket-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Creating...' : 'Create ticket'}
      </button>
    </form>
  );
}
