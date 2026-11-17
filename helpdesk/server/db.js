const mongoose = require('mongoose');

// Opens the connection to MongoDB. The URI comes from .env (MONGODB_URI).
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing in .env');
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = connectDB;
