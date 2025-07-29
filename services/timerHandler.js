const { databases, DATABASE_ID, GAME_STATES_COLLECTION_ID } = require('../config/database');
const { startGameTimer } = require('../utils/gameHelpers');
const { processNightActions, processVoting } = require('./gameLogic');

/**
 * Handle timer end events for different game phases
 * @param {string} gameStateId - The game state ID
 * @param {string} phase - The game phase that ended
 */
async function handleTimerEnd(gameStateId, phase) {
  try {
    console.log(`🎮 Server timer ended for game ${gameStateId}, phase ${phase}`);
    
    switch (phase) {
      case 'starting':
        // Transition to night phase
        await databases.updateDocument(
          DATABASE_ID,
          GAME_STATES_COLLECTION_ID,
          gameStateId,
          {
            phase: 'night',
            phaseStartTime: new Date().toISOString(),
            phaseTimeRemaining: 45 // 45 seconds for night phase
          }
        );
        startGameTimer(gameStateId, 45, 'night');
        break;
        
      case 'night':
        // Process night actions
        await processNightActions(gameStateId);
        break;
        
      case 'day':
        // Transition to voting phase
        await databases.updateDocument(
          DATABASE_ID,
          GAME_STATES_COLLECTION_ID,
          gameStateId,
          {
            phase: 'voting',
            phaseStartTime: new Date().toISOString(),
            phaseTimeRemaining: 30 // 30 seconds for voting
          }
        );
        startGameTimer(gameStateId, 30, 'voting');
        break;
        
      case 'voting':
        // Process voting
        await processVoting(gameStateId);
        break;
        
      default:
        console.log(`🎮 Unknown phase: ${phase}`);
    }
  } catch (error) {
    console.error('Error in handleTimerEnd:', error);
  }
}

module.exports = {
  handleTimerEnd,
}; 