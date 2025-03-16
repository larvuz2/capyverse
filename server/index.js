const express = require('express');
const http = require('http');
const cors = require('cors');
const { initializeSocketServer } = require('./socket');

// Create Express app
const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io with the server
initializeSocketServer(server);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Server is running');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 