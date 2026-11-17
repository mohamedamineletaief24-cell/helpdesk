const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const technicianRoutes = require('./routes/technicians');
const accountRoutes = require('./routes/accounts');
const statsRoutes = require('./routes/stats');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing in .env');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/stats', statsRoutes);

// Any other /api route that does not exist
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Cannot start the server:', err.message);
    process.exit(1);
  });
