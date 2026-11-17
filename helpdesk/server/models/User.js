const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // unique: true creates the unique index on email required by the spec
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['user', 'technician', 'admin'], required: true },
  // number of tickets "En cours" of a technician (used later to enforce BR2)
  active_count: { type: Number, default: 0, min: 0 },
  // BR11: only an "active" account can log in.
  // Default "active" (seed and administrator-created accounts); self-registration sets "pending".
  status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'active' },
  created_at: { type: Date, default: Date.now },
});

// Index used to list the pending requests (6.11)
userSchema.index({ status: 1 });

module.exports = mongoose.model('User', userSchema);
