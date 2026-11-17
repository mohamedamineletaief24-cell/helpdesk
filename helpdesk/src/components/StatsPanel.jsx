import { useCallback, useEffect, useRef, useState } from 'react';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { getStats } from '../api.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

// BR7 result, shown in a readable way. No resolved ticket yet: 0 (T10).
function formatDuration(hours) {
  if (!hours) return '0';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

// One bar chart drawn with Chart.js
function BarChart({ title, labels, values, colors }) {
  const canvasRef = useRef(null);
  const labelsKey = labels.join('|');
  const valuesKey = values.join('|');

  useEffect(() => {
    const chart = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: title, data: values, backgroundColor: colors, borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
    return () => chart.destroy(); // always destroy the chart before drawing a new one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, labelsKey, valuesKey]);

  return (
    <div className="chart-box">
      <h3>{title}</h3>
      <div className="chart-canvas">
        <canvas ref={canvasRef} role="img" aria-label={`${title}: ${labels.map((l, i) => `${l} ${values[i]}`).join(', ')}`} />
      </div>
    </div>
  );
}

const STATUS_COLORS = ['#3b6ea8', '#c98a00', '#0f766e', '#7a8a8f'];

// Story 6.8: tickets per status, per category (charts) and the average resolution time.
export default function StatsPanel() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getStats());
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

  const statusLabels = stats ? Object.keys(stats.by_status) : [];
  const categoryLabels = stats ? Object.keys(stats.by_category) : [];

  return (
    <section className="ticket-section">
      <div className="section-head">
        <h2>Statistics</h2>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {stats && (
        <>
          <div className="stat-tiles">
            <div className="stat-tile">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Tickets</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{stats.resolved_count}</span>
              <span className="stat-label">Resolved tickets</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{formatDuration(stats.average_resolution_hours)}</span>
              <span className="stat-label">Average resolution time</span>
            </div>
          </div>

          <div className="charts-grid">
            <BarChart
              title="Tickets per status"
              labels={statusLabels}
              values={statusLabels.map((k) => stats.by_status[k])}
              colors={STATUS_COLORS}
            />
            <BarChart
              title="Tickets per category"
              labels={categoryLabels}
              values={categoryLabels.map((k) => stats.by_category[k])}
              colors="#0f766e"
            />
          </div>
        </>
      )}
    </section>
  );
}
