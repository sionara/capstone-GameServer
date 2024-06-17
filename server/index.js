const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const config = require("./config.js");

const { determineWinner } = require("./modules/determineWinner.js");

app.use(cors());

// create http server which is recommended way to build server by socket io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // origin: /vercel\.app$/i, //set up origin of request
    origin: config.ORIGIN_URL,
    methods: ["GET", "POST"],
  },
});

//array storing all active rooms. MUST BE GLOBAL, not inside connection function, as it refreshes each time
let rooms = [];

let users = [];
let games = {};

// global variables to track user 1 and 2 data
let user1Data;
let user2Data;

//detects connections from clients
io.on("connection", (socket) => {
  // console.log(`user connected: ${socket.id}`);

  // todo: one message receiver to handle them all

  socket.on("send_message", (data) => {
    console.log(data);
    io.to(data.room).emit("receive_message", {
      user: data.user,
      message: data.message,
    });
  });

  socket.on("join_room", (data) => {
    if (users.length < 2) {
      users.push(data.username);
    }
    socket.join(data.room);

    // check how many ppl are in current room based on if room was already made
    if (!games[data.room]) {
      games[data.room] = {
        player1: socket.id,
        player2: null,
        rounds: 0,
        player1_wins: 0,
        player2_wins: 0,
      };
    } else {
      games[data.room].player2 = socket.id;
    }

    io.to(data.room).emit("display_players", users);
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

  // receives user_choice value. here should be logic to check if theres a winner
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
      io.to(user2Data.room).emit("game_result", gameResult); //sends message to everyone in room, or use socket.to(room).emit(event); to emit message to all in the room except that socket
      user1Data = null;
      user2Data = null;
    }
  });

  // socket.on("user_choice", (data) => {
  //   const game = games[data.room];
  //   const isPlayer1 = game.player1 === socket.id;
  //   const opponentSocketId = isPlayer1 ? game.player2 : game.player1;

  //   if (!opponentSocketId) {
  //     return; // Wait for the other player
  //   }

  //   if (isPlayer1) {
  //     game.player1_choice = data.input;
  //   } else {
  //     game.player2_choice = data.input;
  //   }

  //   if (game.player1_choice && game.player2_choice) {
  //     io.to(game.player1).emit("opponentChoice", game.player2_choice);
  //     io.to(game.player2).emit("opponentChoice", game.player1_choice);

  //     const result = determineWinner(game.player1_choice, game.player2_choice);
  //     game.rounds += 1;

  //     if (result === "Player 1") {
  //       game.player1_wins += 1;
  //     } else if (result === "Player 2") {
  //       game.player2_wins += 1;
  //     }

  //     delete game.player1_choice;
  //     delete game.player2_choice;

  //     io.to(data.room).emit("gameUpdate", {
  //       player1_wins: game.player1_wins,
  //       player2_wins: game.player2_wins,
  //       rounds: game.rounds,
  //     });
  //   }
  // });

  //for when a user(socket) leaves a room
  socket.on("disconnect", (reason) => {
    socket.broadcast.to(socket.room).emit("user-left", { msg: "user1" });
  });
});

server.listen(config.PORT, () => {
  console.log(
    `Listening on port:${config.PORT} and socket.io server cors set for origin: ${config.ORIGIN_URL}`
  );
});
