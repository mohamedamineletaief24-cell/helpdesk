const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { validateAccountInput, createAccount, publicAccount } = require('../utils/createAccount');

const router = express.Router();

// POST /api/login  (all roles)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Only accept strings: this also blocks NoSQL injection such as { "$ne": "" }
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;

    // Same message for unknown email and wrong password (do not reveal which one)
    if (!passwordOk) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }

    // BR11: only an approved (active) account can log in.
    // The password is checked first, so nobody can learn the status of an account without its password.
    const status = user.status || 'active';
    if (status === 'pending') {
      return res.status(403).json({ error: 'Your account is waiting for approval by the administrator' });
    }
    if (status === 'rejected') {
      return res.status(403).json({ error: 'Your account request was rejected' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({ token, role: user.role, name: user.name });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/register  (visitor, public: no token needed)
// BR10: only name, email and password are read. The role (user) and the status (pending)
// are set here, so a role or status sent by the client is ignored.
router.post('/register', async (req, res) => {
  try {
    const input = validateAccountInput(req.body, { restrictDomain: true });
    if (input.error) {
      return res.status(400).json({ error: input.error });
    }

    const result = await createAccount({
      name: input.name,
      email: input.email,
      password: input.password,
      role: 'user',
      status: 'pending',
    });
    if (result.duplicate) {
      return res.status(409).json({ error: 'This email is already used' });
    }

    return res.status(201).json({
      message: 'Your request was sent. You can log in once the administrator has approved your account.',
      account: publicAccount(result.user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/me  (any logged-in user)
// Helper, not in the spec table: checks that a token is accepted and returns the account.
// The technician page reads active_count here for the counter n/5 (BR2).
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name role active_count');
    if (!user) {
      return res.status(401).json({ error: 'Account not found' });
    }
    return res.status(200).json({
      id: user._id,
      name: user.name,
      role: user.role,
      active_count: user.active_count,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
