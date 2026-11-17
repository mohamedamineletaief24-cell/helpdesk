const mongoose = require('mongoose');

// A comment written by a technician on a ticket (mandatory when resolving, BR3)
const commentSchema = new mongoose.Schema({
  ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  created_at: { type: Date, default: Date.now },
});

// Index required by the spec: the comments of a ticket
commentSchema.index({ ticket_id: 1 });

module.exports = mongoose.model('Comment', commentSchema);
