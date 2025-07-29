// Game utility functions

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param {Array} array - The array to shuffle
 * @returns {Array} - The shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Start a game timer for a specific phase
 * @param {string} gameStateId - The game state ID
 * @param {number} duration - Timer duration in seconds
 * @param {string} phase - The game phase
 */
function startGameTimer(gameStateId, duration, phase) {
  // Clear any existing timer for this game
  stopGameTimer(gameStateId);
  
  // Store timer data
  gameTimers.set(gameStateId, {
    timer: setTimeout(() => {
      const { handleTimerEnd } = require('../services/timerHandler');
      handleTimerEnd(gameStateId, phase);
    }, duration * 1000),
    endTime: Date.now() + (duration * 1000),
    phase: phase
  });
  
  console.log(`🎮 Started ${phase} timer for game ${gameStateId}: ${duration}s`);
}

/**
 * Stop a game timer
 * @param {string} gameStateId - The game state ID
 */
function stopGameTimer(gameStateId) {
  const timerData = gameTimers.get(gameStateId);
  if (timerData) {
    clearTimeout(timerData.timer);
    gameTimers.delete(gameStateId);
    console.log(`🎮 Stopped timer for game ${gameStateId}`);
  }
}

/**
 * Get remaining time for a game timer
 * @param {string} gameStateId - The game state ID
 * @returns {number|null} - Remaining seconds or null if no timer
 */
function getTimerRemaining(gameStateId) {
  const timerData = gameTimers.get(gameStateId);
  if (!timerData) return null;
  
  const remaining = Math.max(0, Math.ceil((timerData.endTime - Date.now()) / 1000));
  return remaining;
}

// Timer storage
const gameTimers = new Map();

module.exports = {
  shuffleArray,
  startGameTimer,
  stopGameTimer,
  getTimerRemaining,
  gameTimers,
}; 