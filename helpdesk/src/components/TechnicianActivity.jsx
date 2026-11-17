import { useCallback, useEffect, useState } from 'react';
import { getTechnicianActivity } from '../api.js';

// Story 6.8: who is working? One row per technician, even the ones with no ticket (T12).
export default function TechnicianActivity() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getTechnicianActivity());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="ticket-section">
      <div className="section-head">
        <h2>Technician activity</h2>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="muted">There is no technician yet.</p>}

      {rows.length > 0 && (
        <div className="table-scroll">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>En cours</th>
                <th>Resolved (7 days)</th>
                <th>Last action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <div className="muted">{row.email}</div>
                  </td>
                  <td>
                    <span className={`workload small ${row.active_count >= row.max_active ? 'full' : ''}`}>
                      {row.active_count}/{row.max_active}
                    </span>
                  </td>
                  <td>{row.resolved_last_7_days}</td>
                  <td>
                    {row.last_action
                      ? new Date(row.last_action).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
