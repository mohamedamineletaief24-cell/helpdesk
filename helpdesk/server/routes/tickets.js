const express = require('express');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Comment = require('../models/Comment');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Strict check of a 24-character hexadecimal id (mongoose.isValidObjectId also accepts any 12-character text)
function isObjectId(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// Adds a "comments" array to each ticket (used by the lists of 6.3 and 6.4, so that
// the user and the technician can read the comment written when a ticket is resolved).
async function attachComments(tickets) {
  if (tickets.length === 0) return tickets;

  const comments = await Comment.find({ ticket_id: { $in: tickets.map((t) => t._id) } })
    .populate('author_id', 'name')
    .sort({ created_at: 1 })
    .lean();

  const byTicket = new Map();
  for (const c of comments) {
    const key = String(c.ticket_id);
    if (!byTicket.has(key)) byTicket.set(key, []);
    byTicket.get(key).push({
      _id: c._id,
      content: c.content,
      created_at: c.created_at,
      author: c.author_id ? c.author_id.name : null,
    });
  }
  for (const t of tickets) {
    t.comments = byTicket.get(String(t._id)) || [];
  }
  return tickets;
}

// Both students edit this file: one clearly separated section per story.
// Keep GET /mine (6.3) ABOVE any route with /:id, otherwise "mine" is read as an id.

// =====================================================================
// 6.2 Open a ticket (Majd)
// POST /api/tickets   role: user
// =====================================================================
router.post('/', authenticate, requireRole('user'), async (req, res) => {
  try {
    const { title, description, category, priority } = req.body || {};

    // Text fields: must be non-empty strings
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanDescription = typeof description === 'string' ? description.trim() : '';

    if (!cleanTitle || !cleanDescription) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    if (cleanTitle.length > 120) {
      return res.status(400).json({ error: 'Title must be 120 characters or fewer' });
    }
    if (cleanDescription.length > 2000) {
      return res.status(400).json({ error: 'Description must be 2000 characters or fewer' });
    }
    if (!Ticket.CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Category must be one of: ${Ticket.CATEGORIES.join(', ')}` });
    }
    if (!Ticket.PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${Ticket.PRIORITIES.join(', ')}` });
    }

    // Only the four fields above are read from the body.
    // status (Ouvert) and created_at (now) are set by the server (BR5),
    // created_by comes from the token (BR8), so none of them can be forged.
    const ticket = await Ticket.create({
      title: cleanTitle,
      description: cleanDescription,
      category,
      priority,
      created_by: req.user.id,
    });

    return res.status(201).json(ticket);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// =====================================================================
// 6.3 Follow my tickets (Majd)
// GET /api/tickets/mine   role: user
// =====================================================================
router.get('/mine', authenticate, requireRole('user'), async (req, res) => {
  try {
    // BR8: the filter uses the id from the token, never an id sent by the client,
    // so a user can only ever see their own tickets.
    const tickets = await Ticket.find({ created_by: req.user.id })
      .populate('technician_id', 'name') // replaces the id by { _id, name }; stays null if no technician yet
      .sort({ created_at: -1 }) // newest first
      .lean();

    await attachComments(tickets);
    return res.status(200).json(tickets); // empty array if the user has no ticket
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// =====================================================================
// 6.4 Take a ticket in charge (together: the hard point, BR1 + BR2)
// =====================================================================
const MAX_ACTIVE_TICKETS = 5; // BR2

// Gives back a reserved slot (never goes below 0)
async function releaseSlot(techId) {
  try {
    await User.updateOne({ _id: techId, active_count: { $gt: 0 } }, { $inc: { active_count: -1 } });
  } catch (err) {
    console.error('Could not release the slot of technician', techId, err);
  }
}

// GET /api/tickets?status=&priority=&technician=   role: technician   (6.7, Majd)
// BR6: the filters can be combined. The filter object is built ONLY from the parameters
// that are provided (an empty value means "not provided"), then given to ONE Ticket.find().
router.get('/', authenticate, requireRole('technician'), async (req, res) => {
  try {
    const { status, priority, technician } = req.query;
    const filter = {};

    for (const value of [status, priority, technician]) {
      // Only plain text is accepted: status[$ne]=x would give an object (NoSQL injection)
      if (value !== undefined && typeof value !== 'string') {
        return res.status(400).json({ error: 'Invalid filter' });
      }
    }

    if (status) {
      if (!Ticket.STATUSES.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${Ticket.STATUSES.join(', ')}` });
      }
      filter.status = status;
    }
    if (priority) {
      if (!Ticket.PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: `Priority must be one of: ${Ticket.PRIORITIES.join(', ')}` });
      }
      filter.priority = priority;
    }
    if (technician) {
      if (!isObjectId(technician)) {
        return res.status(400).json({ error: 'Invalid technician id' });
      }
      filter.technician_id = technician;
    }

    const tickets = await Ticket.find(filter)
      .populate('technician_id', 'name')
      .populate('created_by', 'name')
      .sort({ created_at: -1 })
      .lean();
    await attachComments(tickets);

    return res.status(200).json(tickets); // empty array when nothing matches (T9), never an error
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tickets/:id/take   role: technician
// Two atomic steps. "Atomic" = MongoDB checks the condition AND changes the document
// in one single operation, so two requests at the same time cannot both win (Q6).
router.patch('/:id/take', authenticate, requireRole('technician'), async (req, res) => {
  const ticketId = req.params.id;
  const techId = req.user.id;
  let slotReserved = false;

  if (!mongoose.isValidObjectId(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  try {
    // STEP 1 (BR2): reserve a slot. Works only if active_count is still below 5.
    const technician = await User.findOneAndUpdate(
      { _id: techId, role: 'technician', active_count: { $lt: MAX_ACTIVE_TICKETS } },
      { $inc: { active_count: 1 } },
      { new: true }
    );

    if (!technician) {
      const accountExists = await User.exists({ _id: techId, role: 'technician' });
      if (!accountExists) {
        return res.status(401).json({ error: 'Account not found' });
      }
      return res.status(409).json({
        error: `Limit reached: you already have ${MAX_ACTIVE_TICKETS} tickets En cours`,
      });
    }
    slotReserved = true;

    // STEP 2 (BR1): claim the ticket. Works only if it is still Ouvert and has no technician.
    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId, status: 'Ouvert', technician_id: null },
      { $set: { status: 'En cours', technician_id: techId, taken_at: new Date() } },
      { new: true }
    );

    if (!ticket) {
      // Ticket not claimed: give the reserved slot back
      await releaseSlot(techId);
      slotReserved = false;

      const ticketExists = await Ticket.exists({ _id: ticketId });
      if (!ticketExists) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      return res.status(409).json({ error: 'Ticket already taken' });
    }

    slotReserved = false; // the slot now belongs to this ticket
    await ticket.populate('technician_id', 'name');

    return res.status(200).json({ ticket, active_count: technician.active_count });
  } catch (err) {
    console.error(err);
    if (slotReserved) {
      await releaseSlot(techId); // an error happened between the 2 steps: do not lose the slot
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

// =====================================================================
// 6.5 Comment and resolve (Mohamed Amine)
// POST /api/tickets/:id/resolve   role: technician (the assigned one)
// =====================================================================
router.post('/:id/resolve', authenticate, requireRole('technician'), async (req, res) => {
  const ticketId = req.params.id;
  const techId = req.user.id;

  if (!mongoose.isValidObjectId(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  // BR3: the comment is mandatory
  const rawComment = req.body && req.body.comment;
  const comment = typeof rawComment === 'string' ? rawComment.trim() : '';
  if (!comment) {
    return res.status(400).json({ error: 'A comment is required to resolve a ticket' });
  }
  if (comment.length > 2000) {
    return res.status(400).json({ error: 'The comment must be 2000 characters or fewer' });
  }

  try {
    // STEP 1: resolve the ticket. One atomic operation: it works only if the ticket is
    // En cours AND assigned to this technician, so nobody else can resolve it (T4).
    const resolved = await Ticket.findOneAndUpdate(
      { _id: ticketId, status: 'En cours', technician_id: techId },
      { $set: { status: 'Résolu', resolved_at: new Date() } }, // resolution date saved (BR3)
      { new: true }
    );

    if (!resolved) {
      // Find out why, to answer with the right code
      const existing = await Ticket.findById(ticketId).select('status technician_id').lean();
      if (!existing) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      if (!existing.technician_id || String(existing.technician_id) !== String(techId)) {
        return res.status(403).json({ error: 'Only the technician assigned to this ticket can resolve it' });
      }
      return res.status(409).json({ error: 'Only a ticket En cours can be resolved' });
    }

    // STEP 2: save the comment. If it fails, undo step 1 so that a ticket is never
    // resolved without a comment.
    let saved;
    try {
      saved = await Comment.create({ ticket_id: ticketId, author_id: techId, content: comment });
    } catch (err) {
      await Ticket.updateOne(
        { _id: ticketId, status: 'Résolu' },
        { $set: { status: 'En cours', resolved_at: null } }
      );
      throw err;
    }

    // STEP 3: give the slot back (BR2): the technician has one ticket En cours less.
    let technician = null;
    try {
      technician =
        (await User.findOneAndUpdate(
          { _id: techId, active_count: { $gt: 0 } },
          { $inc: { active_count: -1 } },
          { new: true }
        )) || (await User.findById(techId));
    } catch (err) {
      // The ticket is resolved and commented: do not fail the request for this.
      // If it ever happens, tests/reset-test-data.js recomputes active_count.
      console.error('Could not decrease active_count of technician', techId, err);
    }

    await resolved.populate('technician_id', 'name');

    return res.status(200).json({
      ticket: resolved,
      comment: {
        _id: saved._id,
        content: saved.content,
        created_at: saved.created_at,
        author: technician ? technician.name : null,
      },
      active_count: technician ? technician.active_count : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// =====================================================================
// 6.6 Close and reopen (Majd) - role: user, owner of the ticket only (Q3)
// =====================================================================
const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // BR4: 7 days after the resolution

// PATCH /api/tickets/:id/close   only if the ticket is Résolu
router.patch('/:id/close', authenticate, requireRole('user'), async (req, res) => {
  const ticketId = req.params.id;
  const userId = req.user.id;

  if (!isObjectId(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  try {
    // One atomic operation: it works only for the owner AND a ticket Résolu
    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId, created_by: userId, status: 'Résolu' },
      { $set: { status: 'Fermé', closed_at: new Date() } },
      { new: true }
    );

    if (!ticket) {
      const existing = await Ticket.findById(ticketId).select('status created_by').lean();
      if (!existing) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      if (String(existing.created_by) !== String(userId)) {
        return res.status(403).json({ error: 'Only the owner of the ticket can close it' }); // T6
      }
      return res.status(409).json({ error: 'Only a resolved ticket can be closed' }); // T7
    }

    return res.status(200).json({ ticket });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tickets/:id/reopen   only within 7 days of resolved_at (BR4)
router.patch('/:id/reopen', authenticate, requireRole('user'), async (req, res) => {
  const ticketId = req.params.id;
  const userId = req.user.id;

  if (!isObjectId(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  try {
    const cutoff = new Date(Date.now() - REOPEN_WINDOW_MS);

    // Q1: back to Ouvert, the technician is removed (his counter was already decreased when he
    // resolved the ticket). The dates of the previous work are cleared, so the statistics
    // do not count this ticket as resolved until it is resolved again.
    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId, created_by: userId, status: 'Résolu', resolved_at: { $gte: cutoff } },
      { $set: { status: 'Ouvert', technician_id: null, taken_at: null, resolved_at: null } },
      { new: true }
    );

    if (!ticket) {
      const existing = await Ticket.findById(ticketId).select('status created_by').lean();
      if (!existing) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      if (String(existing.created_by) !== String(userId)) {
        return res.status(403).json({ error: 'Only the owner of the ticket can reopen it' }); // T6
      }
      if (existing.status !== 'Résolu') {
        // Q4: a closed ticket cannot be reopened
        return res.status(409).json({ error: 'Only a resolved ticket can be reopened' });
      }
      return res.status(409).json({ error: 'Reopening is only possible within 7 days after the resolution' }); // T5
    }

    return res.status(200).json({ ticket });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
