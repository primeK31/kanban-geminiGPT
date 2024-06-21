const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config()

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

async function run(message) {
  const prompt = message

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  console.log(text);
  return String(text);
}


app.use(express.static(path.join(__dirname, 'public')));

const users = [];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  socket.on("adduser", username => {
    socket.user = username;
    users.push(username);
    io.sockets.emit("users", users);

    io.to(socket.id).emit("private", {
      id: socket.id,
      name: socket.user,
      msg: "secret message",
    });
  });

  socket.on("message", message => {
    io.sockets.emit("message", {
      message,
      user: socket.user,
      id: socket.id,
    });
    console.log(`Clients: ${users.length}`);
    //io.sockets.emit(run(message))
  });

  socket.on("ai", message => {
    let successfulPromise = new Promise((resolve, reject) => {
      setTimeout(() => resolve(run(message)), 3000);
    });
  
    successfulPromise.then(message => {
        io.sockets.emit("gpt", {
          message,
          user: 'AI',
          id: socket.id,
        });
        console.log('Resolved value:', message);
    }).catch(error => {
        let errorStr = String(error);
        console.error('Error:', errorStr);
    });
  })

  socket.on("disconnect", () => {
    console.log(`user ${socket.user} is disconnected`);
    if (socket.user) {
      users.splice(users.indexOf(socket.user), 1);
      io.sockets.emit("user", users);
      console.log(`Clients: ${users.length}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});