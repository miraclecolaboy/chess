const http = require("http");
const path = require("path");
const express = require("express");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 3000;
const ROWS = 10;
const COLS = 9;
const PIECE_TYPES = new Set([
  "rook",
  "horse",
  "elephant",
  "advisor",
  "king",
  "cannon",
  "pawn"
]);

const app = express();
app.use(express.static(path.resolve(__dirname)));
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const rooms = new Map();

io.on("connection", (socket) => {
  socket.on("join-room", (payload = {}, ack) => {
    const done = typeof ack === "function" ? ack : () => {};
    const nickname = normalizeNickname(payload.nickname);
    const roomId = normalizeRoomId(payload.roomId);

    if (!nickname || !roomId) {
      done({ ok: false, message: "请输入昵称和房间号" });
      return;
    }

    leaveCurrentRoom(socket);

    const room = getOrCreateRoom(roomId);
    const role = assignRole(room, socket.id, nickname);
    room.members.add(socket.id);

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = role;
    socket.data.nickname = nickname;

    done({ ok: true });
    socket.emit("joined", {
      roomId,
      nickname,
      role,
      state: room.state,
      room: serializeRoom(room)
    });
    io.to(roomId).emit("room-info", serializeRoom(room));
  });

  socket.on("sync-state", (payload = {}, ack) => {
    const done = typeof ack === "function" ? ack : () => {};
    const roomId = socket.data.roomId;
    const role = socket.data.role;

    if (!roomId || !rooms.has(roomId)) {
      done({ ok: false, message: "房间不存在，请重新加入" });
      return;
    }

    if (role !== "red" && role !== "black") {
      done({ ok: false, message: "旁观者不能走子" });
      return;
    }

    const room = rooms.get(roomId);

    if (room.state.gameOver) {
      done({ ok: false, message: "本局已结束，请点击继续开始新局" });
      return;
    }

    if (room.state.turn !== role) {
      done({ ok: false, message: "还没轮到你" });
      return;
    }

    const nextState = sanitizeState(payload.state);
    if (!nextState) {
      done({ ok: false, message: "同步数据无效" });
      return;
    }

    if (!nextState.gameOver && nextState.turn === role) {
      done({ ok: false, message: "回合同步异常" });
      return;
    }

    room.state = nextState;
    io.to(roomId).emit("state-sync", {
      state: room.state,
      lastMove: sanitizeMove(payload.lastMove),
      by: role
    });
    done({ ok: true });
  });

  socket.on("restart-game", (_payload = {}, ack) => {
    const done = typeof ack === "function" ? ack : () => {};
    const roomId = socket.data.roomId;
    const role = socket.data.role;

    if (!roomId || !rooms.has(roomId)) {
      done({ ok: false, message: "房间不存在，请重新加入" });
      return;
    }

    if (role !== "red" && role !== "black") {
      done({ ok: false, message: "仅玩家可以继续对局" });
      return;
    }

    const room = rooms.get(roomId);
    if (!room.players.red || !room.players.black) {
      done({ ok: false, message: "需要两位玩家在场才能继续" });
      return;
    }

    room.state = createInitialState();
    io.to(roomId).emit("state-sync", {
      state: room.state,
      lastMove: null,
      by: "system"
    });
    io.to(roomId).emit("room-info", serializeRoom(room));
    done({ ok: true });
  });

  socket.on("leave-room", (ack) => {
    leaveCurrentRoom(socket);
    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on ${PORT}`);
});

function normalizeNickname(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 20);
}

function normalizeRoomId(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 24);
}

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function placeBackRank(board, row, side) {
  const lineup = [
    "rook",
    "horse",
    "elephant",
    "advisor",
    "king",
    "advisor",
    "elephant",
    "horse",
    "rook"
  ];
  for (let c = 0; c < COLS; c++) {
    board[row][c] = { side, type: lineup[c] };
  }
}

function createInitialBoard() {
  const board = createEmptyBoard();
  placeBackRank(board, 0, "black");
  placeBackRank(board, 9, "red");
  board[2][1] = { side: "black", type: "cannon" };
  board[2][7] = { side: "black", type: "cannon" };
  board[7][1] = { side: "red", type: "cannon" };
  board[7][7] = { side: "red", type: "cannon" };

  for (const c of [0, 2, 4, 6, 8]) {
    board[3][c] = { side: "black", type: "pawn" };
    board[6][c] = { side: "red", type: "pawn" };
  }
  return board;
}

function createInitialState() {
  return {
    board: createInitialBoard(),
    turn: "red",
    gameOver: false,
    status: "新对局开始，红方先行"
  };
}

function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);
  const room = {
    id: roomId,
    state: createInitialState(),
    players: {
      red: null,
      black: null
    },
    spectators: new Set(),
    members: new Set()
  };
  rooms.set(roomId, room);
  return room;
}

function assignRole(room, socketId, nickname) {
  if (!room.players.red) {
    room.players.red = { id: socketId, nickname };
    return "red";
  }
  if (!room.players.black) {
    room.players.black = { id: socketId, nickname };
    return "black";
  }
  room.spectators.add(socketId);
  return "spectator";
}

function serializeRoom(room) {
  return {
    players: {
      red: room.players.red ? room.players.red.nickname : null,
      black: room.players.black ? room.players.black.nickname : null
    },
    spectatorCount: room.spectators.size
  };
}

function sanitizeMove(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!isPoint(raw.from) || !isPoint(raw.to)) return null;
  return {
    from: { r: raw.from.r, c: raw.from.c },
    to: { r: raw.to.r, c: raw.to.c }
  };
}

function sanitizeState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const board = sanitizeBoard(raw.board);
  if (!board) return null;
  const turn = raw.turn === "red" || raw.turn === "black" ? raw.turn : null;
  if (!turn) return null;
  const gameOver = Boolean(raw.gameOver);
  const status = typeof raw.status === "string" ? raw.status.slice(0, 120) : "";
  return { board, turn, gameOver, status };
}

function sanitizeBoard(rawBoard) {
  if (!Array.isArray(rawBoard) || rawBoard.length !== ROWS) return null;
  const next = createEmptyBoard();

  for (let r = 0; r < ROWS; r++) {
    const row = rawBoard[r];
    if (!Array.isArray(row) || row.length !== COLS) return null;
    for (let c = 0; c < COLS; c++) {
      const piece = row[c];
      if (piece == null) {
        next[r][c] = null;
        continue;
      }
      if (
        typeof piece !== "object" ||
        (piece.side !== "red" && piece.side !== "black") ||
        !PIECE_TYPES.has(piece.type)
      ) {
        return null;
      }
      next[r][c] = {
        side: piece.side,
        type: piece.type
      };
    }
  }

  return next;
}

function isPoint(value) {
  return (
    value &&
    Number.isInteger(value.r) &&
    Number.isInteger(value.c) &&
    value.r >= 0 &&
    value.r < ROWS &&
    value.c >= 0 &&
    value.c < COLS
  );
}

function leaveCurrentRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);

  socket.leave(roomId);
  socket.data.roomId = null;
  socket.data.role = null;
  socket.data.nickname = null;

  if (!room) return;

  room.members.delete(socket.id);
  room.spectators.delete(socket.id);

  let playerLeft = false;
  if (room.players.red && room.players.red.id === socket.id) {
    room.players.red = null;
    playerLeft = true;
  }
  if (room.players.black && room.players.black.id === socket.id) {
    room.players.black = null;
    playerLeft = true;
  }

  if (!room.members.size) {
    rooms.delete(roomId);
    return;
  }

  if (playerLeft) {
    room.state = {
      ...room.state,
      gameOver: true,
      status: "有玩家退出，本局已结束"
    };
    io.to(roomId).emit("state-sync", {
      state: room.state,
      lastMove: null,
      by: "system"
    });
  }

  io.to(roomId).emit("room-info", serializeRoom(room));
}
