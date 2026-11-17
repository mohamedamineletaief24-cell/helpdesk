const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');
const { publicAccount } = require('../utils/createAccount');

const router = express.Router();

// =====================================================================
// 6.11 Approve or reject account requests (Mohamed Amine) - admin only
// =====================================================================

// GET /api/accounts/pending
router.get('/pending', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const pending = await User.find({ status: 'pending' })
      .select('name email created_at') // never the password hash
      .sort({ created_at: 1 }) // oldest request first
      .lean();
    return res.status(200).json(pending);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Shared by approve and reject.
// findOneAndUpdate checks "status is pending" AND changes it in one atomic step,
// so two administrators clicking at the same time cannot both decide.
async function decide(req, res, newStatus) {
  const accountId = req.params.id;

  if (!mongoose.isValidObjectId(accountId)) {
    return res.status(400).json({ error: 'Invalid account id' });
  }

  try {
    const account = await User.findOneAndUpdate(
      { _id: accountId, status: 'pending' },
      { $set: { status: newStatus } },
      { new: true }
    );

    if (!account) {
      const exists = await User.exists({ _id: accountId });
      if (!exists) {
        return res.status(404).json({ error: 'Account not found' });
      }
      return res.status(409).json({ error: 'This account is not pending' });
    }

    return res.status(200).json({ account: publicAccount(account) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// PATCH /api/accounts/:id/approve   pending -> active
router.patch('/:id/approve', authenticate, requireRole('admin'), (req, res) => decide(req, res, 'active'));

// PATCH /api/accounts/:id/reject    pending -> rejected
router.patch('/:id/reject', authenticate, requireRole('admin'), (req, res) => decide(req, res, 'rejected'));

module.exports = router;
