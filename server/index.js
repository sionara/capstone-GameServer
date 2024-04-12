const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const config = require("./config.js");

app.use(cors());

// create http server which is recommended way to build server by socket io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // origin: /vercel\.app$/i, //set up origin of request
    origin: process.env.ORIGIN_URL,
    methods: ["GET", "POST"],
  },
});

//array storing all active rooms. MUST BE GLOBAL, not inside connection function, as it refreshes each time
let rooms = [];

// global variables to track user 1 and 2 data
let user1Data;
let user2Data;

//detects connections from clients
io.on("connection", (socket) => {
  // console.log(`user connected: ${socket.id}`);

  // todo: one message receiver to handle them all

  socket.on("send_message", (data) => {
    console.log(data);
    io.to(data.roomId).emit("receive_message", {
      user: data.user,
      message: data.message,
    });
  });

  socket.on("join_room", (room) => {
    socket.join(room);
  });

  socket.on("get_rooms", () => {
    socket.emit("send_rooms", rooms);
  });

  //create room
  socket.on("create_room", (room) => {
    //add room to rooms list
    rooms.push(room);

    //broadcast rooms to all clients connected to server to update list of rooms on client side
    socket.emit("send_rooms", rooms);
  });

  //when user presses join game
  socket.on("join_game", (room) => {
    socket.emit("display_game", room);
  });

  //receives user_choice value. here should be logic to check if theres a winner
  socket.on("user_choice", async (data) => {
    //logic to handle game
    let gameResult;

    if (!user1Data) {
      user1Data = data;
      console.log("user1 input: " + user1Data.input);
    } else {
      user2Data = data;
      console.log("user2 input:" + user2Data.input);

      if (user1Data.input == "Rock" && user2Data.input == "Scissor") {
        gameResult = `${user1Data.username} Won!`;
      } else if (user1Data.input == "Rock" && user2Data.input == "Paper") {
        gameResult = `${user2Data.username} Won!`;
      } else if (user1Data.input == "Scissor" && user2Data.input == "Rock") {
        gameResult = `${user2Data.username} Won!`;
      } else if (user1Data.input == "Scissor" && user2Data.input == "Paper") {
        gameResult = `${user1Data.username} Won!`;
      } else if (user1Data.input == "Paper" && user2Data.input == "Rock") {
        gameResult = `${user1Data.username} Won!`;
      } else if (user1Data.input == "Paper" && user2Data.input == "Scissor") {
        gameResult = `${user2Data.username} Won!`;
      } else {
        gameResult = "Tied!";
      }
      io.to(user2Data.roomId).emit("game_result", gameResult); //sends message to everyone in room, or use socket.to(room).emit(event); to emit message to all in the room except that socket
      user1Data = null;
      user2Data = null;
    }
  });
});

server.listen(config.PORT, () => {
  console.log(
    `Listening on port:${config.PORT} and socket.io server cors set for origin: ${config.ORIGIN_URL}`
  );
});
