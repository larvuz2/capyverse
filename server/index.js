const express = require('express');
const http = require('http');
const cors = require('cors');
const { initializeSocketServer } = require('./socket');

// Create Express app
const app = express();

// Configure CORS to be more permissive during development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins during development
    callback(null, true);
  },
  methods: ["GET", "POST"],
  credentials: true
};
app.use(cors(corsOptions));

// Additional middleware to ensure CORS headers are set
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io with the server
const io = initializeSocketServer(server);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Server is running');
});

// Status endpoint with player count
app.get('/status', (req, res) => {
  const playerCount = io.engine.clientsCount;
  res.status(200).json({
    status: 'ok',
    playerCount,
    uptime: process.uptime()
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 