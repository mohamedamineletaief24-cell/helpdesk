const express = require('express');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const MAX_ACTIVE_TICKETS = 5; // BR2, shown as n/5 in the technician table
const DAY_MS = 24 * 60 * 60 * 1000;

// =====================================================================
// 6.8 Statistics (Mohamed Amine) - admin only
// =====================================================================

// GET /api/stats
// Tickets per status and per category ($group) and the average resolution time (BR7).
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [statusRows, categoryRows, resolvedRows] = await Promise.all([
      Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      // BR7: resolution date minus creation date, over the tickets that have a resolution date
      Ticket.aggregate([
        { $match: { resolved_at: { $ne: null } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            average_ms: { $avg: { $subtract: ['$resolved_at', '$created_at'] } },
          },
        },
      ]),
    ]);

    // Every status and category is always present, with 0 when there is no ticket
    const by_status = {};
    for (const status of Ticket.STATUSES) by_status[status] = 0;
    for (const row of statusRows) {
      if (row._id in by_status) by_status[row._id] = row.count;
    }

    const by_category = {};
    for (const category of Ticket.CATEGORIES) by_category[category] = 0;
    for (const row of categoryRows) {
      if (row._id in by_category) by_category[row._id] = row.count;
    }

    const total = Object.values(by_status).reduce((sum, n) => sum + n, 0);

    // T10: $avg returns null when no ticket is resolved yet: shown as 0, no division by zero
    const resolved = resolvedRows[0];
    const averageMs = resolved && resolved.average_ms != null ? resolved.average_ms : 0;

    return res.status(200).json({
      total,
      by_status,
      by_category,
      resolved_count: resolved ? resolved.count : 0,
      average_resolution_ms: Math.round(averageMs),
      average_resolution_hours: Math.round((averageMs / 3600000) * 100) / 100,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stats/technicians
// Activity of every technician: tickets En cours (n/5), tickets resolved in the last
// 7 days, date of the last action (take or resolve). A technician with no ticket is
// listed with zeros (T12).
router.get('/technicians', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 7 * DAY_MS);

    const [technicians, rows] = await Promise.all([
      User.find({ role: 'technician' }).select('name email active_count').sort({ name: 1 }).lean(),
      Ticket.aggregate([
        { $match: { technician_id: { $ne: null } } },
        {
          $group: {
            _id: '$technician_id',
            resolved_last_7_days: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$resolved_at', null] }, { $gte: ['$resolved_at', cutoff] }] },
                  1,
                  0,
                ],
              },
            },
            last_taken: { $max: '$taken_at' },
            last_resolved: { $max: '$resolved_at' },
          },
        },
      ]),
    ]);

    const byTechnician = new Map(rows.map((row) => [String(row._id), row]));

    // The results are merged here, so that a technician with no ticket still appears
    const result = technicians.map((tech) => {
      const row = byTechnician.get(String(tech._id));
      const dates = row ? [row.last_taken, row.last_resolved].filter(Boolean) : [];
      const lastAction = dates.length
        ? new Date(Math.max(...dates.map((d) => new Date(d).getTime())))
        : null;

      return {
        id: tech._id,
        name: tech.name,
        email: tech.email,
        active_count: tech.active_count,
        max_active: MAX_ACTIVE_TICKETS,
        resolved_last_7_days: row ? row.resolved_last_7_days : 0,
        last_action: lastAction,
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
