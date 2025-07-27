const express = require('express');
const cors = require('cors');
const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Helper function to shuffle array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 1. Assign Roles Endpoint
app.post('/api/assign-roles', async (req, res) => {
  try {
    const { roomId, playerIds, gameSettings } = req.body;

    if (!roomId || !playerIds || !gameSettings) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: roomId, playerIds, gameSettings'
      });
    }

    // Validate minimum players
    if (playerIds.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Need at least 4 players to start a game'
      });
    }

    // Validate that we have enough players for the requested roles
    const requestedRoles = (gameSettings.mafiaCount || 0) + (gameSettings.doctorCount || 0) + 
                          (gameSettings.detectiveCount || 0) + (gameSettings.jesterCount || 0) + 
                          (gameSettings.executionerCount || 0) + (gameSettings.witchCount || 0);
    
    if (requestedRoles > playerIds.length) {
      return res.status(400).json({
        success: false,
        error: `Requested ${requestedRoles} special roles but only have ${playerIds.length} players`
      });
    }

    // Create role assignment array
    const roleAssignment = [];
    
    // Ensure at least 1 mafia
    const mafiaCount = Math.max(1, gameSettings.mafiaCount || 0);
    
    // Add mafia roles
    for (let i = 0; i < mafiaCount; i++) {
      roleAssignment.push('mafia');
    }
    
    // Add doctor roles
    for (let i = 0; i < (gameSettings.doctorCount || 0); i++) {
      roleAssignment.push('doctor');
    }
    
    // Add detective roles
    for (let i = 0; i < (gameSettings.detectiveCount || 0); i++) {
      roleAssignment.push('detective');
    }
    
    // Add jester roles
    for (let i = 0; i < (gameSettings.jesterCount || 0); i++) {
      roleAssignment.push('jester');
    }
    
    // Add executioner roles
    for (let i = 0; i < (gameSettings.executionerCount || 0); i++) {
      roleAssignment.push('executioner');
    }
    
    // Add witch roles
    for (let i = 0; i < (gameSettings.witchCount || 0); i++) {
      roleAssignment.push('witch');
    }
    
    // Fill remaining slots with villagers
    const remainingSlots = playerIds.length - roleAssignment.length;
    for (let i = 0; i < remainingSlots; i++) {
      roleAssignment.push('villager');
    }

    // Shuffle the role assignment array
    shuffleArray(roleAssignment);

    // Create player roles map
    const playerRoles = {};
    const playerAlive = {};
    const playerUsernames = {};

    // Assign roles to players
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      const role = roleAssignment[i];
      
      playerRoles[playerId] = role;
      playerAlive[playerId] = true;
      
      // Get username from database
      try {
        const userDoc = await databases.getDocument(
          'mafia_game_db',
          'users',
          playerId
        );
        playerUsernames[playerId] = userDoc.username || 'Unknown Player';
      } catch (e) {
        playerUsernames[playerId] = 'Unknown Player';
      }
    }

    // Create game state
    const gameState = {
      roomId: roomId,
      phase: 'starting',
      currentDay: 0,
      currentNight: 0,
      playerRoles: JSON.stringify(playerRoles),
      playerAlive: JSON.stringify(playerAlive),
      playerUsernames: JSON.stringify(playerUsernames),
      eliminatedPlayers: [],
      nightActions: JSON.stringify({}),
      votes: JSON.stringify({}),
      phaseStartTime: new Date().toISOString(),
      phaseTimeRemaining: 0,
      winner: null,
      gameLog: []
    };

    // Save game state to database
    const gameStateDoc = await databases.createDocument(
      'mafia_game_db',
      'game_states',
      'unique()',
      gameState
    );

    // Update room status
    await databases.updateDocument(
      'mafia_game_db',
      'rooms',
      roomId,
      {
        status: 'playing',
        gameStateId: gameStateDoc.$id
      }
    );

    res.json({
      success: true,
      gameStateId: gameStateDoc.$id,
      playerRoles: playerRoles,
      message: 'Game started successfully'
    });

  } catch (error) {
    console.error('Error in assign-roles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. Process Night Actions Endpoint
app.post('/api/process-night-actions', async (req, res) => {
  try {
    const { gameStateId } = req.body;

    if (!gameStateId) {
      return res.status(400).json({
        success: false,
        error: 'Missing gameStateId'
      });
    }

    // Get current game state
    const gameStateDoc = await databases.getDocument(
      'mafia_game_db',
      'game_states',
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

    // Apply night actions
    const gameLog = [...(gameState.gameLog || [])];

    // Check if mafia kill was blocked by doctor
    if (mafiaKillTarget && mafiaKillTarget !== doctorProtectionTarget) {
      playerAlive[mafiaKillTarget] = false;
      gameLog.push({
        type: 'mafia_kill',
        target: mafiaKillTarget,
        message: `${gameState.playerUsernames[mafiaKillTarget]} was killed by the Mafia`
      });
    } else if (mafiaKillTarget) {
      gameLog.push({
        type: 'doctor_protect',
        target: mafiaKillTarget,
        message: `${gameState.playerUsernames[mafiaKillTarget]} was protected by the Doctor`
      });
    }

    // Apply witch actions
    if (witchSaveTarget && playerAlive[witchSaveTarget] === false) {
      playerAlive[witchSaveTarget] = true;
      gameLog.push({
        type: 'witch_save',
        target: witchSaveTarget,
        message: `${gameState.playerUsernames[witchSaveTarget]} was saved by the Witch`
      });
    }

    if (witchKillTarget && playerAlive[witchKillTarget]) {
      playerAlive[witchKillTarget] = false;
      gameLog.push({
        type: 'witch_kill',
        target: witchKillTarget,
        message: `${gameState.playerUsernames[witchKillTarget]} was killed by the Witch`
      });
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

    // Update game state
    const updatedGameState = {
      ...gameState,
      phase: winner ? 'gameOver' : 'day',
      currentDay: gameState.currentDay + 1,
      playerAlive: JSON.stringify(playerAlive),
      nightActions: JSON.stringify({}),
      gameLog: gameLog,
      winner: winner
    };

    await databases.updateDocument(
      'mafia_game_db',
      'game_states',
      gameStateId,
      updatedGameState
    );

    res.json({
      success: true,
      gameState: updatedGameState,
      message: 'Night actions processed successfully'
    });

  } catch (error) {
    console.error('Error in process-night-actions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. Process Voting Endpoint
app.post('/api/process-voting', async (req, res) => {
  try {
    const { gameStateId } = req.body;

    if (!gameStateId) {
      return res.status(400).json({
        success: false,
        error: 'Missing gameStateId'
      });
    }

    // Get current game state
    const gameStateDoc = await databases.getDocument(
      'mafia_game_db',
      'game_states',
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
      gameLog.push({
        type: 'elimination',
        target: eliminatedPlayer,
        message: `${gameState.playerUsernames[eliminatedPlayer]} was eliminated by vote`
      });

      // Check for jester win
      if (playerRoles[eliminatedPlayer] === 'jester') {
        gameLog.push({
          type: 'jester_win',
          message: 'The Jester wins by being eliminated!'
        });
      }

      // Check for executioner win
      const executioner = Object.keys(playerRoles).find(id => 
        playerRoles[id] === 'executioner' && playerAlive[id]
      );
      if (executioner && gameState.executionerTarget === eliminatedPlayer) {
        gameLog.push({
          type: 'executioner_win',
          target: executioner,
          message: `${gameState.playerUsernames[executioner]} (Executioner) wins!`
        });
      }
    } else if (tie) {
      gameLog.push({
        type: 'tie',
        message: 'Vote resulted in a tie - no one was eliminated'
      });
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

    // Update game state
    const updatedGameState = {
      ...gameState,
      phase: winner ? 'gameOver' : 'night',
      currentNight: gameState.currentNight + 1,
      playerAlive: JSON.stringify(playerAlive),
      votes: JSON.stringify({}),
      gameLog: gameLog,
      winner: winner
    };

    await databases.updateDocument(
      'mafia_game_db',
      'game_states',
      gameStateId,
      updatedGameState
    );

    res.json({
      success: true,
      gameState: updatedGameState,
      message: 'Voting processed successfully'
    });

  } catch (error) {
    console.error('Error in process-voting:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Mafia Game Backend is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mafia Game Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://0.0.0.0:${PORT}/api/health`);
}); 