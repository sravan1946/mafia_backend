const express = require('express');
const cors = require('cors');
const { databases, DATABASE_ID, ROOMS_COLLECTION_ID, GAME_STATES_COLLECTION_ID } = require('./config/database');
const { startGameTimer, stopGameTimer, getTimerRemaining } = require('./utils/gameHelpers');
const gameRoutes = require('./routes/gameRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', gameRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Mafia Game Backend API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      testBackend: '/api/test-backend',
      assignRoles: '/api/assign-roles',
      processNightActions: '/api/process-night-actions',
      processVoting: '/api/process-voting',
      timerRemaining: '/api/timer-remaining/:gameStateId'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎮 Mafia Game Backend running on port ${PORT}`);
  console.log(`🎮 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 API docs: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🎮 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🎮 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

module.exports = app; 