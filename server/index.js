const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const config = require("./config.js");

const { determineWinner } = require("./modules/determineWinner.js");
const roomsStore = require("./modules/rooms.js");
const db = require("./modules/db.js");

app.use(cors());

// create http server which is recommended way to build server by socket io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.ORIGIN_URL,
    methods: ["GET", "POST"],
  },
});

function broadcastLobby() {
  io.emit("send_rooms", roomsStore.lobbySummary());
}

// Emits game_over (if applicable), removes sockets from the room, deletes the
// room from the store, and refreshes the lobby for everyone. This is the one
// place a room gets destroyed, so every "delete" requirement funnels through it.
function closeRoom(code, notify) {
  if (notify) {
    io.to(code).emit("room_closed", notify);
  }
  io.in(code).socketsLeave(code);
  roomsStore.deleteRoom(code);
  broadcastLobby();
}

// Fire-and-forget: a slow/failed DB write should never delay game_over
// reaching players or block the room from closing. Errors are logged, not
// surfaced to clients - a missed stat update isn't worth stalling the match.
async function recordMatchResult(room, winnerClientId, loserClientId) {
  const winner = roomsStore.playerByClientId(room, winnerClientId);
  const loser = roomsStore.playerByClientId(room, loserClientId);
  if (!winner?.userId || !loser?.userId) return;

  const [p1, p2] = room.players;
  const winnerScore = room.score[winnerClientId] ?? 0;
  const loserScore = room.score[loserClientId] ?? 0;

  try {
    await db.query("UPDATE users SET win = win + 1 WHERE id = ?", [winner.userId]);
    await db.query("UPDATE users SET loss = loss + 1 WHERE id = ?", [loser.userId]);
    await db.query(
      `INSERT INTO history
         (player1_id, player2_id, winner_id, loser_id, reason, winner_score, loser_score)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [p1.userId, p2.userId, winner.userId, loser.userId, room.reason, winnerScore, loserScore]
    );
  } catch (err) {
    console.error(`Failed to record match result for room ${room.code}:`, err);
  }
}

function finishRoom(room, { winnerId, reason }) {
  room.status = "finished";
  room.winnerId = winnerId;
  room.reason = reason;
  room.finishedAt = Date.now();

  if (reason === "forfeit" && winnerId) {
    const winner = roomsStore.playerByClientId(room, winnerId);
    if (winner && winner.socketId) {
      io.to(winner.socketId).emit("opponent_left", {
        message: "Your opponent left the game.",
      });
    }
  }

  io.to(room.code).emit("game_over", {
    winnerId: room.winnerId,
    reason: room.reason,
    score: room.score,
  });

  // "both_disconnected" has no winner and isn't a meaningful competitive
  // result, so it's deliberately never recorded in stats or history.
  if (winnerId && (reason === "normal" || reason === "forfeit")) {
    const loser = roomsStore.otherPlayer(room, winnerId);
    if (loser) {
      recordMatchResult(room, winnerId, loser.clientId);
    }
  }

  closeRoom(room.code);
}

// Shared by the explicit "Leave" button and the socket disconnect handler so
// every way of leaving (tab close, refresh without reconnect, network drop,
// clicking Leave) is handled identically, per spec.
function handlePlayerExit(room, clientId, { immediate }) {
  const player = roomsStore.playerByClientId(room, clientId);
  if (!player) return;

  if (room.status === "waiting") {
    // Only the host can be in a waiting room (status flips to "playing" the
    // instant a 2nd player joins), so this is always "host leaves while waiting".
    closeRoom(room.code, {
      reason: "host_left",
      message: "The host left the room.",
    });
    return;
  }

  if (room.status !== "playing") return;

  if (player.disconnectTimer) {
    clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
  }
  player.connected = false;
  player.socketId = null;

  const opponent = roomsStore.otherPlayer(room, clientId);

  if (!opponent || !opponent.connected) {
    // Both players are now gone - nothing to wait for.
    finishRoom(room, { winnerId: null, reason: "both_disconnected" });
    return;
  }

  if (immediate) {
    finishRoom(room, { winnerId: opponent.clientId, reason: "forfeit" });
    return;
  }

  io.to(room.code).emit("room_update", roomsStore.publicRoomState(room));

  player.disconnectTimer = setTimeout(() => {
    const liveRoom = roomsStore.getRoom(room.code);
    if (!liveRoom || liveRoom.status !== "playing") return;
    const p = roomsStore.playerByClientId(liveRoom, clientId);
    if (!p || p.connected) return; // reconnected within the grace period
    const opp = roomsStore.otherPlayer(liveRoom, clientId);
    if (!opp) return;
    finishRoom(liveRoom, { winnerId: opp.clientId, reason: "forfeit" });
  }, roomsStore.GRACE_MS);
}

//detects connections from clients
io.on("connection", (socket) => {
  socket.on("send_message", (data) => {
    io.to(data.room).emit("receive_message", {
      user: data.user,
      message: data.message,
    });
  });

  socket.on("get_rooms", () => {
    socket.emit("send_rooms", roomsStore.lobbySummary());
  });

  socket.on("create_room", (payload, callback) => {
    const ack = typeof callback === "function" ? callback : () => {};
    const { username, clientId, userId, bestOf } = payload || {};

    if (!username || !clientId || !userId) {
      return ack({ ok: false, message: "Missing player info" });
    }

    const room = roomsStore.createRoom({
      hostClientId: clientId,
      hostUserId: userId,
      hostUsername: username,
      hostSocketId: socket.id,
      bestOf,
    });

    socket.join(room.code);
    broadcastLobby();
    ack({ ok: true, room: roomsStore.publicRoomState(room) });
  });

  socket.on("join_room", (payload, callback) => {
    const ack = typeof callback === "function" ? callback : () => {};
    const { code, username, clientId, userId } = payload || {};

    if (!code || !username || !clientId || !userId) {
      return ack({ ok: false, message: "Missing room code or player info" });
    }

    const room = roomsStore.getRoom(code);
    if (!room) {
      return ack({ ok: false, message: "Room not found" });
    }
    if (room.status === "finished") {
      return ack({ ok: false, message: "Room not found" });
    }

    // Reconnect: same tab (same clientId) rejoining, e.g. after a refresh.
    const existingByClientId = roomsStore.playerByClientId(room, clientId);
    if (existingByClientId) {
      if (existingByClientId.disconnectTimer) {
        clearTimeout(existingByClientId.disconnectTimer);
        existingByClientId.disconnectTimer = null;
      }
      existingByClientId.socketId = socket.id;
      existingByClientId.connected = true;
      existingByClientId.username = username;

      socket.join(room.code);
      io.to(room.code).emit("room_update", roomsStore.publicRoomState(room));
      return ack({ ok: true, room: roomsStore.publicRoomState(room) });
    }

    // Same account already occupies a seat in this room from a different tab.
    const duplicateAccount = room.players.find((p) => p.userId === userId);
    if (duplicateAccount) {
      return ack({
        ok: false,
        message: "You are already in this room in another tab",
      });
    }

    if (room.players.length >= 2) {
      return ack({ ok: false, message: "Room is full" });
    }

    room.players.push({
      clientId,
      userId,
      username,
      socketId: socket.id,
      connected: true,
      choice: null,
      disconnectTimer: null,
    });
    room.score[clientId] = 0;

    if (room.players.length === 2) {
      room.status = "playing";
    }

    socket.join(room.code);
    io.to(room.code).emit("room_update", roomsStore.publicRoomState(room));
    broadcastLobby();
    ack({ ok: true, room: roomsStore.publicRoomState(room) });
  });

  socket.on("leave_room", (payload) => {
    const { code, clientId } = payload || {};
    if (!code || !clientId) return;
    const room = roomsStore.getRoom(code);
    if (!room) return;
    handlePlayerExit(room, clientId, { immediate: true });
  });

  // receives a player's rock/paper/scissors choice for the current round.
  // Server decides the winner - the client never computes or trusts its own result.
  socket.on("user_choice", (data) => {
    const { code, clientId, choice } = data || {};
    if (!code || !clientId || !choice) return;

    const room = roomsStore.getRoom(code);
    if (!room || room.status !== "playing") return; // no moves after finished

    const player = roomsStore.playerByClientId(room, clientId);
    if (!player || !player.connected) return;
    if (player.choice) return; // already locked in for this round

    player.choice = choice;
    io.to(room.code).emit("room_update", roomsStore.publicRoomState(room));

    if (room.players.length < 2) return;
    const [p1, p2] = room.players;
    if (!p1.choice || !p2.choice) return;

    const result = determineWinner(p1.choice, p2.choice);
    let roundWinnerId = null;
    if (result === "Player 1") {
      roundWinnerId = p1.clientId;
      room.score[p1.clientId] += 1;
    } else if (result === "Player 2") {
      roundWinnerId = p2.clientId;
      room.score[p2.clientId] += 1;
    } // "Draw" -> no score change, round replays

    const choices = { [p1.clientId]: p1.choice, [p2.clientId]: p2.choice };
    p1.choice = null;
    p2.choice = null;

    io.to(room.code).emit("round_result", {
      choices,
      winnerId: roundWinnerId,
      score: room.score,
    });

    const matchWinner = room.players.find(
      (p) => room.score[p.clientId] >= room.firstTo
    );

    if (matchWinner) {
      finishRoom(room, { winnerId: matchWinner.clientId, reason: "normal" });
    } else {
      io.to(room.code).emit("room_update", roomsStore.publicRoomState(room));
    }
  });

  //for when a user(socket) leaves a room: tab close, refresh, network drop, etc.
  socket.on("disconnect", () => {
    const found = roomsStore.findRoomBySocketId(socket.id);
    if (!found) return;
    handlePlayerExit(found.room, found.player.clientId, { immediate: false });
  });
});

// Safety net: reap rooms that never got cleaned up through the normal flow
// (e.g. the server restarted mid-match).
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of roomsStore.rooms) {
    if (room.status === "waiting" && now - room.createdAt > roomsStore.WAITING_TTL_MS) {
      closeRoom(code, {
        reason: "expired",
        message: "This room expired from inactivity.",
      });
    } else if (
      room.status === "finished" &&
      room.finishedAt &&
      now - room.finishedAt > roomsStore.FINISHED_TTL_MS
    ) {
      closeRoom(code);
    }
  }
}, roomsStore.SWEEP_INTERVAL_MS);

server.listen(config.PORT, () => {
  console.log(
    `Listening on port:${config.PORT} and socket.io server cors set for origin: ${config.ORIGIN_URL}`
  );
});
