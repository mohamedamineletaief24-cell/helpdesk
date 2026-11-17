import TicketCard from './TicketCard.jsx';

// One column of the Kanban board = one status (story 6.7).
// renderActions(ticket) returns the buttons to show on a card, or null.
export default function KanbanColumn({ title, tickets, renderActions }) {
  return (
    <section className="kanban-column" aria-label={`${title} tickets`}>
      <header className="kanban-column-head">
        <h3>{title}</h3>
        <span className="badge count-badge">{tickets.length}</span>
      </header>

      <ul className="kanban-list">
        {tickets.length === 0 && <li className="muted kanban-empty">No ticket</li>}
        {tickets.map((ticket) => (
          <li key={ticket._id}>
            <TicketCard ticket={ticket}>{renderActions(ticket)}</TicketCard>
          </li>
        ))}
      </ul>
    </section>
  );
}
