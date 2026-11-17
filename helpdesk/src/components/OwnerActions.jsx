import { useState } from 'react';
import { closeTicket, reopenTicket } from '../api.js';

const REOPEN_DAYS = 7; // BR4 (the real check is on the server)

// Story 6.6: the owner of a resolved ticket can close it or reopen it (within 7 days).
// onChanged() tells the page to read the tickets again.
export default function OwnerActions({ ticket, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at).getTime() : 0;
  const canReopen = Date.now() - resolvedAt <= REOPEN_DAYS * 24 * 60 * 60 * 1000;

  async function run(action) {
    setError('');
    setBusy(true);
    try {
      await action(ticket._id);
      onChanged();
    } catch (err) {
      setError(err.message); // for example: the 7 days are over
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="owner-actions">
      <div className="resolve-buttons">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => run(closeTicket)}>
          Close ticket
        </button>
        {canReopen ? (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(reopenTicket)}>
            Reopen
          </button>
        ) : (
          <span className="muted">Reopening is no longer possible (more than 7 days).</span>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
