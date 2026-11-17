import { Navigate } from 'react-router-dom';
import { getSession, ROLE_HOME } from '../api.js';

// Wraps a page and checks who is looking at it.
//  - not logged in            -> /login
//  - logged in, wrong role    -> the page of their own role
//  - right role               -> the page is displayed
// This only hides screens. The real protection is on the server (BR8).
export default function RouteGuard({ role, children }) {
  const session = getSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.role !== role) {
    return <Navigate to={ROLE_HOME[session.role] || '/login'} replace />;
  }
  return children;
}
