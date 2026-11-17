import { useState } from 'react';
import { resolveTicket } from '../api.js';

// Story 6.5: the technician writes the mandatory comment (BR3) and resolves the ticket.
// onResolved(result) gets { ticket, comment, active_count } from the server.
export default function ResolveForm({ ticket, onResolved }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        Resolve
      </button>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!comment.trim()) {
      setError('A comment is required to resolve a ticket.');
      return;
    }

    setLoading(true);
    try {
      const result = await resolveTicket(ticket._id, comment);
      onResolved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setOpen(false);
    setComment('');
    setError('');
  }

  return (
    <form className="resolve-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor={`resolve-${ticket._id}`}>Resolution comment (required)</label>
      <textarea
        id={`resolve-${ticket._id}`}
        rows={3}
        maxLength={2000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What was the problem and what did you do?"
      />

      {error && <p className="error" role="alert">{error}</p>}

      <div className="resolve-buttons">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Resolving...' : 'Confirm resolve'}
        </button>
        <button type="button" className="btn-secondary" onClick={handleCancel} disabled={loading}>
          Cancel
        </button>
      </div>
    </form>
  );
}
