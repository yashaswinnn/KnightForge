require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { initGameSocket } = require('./sockets/gameSocket');

// 1. ADD THIS LINE - import the chat route
const chatRoute = require('./routes/chat');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/KnightForge';

const server = http.createServer(app);

// 2. ADD THIS LINE - register the route on your app
app.use('/api', chatRoute);

initGameSocket(server);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });