const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('./db');
const User = require('./models/User');

// One test account per role (no public sign-up, see Q5)
const accounts = [
  { name: 'Test User', email: 'user@school.tn', password: 'user123', role: 'user' },
  { name: 'Test Technician', email: 'tech@school.tn', password: 'tech123', role: 'technician' },
  { name: 'Test Admin', email: 'admin@school.tn', password: 'admin123', role: 'admin' },
];

async function run() {
  try {
    await connectDB();
    for (const a of accounts) {
      const password_hash = await bcrypt.hash(a.password, 10);
      // upsert: creates the account, or resets it if it already exists (safe to run twice)
      await User.findOneAndUpdate(
        { email: a.email },
        { name: a.name, email: a.email, password_hash, role: a.role, active_count: 0, status: 'active' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Account ready: ${a.email} (${a.role})`);
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
