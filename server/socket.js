const { Server } = require('socket.io');
const { addPlayer, removePlayer, updatePlayerPosition, getAllPlayers } = require('./playerManager');

function initializeSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // In production, limit this to your game domain
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Handle player join
    socket.on('join', (playerData) => {
      const player = addPlayer({
        id: socket.id,
        name: playerData.name || `Player-${socket.id.substring(0, 5)}`,
        position: { x: 0, y: 1, z: 0 },
        rotation: { y: Math.PI },
        animationState: 'idle'
      });

      // Log all current players
      console.log('Current players:');
      getAllPlayers().forEach(p => {
        console.log(`- ${p.id} (${p.name}): position=${JSON.stringify(p.position)}`);
      });

      // Send the current state to the new player
      const gameState = {
        playerId: socket.id,
        players: getAllPlayers()
      };
      console.log(`Sending gameState to new player ${socket.id}:`, gameState);
      socket.emit('gameState', gameState);

      // Broadcast to all other players that a new player joined
      console.log(`Broadcasting playerJoined event for ${player.name} (${socket.id})`);
      socket.broadcast.emit('playerJoined', player);
      
      console.log(`Player joined: ${player.name} (${socket.id})`);
    });

    // Handle player position updates
    socket.on('updatePosition', (data) => {
      console.log(`Position update from ${socket.id}:`, data);
      
      // Update player position, rotation and animation state
      const updatedPlayer = updatePlayerPosition(socket.id, {
        position: data.position,
        rotation: data.rotation,
        animationState: data.animationState
      });
      
      if (updatedPlayer) {
        // Broadcast the update to all other players
        console.log(`Broadcasting playerMoved for ${socket.id}:`, updatedPlayer);
        socket.broadcast.emit('playerMoved', updatedPlayer);
      } else {
        console.warn(`Failed to update position for player ${socket.id}`);
      }
    });

    // Handle disconnections
    socket.on('disconnect', () => {
      const removedPlayer = removePlayer(socket.id);
      if (removedPlayer) {
        io.emit('playerLeft', { id: socket.id });
        console.log(`Player disconnected: ${removedPlayer.name} (${socket.id})`);
      } else {
        console.log(`Connection disconnected: ${socket.id}`);
      }
    });
  });

  return io;
}

module.exports = { initializeSocketServer }; 