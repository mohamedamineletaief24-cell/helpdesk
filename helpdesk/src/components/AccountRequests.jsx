import { useCallback, useEffect, useState } from 'react';
import { getPendingAccounts, approveAccount, rejectAccount } from '../api.js';

// Story 6.11: the administrator approves or rejects the account requests (status "pending").
export default function AccountRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setRequests(await getPendingAccounts());
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

  async function decide(account, action) {
    setError('');
    setNotice('');
    setBusyId(account._id);
    try {
      if (action === 'approve') {
        await approveAccount(account._id);
        setNotice(`Approved: ${account.email}`);
      } else {
        await rejectAccount(account._id);
        setNotice(`Rejected: ${account.email}`);
      }
    } catch (err) {
      setError(err.message); // for example 409: another administrator already decided
    } finally {
      setBusyId(null);
      await load(); // always show the real list
    }
  }

  return (
    <section className="ticket-section requests">
      <h2>Account requests</h2>

      {notice && <p className="success" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p className="muted">Loading...</p>}
      {!loading && requests.length === 0 && !error && (
        <p className="muted">No pending request.</p>
      )}

      <ul className="ticket-list">
        {requests.map((account) => (
          <li key={account._id} className="request-row">
            <div>
              <strong>{account.name}</strong>
              <p className="muted">
                {account.email} - requested on{' '}
                {new Date(account.created_at).toLocaleDateString('en-GB')}
              </p>
            </div>
            <div className="request-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={busyId === account._id}
                onClick={() => decide(account, 'approve')}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn-secondary danger"
                disabled={busyId === account._id}
                onClick={() => decide(account, 'reject')}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
