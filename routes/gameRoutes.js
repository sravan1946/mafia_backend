const express = require('express');
const { databases, DATABASE_ID, ROOMS_COLLECTION_ID, GAME_STATES_COLLECTION_ID } = require('../config/database');
const { assignRoles, processNightActions, processVoting } = require('../services/gameLogic');
const { getTimerRemaining, startGameTimer } = require('../utils/gameHelpers');

const router = express.Router();

/**
 * Assign roles to players and start the game
 * POST /api/assign-roles
 */
router.post('/assign-roles', async (req, res) => {
  try {
    const { gameStateId } = req.body;
    
    if (!gameStateId) {
      return res.status(400).json({ error: 'Game state ID is required' });
    }

    // Get game state
    const gameStateDoc = await databases.getDocument(
      DATABASE_ID,
      GAME_STATES_COLLECTION_ID,
      gameStateId
    );

    // Get game settings from room
    const roomDoc = await databases.getDocument(
      DATABASE_ID,
      ROOMS_COLLECTION_ID,
      gameStateDoc.roomId
    );
    const gameSettings = JSON.parse(roomDoc.gameSettings || '{}');

    console.log('🎮 Assigning roles for game:', gameStateId);
    console.log('🎮 Game settings:', gameSettings);

    const result = await assignRoles(gameStateId, gameSettings);
    
    res.json(result);
  } catch (error) {
    console.error('Error in assign-roles:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process night actions
 * POST /api/process-night-actions
 */
router.post('/process-night-actions', async (req, res) => {
  try {
    const { gameStateId } = req.body;
    
    if (!gameStateId) {
      return res.status(400).json({ error: 'Game state ID is required' });
    }

    console.log('🎮 Processing night actions for game:', gameStateId);
    await processNightActions(gameStateId);
    
    res.json({ success: true, message: 'Night actions processed successfully' });
  } catch (error) {
    console.error('Error processing night actions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process voting
 * POST /api/process-voting
 */
router.post('/process-voting', async (req, res) => {
  try {
    const { gameStateId } = req.body;
    
    if (!gameStateId) {
      return res.status(400).json({ error: 'Game state ID is required' });
    }

    console.log('🎮 Processing voting for game:', gameStateId);
    const result = await processVoting(gameStateId);
    
    res.json(result);
  } catch (error) {
    console.error('Error in process-voting:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get remaining time for a game timer
 * GET /api/timer-remaining/:gameStateId
 */
router.get('/timer-remaining/:gameStateId', async (req, res) => {
  try {
    const { gameStateId } = req.params;
    
    const remaining = getTimerRemaining(gameStateId);
    
    if (remaining === null) {
      return res.status(404).json({ error: 'No timer found for this game' });
    }
    
    res.json({ remainingSeconds: remaining });
  } catch (error) {
    console.error('Error getting timer remaining:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test backend configuration
 * GET /api/test-backend
 */
router.get('/test-backend', async (req, res) => {
  try {
    // Test database connection
    await databases.listDocuments(DATABASE_ID, ROOMS_COLLECTION_ID, [], 1);
    
    res.json({ 
      success: true, 
      message: 'Backend is healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Backend health check failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 