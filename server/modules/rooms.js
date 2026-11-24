// Server-authoritative room store. This is the single source of truth for
// room/player/game state — the client only ever displays what it's told.

// Ambiguous characters (0/O, 1/I) are excluded so codes are easy to read aloud/type.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 4;

const GRACE_MS = 15 * 1000; // reconnect grace period after a mid-game disconnect
const WAITING_TTL_MS = 30 * 60 * 1000; // safety-net cleanup for abandoned waiting rooms
const FINISHED_TTL_MS = 5 * 60 * 1000; // safety-net cleanup for finished rooms
const SWEEP_INTERVAL_MS = 60 * 1000;

// Keyed by room code. Each value is { code, hostId, bestOf, firstTo, players,
// status, score, winnerId, reason, createdAt, finishedAt } - see createRoom().
const rooms = new Map();

function generateCode() {
  let code;
  do {
    code = "";
    for (let i = 0; i < CODE_LEN; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom({ hostClientId, hostUserId, hostUsername, hostSocketId, bestOf }) {
  const normalizedBestOf = Number(bestOf) === 5 ? 5 : 3;
  const code = generateCode();

  const room = {
    code,
    hostId: hostClientId,
    bestOf: normalizedBestOf,
    firstTo: Math.ceil(normalizedBestOf / 2),
    players: [
      {
        clientId: hostClientId,
        userId: hostUserId,
        username: hostUsername,
        socketId: hostSocketId,
        connected: true,
        choice: null,
        disconnectTimer: null,
      },
    ],
    status: "waiting",
    score: { [hostClientId]: 0 },
    winnerId: null,
    reason: null,
    createdAt: Date.now(),
    finishedAt: null,
  };

  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  if (!code) return undefined;
  return rooms.get(String(code).toUpperCase());
}

function deleteRoom(code) {
  rooms.delete(code);
}

function findRoomBySocketId(socketId) {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) return { room, player };
  }
  return null;
}

// The live (not finished) room this account holds a seat in, if any - used to
// enforce "one active room per account" across tabs and browsers. A player
// who disconnected but is still inside the reconnect grace period counts.
function findActiveRoomByUserId(userId) {
  for (const room of rooms.values()) {
    if (room.status === "finished") continue;
    if (room.players.some((p) => p.userId === userId)) return room;
  }
  return null;
}

function playerByClientId(room, clientId) {
  return room.players.find((p) => p.clientId === clientId) || null;
}

function otherPlayer(room, clientId) {
  return room.players.find((p) => p.clientId !== clientId) || null;
}

function lobbySummary() {
  return [...rooms.values()]
    .filter((r) => r.status !== "finished")
    .map((r) => ({
      code: r.code,
      status: r.status,
      playerCount: r.players.length,
      bestOf: r.bestOf,
    }));
}

// Never leak a player's locked-in-but-not-yet-revealed choice to the room.
function publicRoomState(room) {
  return {
    code: room.code,
    status: room.status,
    bestOf: room.bestOf,
    firstTo: room.firstTo,
    hostId: room.hostId,
    players: room.players.map((p) => ({
      clientId: p.clientId,
      username: p.username,
      connected: p.connected,
      hasChosen: Boolean(p.choice),
    })),
    score: room.score,
    winnerId: room.winnerId,
    reason: room.reason,
  };
}

module.exports = {
  GRACE_MS,
  WAITING_TTL_MS,
  FINISHED_TTL_MS,
  SWEEP_INTERVAL_MS,
  rooms,
  createRoom,
  getRoom,
  deleteRoom,
  findRoomBySocketId,
  findActiveRoomByUserId,
  playerByClientId,
  otherPlayer,
  lobbySummary,
  publicRoomState,
};
