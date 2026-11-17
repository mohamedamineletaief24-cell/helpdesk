const jwt = require('jsonwebtoken');

// 1) authenticate: checks the token. No token or bad token -> 401.
//    On success, puts { id, role } in req.user for the next handlers.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// 2) requireRole('technician') or requireRole('user', 'admin'):
//    the user is logged in but the role is not allowed -> 403.
//    Always used AFTER authenticate.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Role not allowed' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
