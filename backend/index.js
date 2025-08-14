const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const bodyParser = require('body-parser');
const authRoute = require('./routes/authRoute');
const chatRoute = require('./routes/chatRoute');
const initializeSocket = require('./services/socketService');
const http = require('http');
const statusRoute = require('./routes/statusRoute');

dotenv.config();
console.log("✅ FRONTEND_URL loaded as:", process.env.FRONTEND_URL);

const PORT = process.env.PORT || 5000;
const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true
};
app.use(cors(corsOptions));

// middleware
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// database connection
connectDB();

// server setup
const server = http.createServer(app);
const io = initializeSocket(server);
app.use((req, res, next) => {
  req.io = io;
  req.socketUserMap = io.socketUserMap;
  next();
});

// ✅ Default root route
app.get("/", (req, res) => {
  res.send("🚀 Backend is running and ready for API calls!");
});

// routes
app.use('/api/auth', authRoute);
app.use('/api/chat', chatRoute);
app.use('/api/status', statusRoute);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
