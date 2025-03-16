// In-memory store for connected players
const players = new Map();

// Add a new player
function addPlayer(playerData) {
  console.log(`Adding player: ${playerData.id} (${playerData.name})`, playerData);
  
  // Ensure valid position
  if (!playerData.position) {
    console.warn(`No position for player ${playerData.id}, using default`);
    playerData.position = { x: 0, y: 1, z: 0 };
  }
  
  players.set(playerData.id, playerData);
  console.log(`Player count: ${players.size}`);
  return playerData;
}

// Remove a player
function removePlayer(playerId) {
  console.log(`Removing player: ${playerId}`);
  const player = players.get(playerId);
  if (player) {
    players.delete(playerId);
    console.log(`Player ${playerId} removed successfully. Player count: ${players.size}`);
    return player;
  }
  console.warn(`Player ${playerId} not found for removal`);
  return null;
}

// Update player position/rotation/animation
function updatePlayerPosition(playerId, data) {
  const player = players.get(playerId);
  if (player) {
    console.log(`Updating player ${playerId} position`, data);
    
    // Update properties from data with validation
    if (data.position) {
      player.position = data.position;
    } else {
      console.warn(`No position data provided for player ${playerId}`);
    }
    
    if (data.rotation) {
      player.rotation = data.rotation;
    }
    
    if (data.animationState) {
      player.animationState = data.animationState;
    }
    
    // Add timestamp for client-side interpolation
    player.timestamp = Date.now();
    
    return player;
  }
  console.warn(`Player ${playerId} not found for position update`);
  return null;
}

// Get all players
function getAllPlayers() {
  return Array.from(players.values());
}

// Get a specific player
function getPlayer(playerId) {
  return players.get(playerId);
}

module.exports = {
  addPlayer,
  removePlayer,
  updatePlayerPosition,
  getAllPlayers,
  getPlayer
}; 