import { useCallback, useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import Filters from '../components/Filters.jsx';
import KanbanColumn from '../components/KanbanColumn.jsx';
import ResolveForm from '../components/ResolveForm.jsx';
import { getAllTickets, getMe, getTechnicians, takeTicket } from '../api.js';

const MAX_ACTIVE = 5; // BR2 (the real check is on the server)
const COLUMNS = ['Ouvert', 'En cours', 'Résolu', 'Fermé']; // one column per status
const NO_FILTERS = { status: '', priority: '', technician: '' };

// 6.4: counter n/5, Take button, error messages.
// 6.5: Resolve form (mandatory comment) on my tickets En cours.
// 6.7: Kanban board with 4 columns and combined filters.
export default function TechnicianPage() {
  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [activeCount, setActiveCount] = useState(0);
  const [myId, setMyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [takingId, setTakingId] = useState(null);

  // Reads the tickets (with the current filters) and my counter from the server.
  const loadAll = useCallback(async () => {
    try {
      const [list, me] = await Promise.all([getAllTickets(filters), getMe()]);
      setTickets(list);
      setActiveCount(me.active_count ?? 0);
      setMyId(me.id);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Runs at the start and every time a filter changes
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // The technician list for the filter is read once
  useEffect(() => {
    getTechnicians()
      .then(setTechnicians)
      .catch(() => setTechnicians([]));
  }, []);

  async function handleTake(ticket) {
    setActionError('');
    setNotice('');
    setTakingId(ticket._id);
    try {
      const result = await takeTicket(ticket._id);
      setNotice(`You took in charge: ${ticket.title}`);
      setActiveCount(result.active_count);
    } catch (err) {
      // 409 (already taken / limit reached), 404, ...: show the server message
      setActionError(err.message);
    } finally {
      setTakingId(null);
      loadAll(); // always show the real state
    }
  }

  // 6.5: the server answered { ticket, comment, active_count }
  function handleResolved(result) {
    setActionError('');
    setNotice(`Resolved: ${result.ticket.title}`);
    if (typeof result.active_count === 'number') {
      setActiveCount(result.active_count);
    }
    loadAll();
  }

  function renderActions(ticket) {
    if (ticket.status === 'Ouvert') {
      return (
        <button
          type="button"
          className="btn-primary"
          disabled={takingId === ticket._id}
          onClick={() => handleTake(ticket)}
        >
          {takingId === ticket._id ? 'Taking...' : 'Take in charge'}
        </button>
      );
    }
    if (ticket.status === 'En cours' && ticket.technician_id && ticket.technician_id._id === myId) {
      return <ResolveForm ticket={ticket} onResolved={handleResolved} />;
    }
    return null;
  }

  return (
    <>
      <Header title="Technician board" />
      <main className="page wide">
        <p className={`workload ${activeCount >= MAX_ACTIVE ? 'full' : ''}`}>
          En cours: {activeCount}/{MAX_ACTIVE}
        </p>

        <Filters
          filters={filters}
          technicians={technicians}
          onChange={setFilters}
          onReset={() => setFilters(NO_FILTERS)}
        />

        {notice && <p className="success" role="status">{notice}</p>}
        {actionError && <p className="error" role="alert">{actionError}</p>}
        {loadError && <p className="error" role="alert">{loadError}</p>}
        {loading && <p className="muted">Loading...</p>}

        <div className="kanban">
          {COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              title={status}
              tickets={tickets.filter((t) => t.status === status)}
              renderActions={renderActions}
            />
          ))}
        </div>
      </main>
    </>
  );
}
