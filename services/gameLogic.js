const { databases, DATABASE_ID, ROOMS_COLLECTION_ID, GAME_STATES_COLLECTION_ID } = require('../config/database');
const { shuffleArray, startGameTimer } = require('../utils/gameHelpers');

/**
 * Assign roles to players in a game
 * @param {string} gameStateId - The game state ID
 * @param {Object} gameSettings - Game settings from room
 * @returns {Promise<Object>} - Assignment result
 */
async function assignRoles(gameStateId, gameSettings) {
  try {
    const gameStateDoc = await databases.getDocument(
      DATABASE_ID,
      GAME_STATES_COLLECTION_ID,
      gameStateId
    );

    const gameState = gameStateDoc;
    const playerIds = Object.keys(gameState.playerUsernames);
    
    if (playerIds.length < 4) {
      throw new Error('Need at least 4 players to start the game');
    }

    // Create role assignment array
    const roleAssignment = [];
    
    // Add mafia roles
    for (let i = 0; i < (gameSettings.mafiaCount || 1); i++) {
      roleAssignment.push('mafia');
    }
    
    // Add villager roles
    const villagerCount = playerIds.length - (gameSettings.mafiaCount || 1) - 
                         (gameSettings.doctorCount || 0) - (gameSettings.detectiveCount || 0) -
                         (gameSettings.executionerCount || 0) - (gameSettings.witchCount || 0);
    for (let i = 0; i < villagerCount; i++) {
      roleAssignment.push('villager');
    }
    
    // Add doctor roles
    for (let i = 0; i < (gameSettings.doctorCount || 0); i++) {
      roleAssignment.push('doctor');
    }
    
    // Add detective roles
    for (let i = 0; i < (gameSettings.detectiveCount || 0); i++) {
      roleAssignment.push('detective');
    }
    
    // Add executioner roles
    for (let i = 0; i < (gameSettings.executionerCount || 0); i++) {
      roleAssignment.push('executioner');
    }
    
    // Add witch roles
    for (let i = 0; i < (gameSettings.witchCount || 0); i++) {
      roleAssignment.push('witch');
    }
    
    // Shuffle roles and assign to players
    const shuffledRoles = shuffleArray(roleAssignment);
    const playerRoles = {};
    const playerAlive = {};
    
    playerIds.forEach((playerId, index) => {
      playerRoles[playerId] = shuffledRoles[index] || 'villager';
      playerAlive[playerId] = true;
    });

    // Get game settings from room
    const roomDoc = await databases.getDocument(
      DATABASE_ID,
      ROOMS_COLLECTION_ID,
      gameState.roomId
    );
    const roomGameSettings = JSON.parse(roomDoc.gameSettings || '{}');

    // Update game state
    const updatedGameState = {
      roomId: gameState.roomId,
      phase: 'starting',
      currentDay: 1,
      currentNight: 1,
      playerRoles: JSON.stringify(playerRoles),
      playerAlive: JSON.stringify(playerAlive),
      playerUsernames: JSON.stringify(JSON.parse(gameState.playerUsernames || '{}')), // Ensure it's JSON string
      eliminatedPlayers: gameState.eliminatedPlayers || [], // Array of strings
      nightActions: JSON.stringify({}),
      votes: JSON.stringify(JSON.parse(gameState.votes || '{}')), // Ensure it's JSON string
      phaseStartTime: new Date().toISOString(),
      phaseTimeRemaining: roomGameSettings.startingTime || 15,
      winner: null,
      gameLog: gameState.gameLog || [] // Array of strings
    };

    await databases.updateDocument(
      DATABASE_ID,
      GAME_STATES_COLLECTION_ID,
      gameStateId,
      updatedGameState
    );

    // Start the first timer
    startGameTimer(gameStateId, roomGameSettings.startingTime || 15, 'starting');

    return {
      success: true,
      gameStateId: gameStateId,
      playerRoles: playerRoles,
      message: 'Game started successfully'
    };
  } catch (error) {
    console.error('Error assigning roles:', error);
    throw error;
  }
}

/**
 * Process night actions for a game
 * @param {string} gameStateId - The game state ID
 */
