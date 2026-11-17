const mongoose = require('mongoose');

// Allowed values (also used by the routes to validate the requests)
const CATEGORIES = ['hardware', 'network', 'software'];
const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['Ouvert', 'En cours', 'Résolu', 'Fermé'];

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, enum: CATEGORIES, required: true },
  priority: { type: String, enum: PRIORITIES, required: true },
  status: { type: String, enum: STATUSES, default: 'Ouvert' },

  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  technician_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // BR5: the date is set by the server, never by the client
  created_at: { type: Date, default: Date.now },
  taken_at: { type: Date, default: null },
  resolved_at: { type: Date, default: null },
  closed_at: { type: Date, default: null },
});

// Indexes required by the spec
ticketSchema.index({ created_by: 1 }); // "my tickets" (6.3)
ticketSchema.index({ status: 1, priority: 1, technician_id: 1 }); // combined filters (BR6)

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
module.exports.CATEGORIES = CATEGORIES;
module.exports.PRIORITIES = PRIORITIES;
module.exports.STATUSES = STATUSES;
