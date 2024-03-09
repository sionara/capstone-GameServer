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

io.on("connection", (socket) => {
    console.log(`user connected: ${socket.id}`);
    //receives user_choice value
    socket.on("user_choice", (data) => {
        console.log(data);
    } )
})

server.listen(3001, () => {
    console.log(`Listening on localhost:${port}`);
});