async function processNightActions(gameStateId) {
  try {
    const gameStateDoc = await databases.getDocument(
      DATABASE_ID,
      GAME_STATES_COLLECTION_ID,
      gameStateId
    );

    const gameState = gameStateDoc;
    const playerRoles = JSON.parse(gameState.playerRoles || '{}');
    const playerAlive = JSON.parse(gameState.playerAlive || '{}');
    const playerUsernames = JSON.parse(gameState.playerUsernames || '{}');
    const nightActions = JSON.parse(gameState.nightActions || '{}');

    // Process mafia kill
    let mafiaKillTarget = null;
    if (nightActions.mafia_kill) {
      mafiaKillTarget = nightActions.mafia_kill.target;
    }

    // Process doctor protection
    let doctorProtectionTarget = null;
    if (nightActions.doctor_protect) {
      doctorProtectionTarget = nightActions.doctor_protect.target;
    }

    // Process witch actions
    let witchSaveTarget = null;
    let witchKillTarget = null;
    if (nightActions.witch_action) {
      witchSaveTarget = nightActions.witch_action.saveTarget;
      witchKillTarget = nightActions.witch_action.killTarget;
    }

    // Process detective investigation
    let detectiveInvestigationTarget = null;
    if (nightActions.detective_investigate) {
      detectiveInvestigationTarget = nightActions.detective_investigate.target;
    }

    // Apply night actions
    const gameLog = [...(gameState.gameLog || [])];

    // Check if mafia kill was blocked by doctor
    if (mafiaKillTarget && mafiaKillTarget !== doctorProtectionTarget) {
      playerAlive[mafiaKillTarget] = false;
      gameLog.push(`${playerUsernames[mafiaKillTarget]} was killed by the Mafia`);
    } else if (mafiaKillTarget) {
      gameLog.push(`${playerUsernames[mafiaKillTarget]} was protected by the Doctor`);
    }

    // Apply witch actions
    if (witchSaveTarget && playerAlive[witchSaveTarget] === false) {
      playerAlive[witchSaveTarget] = true;
      gameLog.push(`${playerUsernames[witchSaveTarget]} was saved by the Witch`);
    }

    if (witchKillTarget && playerAlive[witchKillTarget]) {
      playerAlive[witchKillTarget] = false;
      gameLog.push(`${playerUsernames[witchKillTarget]} was killed by the Witch`);
    }

    // Process detective investigation (private - only detective sees this)
    if (detectiveInvestigationTarget) {
      const targetRole = playerRoles[detectiveInvestigationTarget];
      const targetUsername = playerUsernames[detectiveInvestigationTarget];
      
      // Find the detective who performed the investigation
      const detectiveId = Object.keys(playerRoles).find(id => 
        playerRoles[id] === 'detective' && playerAlive[id]
      );
      
      if (detectiveId) {
        const detectiveUsername = playerUsernames[detectiveId];
        // Store detective investigation result privately (not in public gameLog)
        // The detective will see this result in their personal game log
        const detectiveResult = `${detectiveUsername} investigated ${targetUsername} and found they are a ${targetRole}`;
        // Mark it as detective-only with the specific detective's ID
        gameLog.push(`DETECTIVE_PRIVATE:${detectiveId}:${detectiveResult}`);
      }
    }

    // Check win conditions
    const alivePlayers = Object.keys(playerAlive).filter(id => playerAlive[id]);
    const aliveMafia = alivePlayers.filter(id => playerRoles[id] === 'mafia');
    const aliveVillagers = alivePlayers.filter(id => 
      ['doctor', 'detective', 'villager'].includes(playerRoles[id])
    );

    let winner = null;
    if (aliveMafia.length === 0) {
      winner = 'villagers';
    } else if (aliveMafia.length >= aliveVillagers.length) {
      winner = 'mafia';
    }

    // Get game settings from room
    const roomDoc = await databases.getDocument(
      DATABASE_ID,
      ROOMS_COLLECTION_ID,
      gameState.roomId
    );
    const gameSettings = JSON.parse(roomDoc.gameSettings || '{}');

    const updatedGameState = {
      roomId: gameState.roomId,
      phase: winner ? 'gameOver' : 'day',
      currentDay: gameState.currentDay + 1,
      currentNight: gameState.currentNight,
      playerRoles: gameState.playerRoles, // Already JSON string
      playerAlive: JSON.stringify(playerAlive),
      playerUsernames: gameState.playerUsernames, // Already JSON string
      eliminatedPlayers: gameState.eliminatedPlayers || [], // Array of strings
      nightActions: JSON.stringify({}),
      votes: gameState.votes, // Already JSON string
      phaseStartTime: new Date().toISOString(),
      phaseTimeRemaining: winner ? 0 : (gameSettings.discussionTime || 120),
      winner: winner,
      gameLog: gameLog // Array of strings
    };

    await databases.updateDocument(
      DATABASE_ID,
      GAME_STATES_COLLECTION_ID,
      gameStateId,
      updatedGameState
    );

    // Start day timer using game settings (if not game over)
    if (!winner) {
      startGameTimer(gameStateId, gameSettings.discussionTime || 120, 'day');
    }
    
  } catch (error) {
    console.error('Error processing night actions:', error);
    throw error;
  }
}

