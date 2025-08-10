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
    const { gameStateId, roomId, playerIds, gameSettings } = req.body;
    
    let targetGameStateId = gameStateId;
    
    // If no gameStateId provided, create a new game state
    if (!gameStateId) {
      if (!roomId || !playerIds || !gameSettings) {
        return res.status(400).json({ error: 'Either gameStateId or (roomId, playerIds, gameSettings) are required' });
      }
      
      console.log('🎮 Creating new game state for room:', roomId);
      
      // Get room information
      const roomDoc = await databases.getDocument(
        DATABASE_ID,
        ROOMS_COLLECTION_ID,
        roomId
      );
      
      // Create player usernames map
      const playerUsernames = {};
      for (const playerId of playerIds) {
        // For now, use player ID as username - this should be enhanced to get actual usernames
        playerUsernames[playerId] = `Player ${playerId}`;
      }
      
      // Create initial game state
      const initialGameState = {
        roomId: roomId,
        phase: 'starting',
        currentDay: 1,
        currentNight: 1,
        playerRoles: JSON.stringify({}),
        playerAlive: JSON.stringify({}),
        playerUsernames: JSON.stringify(playerUsernames),
        eliminatedPlayers: [], // Array of strings, not JSON string
        nightActions: JSON.stringify({}),
        votes: JSON.stringify({}),
        phaseStartTime: new Date().toISOString(),
        phaseTimeRemaining: gameSettings.selectionTime || 15,
        winner: null,
        gameLog: [] // Array of strings, not JSON string
      };
      
      // Create the game state document
      const newGameStateDoc = await databases.createDocument(
        DATABASE_ID,
        GAME_STATES_COLLECTION_ID,
        'unique()', // Auto-generate ID
        initialGameState
      );
      
      targetGameStateId = newGameStateDoc.$id;
      console.log('🎮 Created new game state with ID:', targetGameStateId);
    }

    // Get game state
    const gameStateDoc = await databases.getDocument(
      DATABASE_ID,
      GAME_STATES_COLLECTION_ID,
      targetGameStateId
    );

    // Get game settings from room
    const roomDoc = await databases.getDocument(
      DATABASE_ID,
      ROOMS_COLLECTION_ID,
      gameStateDoc.roomId
    );
    const roomGameSettings = JSON.parse(roomDoc.gameSettings || '{}');

    console.log('🎮 Assigning roles for game:', targetGameStateId);
    console.log('🎮 Game settings:', roomGameSettings);

    const result = await assignRoles(targetGameStateId, roomGameSettings);
    
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
    
    // Get current game state to calculate remaining time
    const gameStateDoc = await databases.getDocument(
      DATABASE_ID,
      GAME_STATES_COLLECTION_ID,
      gameStateId
    );
    
    const gameState = gameStateDoc;
    const phaseStartTime = new Date(gameState.phaseStartTime);
    const currentTime = new Date();
    
    // Get game settings from room
    const roomDoc = await databases.getDocument(
      DATABASE_ID,
      ROOMS_COLLECTION_ID,
      gameState.roomId
    );
    const gameSettings = JSON.parse(roomDoc.gameSettings || '{}');
    
    // Calculate phase duration based on current phase
    let phaseDuration;
    switch (gameState.phase) {
      case 'starting':
        phaseDuration = gameSettings.selectionTime || 15;
        break;
      case 'night':
        phaseDuration = gameSettings.nightTime || 45;
        break;
      case 'day':
        phaseDuration = gameSettings.discussionTime || 120;
        break;
      case 'voting':
        phaseDuration = gameSettings.votingTime || 60;
        break;
      default:
        phaseDuration = 0;
    }
    
    // Calculate remaining time
    const elapsedSeconds = Math.floor((currentTime - phaseStartTime) / 1000);
    const remainingSeconds = Math.max(0, phaseDuration - elapsedSeconds);
    
    res.json({
      success: true,
      remainingSeconds: remainingSeconds,
      phase: gameState.phase,
      phaseDuration: phaseDuration,
      phaseStartTime: gameState.phaseStartTime
    });
    
  } catch (error) {
    console.error('Error getting timer remaining:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get timer remaining'
    });
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