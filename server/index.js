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

//detects connections from clients
io.on("connection", (socket) => {
    console.log(`user connected: ${socket.id}`);
    
    //creates and joins the room with roomId
    socket.on("join_room", (roomId) => {
        socket.join(roomId);
    });

    //receives user_choice value. here should be logic to check if theres a winner
    socket.on("user_choice", (data ) => { // this data should contain what hand user dealt, and room id
        console.log(data);
        // here we should emit a message to winner and loser separately
        socket.to(data.roomId).emit("You Won!");
    } );

    
    
})

server.listen(3001, () => {
    console.log(`Listening on localhost:${port}`);
});