import Header from '../components/Header.jsx';
import StatsPanel from '../components/StatsPanel.jsx';
import TechnicianActivity from '../components/TechnicianActivity.jsx';
import AccountRequests from '../components/AccountRequests.jsx';
import TechnicianForm from '../components/TechnicianForm.jsx';

// 6.8: statistics and technician activity. 6.11: account requests. 6.9: add a technician.
export default function AdminPage() {
  return (
    <>
      <Header title="Administration" />
      <main className="page wide">
        <StatsPanel />
        <TechnicianActivity />
        <AccountRequests />

        <section className="ticket-section">
          <TechnicianForm />
        </section>
      </main>
    </>
  );
}
