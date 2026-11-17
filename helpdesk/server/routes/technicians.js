const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const { validateAccountInput, createAccount, publicAccount } = require('../utils/createAccount');

const router = express.Router();

// =====================================================================
// 6.9 Add a technician (Mohamed Amine)
// POST /api/technicians   role: admin
// BR9: only the administrator creates technician accounts.
// =====================================================================
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const input = validateAccountInput(req.body);
    if (input.error) {
      return res.status(400).json({ error: input.error });
    }

    // Role and status are set here: a role sent in the body is ignored.
    // The account is active at once (the administrator is the one creating it).
    const result = await createAccount({
      name: input.name,
      email: input.email,
      password: input.password,
      role: 'technician',
      status: 'active',
    });
    if (result.duplicate) {
      return res.status(409).json({ error: 'This email is already used' });
    }

    return res.status(201).json({ account: publicAccount(result.user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/technicians   role: technician or admin
// The list of technicians (id and name), used by the technician filter of the Kanban board (6.7).
// A user gets 403 (T8).
router.get('/', authenticate, requireRole('technician', 'admin'), async (req, res) => {
  try {
    const technicians = await User.find({ role: 'technician', status: 'active' })
      .select('name')
      .sort({ name: 1 })
      .lean();
    return res.status(200).json(technicians);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
