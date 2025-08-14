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
  origin: process.env.FRONTEND_URL,  // Remove trailing slash
  credentials: true
};
app.use(cors(corsOptions));


//middleware
app.use(express.json()); //parse body
app.use(cookieParser());//parese token on every request
app.use(bodyParser.urlencoded({ extended: true })); //parse urlencoded data



//database connection
connectDB();

//server setup
const server = http.createServer(app);
const io = initializeSocket(server);
app.use((req, res, next) => {
  req.io = io; // Attach io to request object for socket communication
  req.socketUserMap = io.socketUserMap
  next();
});




//routes
app.use('/api/auth', authRoute);
app.use('/api/chat', chatRoute);
app.use('/api/status', statusRoute);



server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
