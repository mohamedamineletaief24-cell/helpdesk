const bcrypt = require('bcrypt');
const User = require('../models/User');

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores everything after 72 bytes
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checks name, email and password from a request body.
// Returns { error } or { name, email, password } (cleaned).
// restrictDomain: true for the public registration (6.10), see ALLOWED_EMAIL_DOMAIN in .env (Q9).
function validateAccountInput(body, { restrictDomain = false } = {}) {
  const { name, email, password } = body || {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanName || !cleanEmail || typeof password !== 'string' || !password) {
    return { error: 'Name, email and password are required' };
  }
  if (cleanName.length > 100) {
    return { error: 'Name must be 100 characters or fewer' };
  }
  if (cleanEmail.length > 254 || !EMAIL_REGEX.test(cleanEmail)) {
    return { error: 'Email is not valid' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { error: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer` };
  }

  if (restrictDomain) {
    const domain = (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase().replace(/^@/, '');
    if (domain && !cleanEmail.endsWith(`@${domain}`)) {
      return { error: `Email must end with @${domain}` };
    }
  }

  return { name: cleanName, email: cleanEmail, password };
}

// Creates the account. The caller decides role and status (never the client).
// Returns { user } or { duplicate: true } when the email already exists.
async function createAccount({ name, email, password, role, status }) {
  const password_hash = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ name, email, password_hash, role, status, active_count: 0 });
    return { user };
  } catch (err) {
    if (err && err.code === 11000) {
      return { duplicate: true }; // unique index on email
    }
    throw err;
  }
}

// What the API is allowed to send back about an account (never the password hash)
function publicAccount(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  };
}

module.exports = { validateAccountInput, createAccount, publicAccount };
