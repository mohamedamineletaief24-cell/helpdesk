import { useCallback, useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import TicketForm from '../components/TicketForm.jsx';
import TicketCard from '../components/TicketCard.jsx';
import OwnerActions from '../components/OwnerActions.jsx';
import { getMyTickets } from '../api.js';

export default function UserPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reads my tickets from the server. Called at the start and after each new ticket.
  const loadTickets = useCallback(async () => {
    setError('');
    try {
      setTickets(await getMyTickets());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  return (
    <>
      <Header title="My tickets" />
      <main className="page">
        <TicketForm onCreated={loadTickets} />

        <section className="ticket-section">
          <h2>Tickets I opened</h2>

          {loading && <p className="muted">Loading...</p>}
          {error && <p className="error" role="alert">{error}</p>}
          {!loading && !error && tickets.length === 0 && (
            <p className="muted">You have not opened any ticket yet.</p>
          )}

          <ul className="ticket-list">
            {tickets.map((ticket) => (
              <li key={ticket._id}>
                <TicketCard ticket={ticket}>
                  {ticket.status === 'Résolu' ? (
                    <OwnerActions ticket={ticket} onChanged={loadTickets} />
                  ) : null}
                </TicketCard>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
