const STATUSES = ['Ouvert', 'En cours', 'Résolu', 'Fermé'];
const PRIORITIES = ['low', 'medium', 'high'];

// Story 6.7: the three filters (status, priority, technician) work together (BR6).
export default function Filters({ filters, technicians, onChange, onReset }) {
  function update(key, value) {
    onChange({ ...filters, [key]: value });
  }

  const hasFilter = Boolean(filters.status || filters.priority || filters.technician);

  return (
    <form className="filters" onSubmit={(e) => e.preventDefault()}>
      <div>
        <label htmlFor="filter-status">Status</label>
        <select id="filter-status" value={filters.status} onChange={(e) => update('status', e.target.value)}>
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="filter-priority">Priority</label>
        <select id="filter-priority" value={filters.priority} onChange={(e) => update('priority', e.target.value)}>
          <option value="">All</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p} className="capitalize">{p}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="filter-technician">Technician</label>
        <select id="filter-technician" value={filters.technician} onChange={(e) => update('technician', e.target.value)}>
          <option value="">All</option>
          {technicians.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
      </div>

      <button type="button" className="btn-secondary" onClick={onReset} disabled={!hasFilter}>
        Reset filters
      </button>
    </form>
  );
}
