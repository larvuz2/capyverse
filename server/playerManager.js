// In-memory store for connected players
const players = new Map();

// Add a new player
function addPlayer(playerData) {
  players.set(playerData.id, playerData);
  return playerData;
}

// Remove a player
function removePlayer(playerId) {
  const player = players.get(playerId);
  if (player) {
    players.delete(playerId);
    return player;
  }
  return null;
}

// Update player position/rotation/animation
function updatePlayerPosition(playerId, data) {
  const player = players.get(playerId);
  if (player) {
    // Update properties from data
    if (data.position) player.position = data.position;
    if (data.rotation) player.rotation = data.rotation;
    if (data.animationState) player.animationState = data.animationState;
    
    // Add timestamp for client-side interpolation
    player.timestamp = Date.now();
    
    return player;
  }
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