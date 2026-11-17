// Displays one ticket: title, status, description, category, priority, date, technician.
// Anything placed between <TicketCard> ... </TicketCard> is shown at the bottom as actions
// (6.4: Take button; 6.5: Resolve form; 6.6: Close / Reopen).

const STATUS_CLASS = {
  'Ouvert': 'status-open',
  'En cours': 'status-progress',
  'Résolu': 'status-resolved',
  'Fermé': 'status-closed',
};

export default function TicketCard({ ticket, children }) {
  // technician_id is { _id, name } once a technician took the ticket, otherwise null
  const technicianName = ticket.technician_id ? ticket.technician_id.name : null;
  // created_by is only an object (with a name) on the technician page
  const openedBy =
    ticket.created_by && typeof ticket.created_by === 'object' ? ticket.created_by.name : null;
  const openedOn = new Date(ticket.created_at).toLocaleDateString('en-GB');

  return (
    <article className="ticket-card">
      <div className="ticket-card-head">
        <h3>{ticket.title}</h3>
        <span className={`badge ${STATUS_CLASS[ticket.status] || ''}`}>{ticket.status}</span>
      </div>

      <p className="ticket-desc">{ticket.description}</p>

      <dl className="ticket-meta">
        <div>
          <dt>Category</dt>
          <dd className="capitalize">{ticket.category}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd className="capitalize">{ticket.priority}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>{openedOn}</dd>
        </div>
        {openedBy && (
          <div>
            <dt>Opened by</dt>
            <dd>{openedBy}</dd>
          </div>
        )}
        <div>
          <dt>Technician</dt>
          <dd className={technicianName ? '' : 'muted'}>
            {technicianName || 'Not assigned yet'}
          </dd>
        </div>
      </dl>

      {ticket.comments && ticket.comments.length > 0 && (
        <div className="ticket-comments">
          <h4>Technician comment</h4>
          {ticket.comments.map((c) => (
            <blockquote key={c._id} className="ticket-comment">
              <p>{c.content}</p>
              <footer>
                {c.author || 'Technician'} - {new Date(c.created_at).toLocaleDateString('en-GB')}
              </footer>
            </blockquote>
          ))}
        </div>
      )}

      {children && <div className="ticket-actions">{children}</div>}
    </article>
  );
}