/**
 * Process voting for a game
 * @param {string} gameStateId - The game state ID
 */
async function processVoting(gameStateId) {
  try {
    const gameStateDoc = await databases.getDocument(
      DATABASE_ID,
      GAME_STATES_COLLECTION_ID,
      gameStateId
    );

    const gameState = gameStateDoc;
    const playerRoles = JSON.parse(gameState.playerRoles || '{}');
    const playerAlive = JSON.parse(gameState.playerAlive || '{}');
    const playerUsernames = JSON.parse(gameState.playerUsernames || '{}');
    const votes = JSON.parse(gameState.votes || '{}');

    // Count votes
    const voteCounts = {};
    Object.values(votes).forEach(targetId => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    // Find player with most votes
    let eliminatedPlayer = null;
    let maxVotes = 0;
    let tie = false;

    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedPlayer = playerId;
        tie = false;
      } else if (count === maxVotes) {
        tie = true;
      }
    });

    const gameLog = [...(gameState.gameLog || [])];

    if (eliminatedPlayer && !tie) {
      playerAlive[eliminatedPlayer] = false;
      gameLog.push(`${playerUsernames[eliminatedPlayer]} was eliminated by vote`);

      // Check for jester win
      if (playerRoles[eliminatedPlayer] === 'jester') {
        gameLog.push('The Jester wins by being eliminated!');
      }

      // Check for executioner win
      const executioner = Object.keys(playerRoles).find(id => 
        playerRoles[id] === 'executioner' && playerAlive[id]
      );
      if (executioner && gameState.executionerTarget === eliminatedPlayer) {
        gameLog.push(`${playerUsernames[executioner]} (Executioner) wins!`);
      }
    } else if (tie) {
      gameLog.push('Vote resulted in a tie - no one was eliminated');
    }

    // Check win conditions
    const alivePlayers = Object.keys(playerAlive).filter(id => playerAlive[id]);
    const aliveMafia = alivePlayers.filter(id => playerRoles[id] === 'mafia');
    const aliveVillagers = alivePlayers.filter(id => 
      ['doctor', 'detective', 'villager'].includes(playerRoles[id])
    );

    let winner = null;
    if (aliveMafia.length === 0) {
      winner = 'villagers';
    } else if (aliveMafia.length >= aliveVillagers.length) {
      winner = 'mafia';
    }

    // Update game state (only include the fields we want to update)
    const updatedGameState = {
      roomId: gameState.roomId,
      phase: winner ? 'gameOver' : 'night',
      currentDay: gameState.currentDay,
      currentNight: gameState.currentNight + 1,
      playerRoles: gameState.playerRoles, // Already JSON string
      playerAlive: JSON.stringify(playerAlive),
      playerUsernames: gameState.playerUsernames, // Already JSON string
      eliminatedPlayers: gameState.eliminatedPlayers || [], // Array of strings
      nightActions: gameState.nightActions, // Already JSON string
      votes: JSON.stringify({}),
      phaseStartTime: gameState.phaseStartTime,
      phaseTimeRemaining: winner ? 0 : 45, // 45 seconds for night phase
      winner: winner,
      gameLog: gameLog // Array of strings
    };

    await databases.updateDocument(
      DATABASE_ID,
      GAME_STATES_COLLECTION_ID,
      gameStateId,
      updatedGameState
    );

    return {
      success: true,
      gameState: updatedGameState,
      message: 'Voting processed successfully'
    };

  } catch (error) {
    console.error('Error in process-voting:', error);
    throw error;
  }
}

module.exports = {
  assignRoles,
  processNightActions,
  processVoting,
}; 