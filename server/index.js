const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());

const port = process.env.PORT || "3001"

// create http server which is recommended way to build server by socket io
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // where the client port will be
        methods: ["GET", "POST"],
    },
});

//array storing all active rooms. MUST BE GLOBAL, not inside connection function, as it refreshes each time
let rooms = [];

// global variables to track user 1 and 2 data
let user1Data;
let user2Data;

function compareInputs(data) {
    if (!user1Data){
        user1Data = data;
        console.log("user1 input: "+ user1Data.input)
    } else {
        user2Data = data;
        console.log("user2 input:" + user2Data.input)
        
        if (user1Data.input == 'Rock' && user2Data.input == "Scissor" ) {
            
            let gameResult = "User 1 Won!"
            io.to(user2Data.roomId).emit("game_result", gameResult); //sends message to everyone in room
            //or use socket to emit message to all in the room except that socket
            // socket.to(room).emit(event);

        } else if (user1Data.input == "Rock" && user2Data.input == "Paper") {
            
            // console.log("User 2 won with paper!");
            let gameResult = "User 2 Won!"
            io.to(user2Data.roomId).emit("game_result", gameResult);

        } else if (user1Data.input == 'Scissor' && user2Data.input == "Rock") {
            
            // console.log("User 2 Won!")
            let gameResult = "User 2 Won!"
            io.to(user2Data.roomId).emit("game_result", gameResult);
        
        } else if (user1Data.input == "Scissor" && user2Data.input == "Paper") {
            
            // console.log("user 1 won with scissors");
            let gameResult = "User 1 Won!"
            io.to(user2Data.roomId).emit("game_result", gameResult);
        
        } else if (user1Data.input == "Paper" && user2Data.input == "Rock") {
            
            // console.log("User 1 Won with Paper.")
            let gameResult = "User 1 Won!"
            io.to(user2Data.roomId).emit("game_result", gameResult);
        
        }  else if (user1Data.input == "Paper" && user2Data.input == "Scissor") {
        
            // console.log("user 2 won with scissors!")
            let gameResult = "User 2 Won!"
            io.to(user2Data.roomId).emit("game_result", gameResult);

        } else {
            // console.log("tie");
            io.to(user2Data.roomId).emit("game_result", "tie");
        } 
            user1Data = null;
            user2Data = null;
    }
}

//detects connections from clients
io.on("connection", (socket) => {
    console.log(`user connected: ${socket.id}`);
    
    socket.on("join_room", (room) => {
        socket.join(room);
    })

    socket.on("get_rooms", () => {
        socket.emit("send_rooms", rooms);
    })

    //create room
    socket.on("create_room", (room) => {

        //add room to rooms list
        rooms.push(room);
        
        //broadcast rooms to all clients connected to server to update list of rooms on client side
        socket.emit("send_rooms", rooms);
        //create and join the new room
        // socket.join(room);
    })

    //when user presses join game
    socket.on('join_game', (room) => {
        //first join that room
        // socket.join(room);
        
        socket.emit("display_game", room);
        
        //sends user into game that is hosted by room
        // socket.to(room).emit("display_game");
        
    })
        
    //receives user_choice value. here should be logic to check if theres a winner
    socket.on("user_choice", async (data) => { // this data should contain what hand user dealt, and room id

        //logic to handle game
        const results = await compareInputs(data);
        //need to know who sent data
        

        // here we should emit a message to winner and loser separately
        // socket.emit("game_result", message);
    } );

})

server.listen(3001, () => {
    console.log(`Listening on localhost:${port}`);
});