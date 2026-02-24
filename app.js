const L = {
  docTitle: "\u4e2d\u56fd\u8c61\u68cb\uff08\u8054\u673a\u5bf9\u6218\uff09",
  heading: "\u4e2d\u56fd\u8c61\u68cb\u8054\u673a",
  undo: "\u6094\u68cb\uff08\u672a\u5f00\u542f\uff09",
  restart: "\u91cd\u5f00\uff08\u672a\u5f00\u542f\uff09",
  tips:
    "\u8f93\u5165\u6635\u79f0\u548c\u623f\u95f4\u53f7\u5373\u53ef\u8fdb\u623f\u3002\u524d\u4e24\u4eba\u4e3a\u7ea2/\u9ed1\u5bf9\u5f08\uff0c\u5176\u4f59\u7528\u6237\u81ea\u52a8\u65c1\u89c2\u3002",
  turnRed: "\u7ea2\u65b9",
  turnBlack: "\u9ed1\u65b9",
  turnSuffix: "\u56de\u5408",
  gameOverTag: "\u5bf9\u5c40\u7ed3\u675f",
  startHint: "\u8bf7\u8f93\u5165\u6635\u79f0\u548c\u623f\u95f4\u53f7\u540e\u5f00\u59cb",
  gameNew: "\u65b0\u5bf9\u5c40\u5f00\u59cb\uff0c\u7ea2\u65b9\u5148\u884c",
  invalidMove: "\u8be5\u8d70\u6cd5\u4e0d\u5408\u6cd5\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9",
  inCheckPrefix: "\u5c06\u519b\uff01\u8f6e\u5230",
  turnPrefix: "\u8f6e\u5230",
  selectedPrefix: "\u5df2\u9009\u4e2d ",
  capturedKingWin: "\u80dc\u5229\uff08\u5c06\u5e05\u88ab\u5403\uff09",
  checkmate: "\u5c06\u6b7b\uff01",
  stalemate: "\u56f0\u6bd9\uff01",
  winSuffix: "\u80dc\u5229",
  waitForTurn: "\u8fd8\u672a\u8f6e\u5230\u4f60\u8d70\u5b50",
  spectatorOnly: "\u4f60\u662f\u65c1\u89c2\u8005\uff0c\u4ec5\u53ef\u89c2\u6218",
  joinFailed: "\u8fdb\u623f\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
  syncFailed: "\u8d70\u5b50\u540c\u6b65\u5931\u8d25\uff0c\u8bf7\u7b49\u5f85\u670d\u52a1\u5668\u72b6\u6001",
  modeRed: "\u626e\u6f14\uff1a\u7ea2\u65b9",
  modeBlack: "\u626e\u6f14\uff1a\u9ed1\u65b9",
  modeSpectator: "\u8eab\u4efd\uff1a\u65c1\u89c2",
  notConnected: "\u672a\u8fde\u63a5\u670d\u52a1\u5668\uff0c\u8bf7\u91cd\u65b0\u8fdb\u623f",
  piece: {
    red: {
      rook: "\u8eca",
      horse: "\u99ac",
      elephant: "\u76f8",
      advisor: "\u4ed5",
      king: "\u5e25",
      cannon: "\u70ae",
      pawn: "\u5175"
    },
    black: {
      rook: "\u8eca",
      horse: "\u99ac",
      elephant: "\u8c61",
      advisor: "\u58eb",
      king: "\u5c07",
      cannon: "\u70ae",
      pawn: "\u5352"
    }
  },
  riverLeft: "\u695a \u6cb3",
  riverRight: "\u6c49 \u754c"
};

const ROWS = 10;
const COLS = 9;
const CELL = 60;
const MARGIN = 40;
const PIECE_RADIUS = 23;
const BOARD_WIDTH = MARGIN * 2 + CELL * (COLS - 1);
const BOARD_HEIGHT = MARGIN * 2 + CELL * (ROWS - 1);

const titleText = document.getElementById("titleText");
const sessionText = document.getElementById("sessionText");
const undoBtn = document.getElementById("undoBtn");
const restartBtn = document.getElementById("restartBtn");
const turnTag = document.getElementById("turnTag");
const statusText = document.getElementById("statusText");
const tipsText = document.getElementById("tipsText");
const lobbyOverlay = document.getElementById("lobbyOverlay");
const joinForm = document.getElementById("joinForm");
const nicknameInput = document.getElementById("nicknameInput");
const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const joinError = document.getElementById("joinError");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let board = createInitialBoard();
let turn = "red";
let selected = null;
let legalMoves = [];
let gameOver = false;
let role = null;
let nickname = "";
let joinedRoomId = "";
let roomSnapshot = {
  players: { red: null, black: null },
  spectatorCount: 0
};
let waitingSyncAck = false;

let boardGrainPattern = null;
let boardSpeckPattern = null;
let activeAnimation = null;
let renderLoopId = 0;
const socket = io();

applyStaticText();
setupCanvas();
updateStatus(L.startHint);
requestDraw();
syncButtons();
bindSocketEvents();
renderSession();
setLobbyVisible(true);

canvas.addEventListener("click", onBoardClick);
undoBtn.addEventListener("click", onUndo);
restartBtn.addEventListener("click", onRestart);
joinForm.addEventListener("submit", onJoinSubmit);
window.addEventListener("resize", () => {
  setupCanvas();
  requestDraw();
});

function applyStaticText() {
  document.title = L.docTitle;
  titleText.textContent = L.heading;
  undoBtn.textContent = L.undo;
  restartBtn.textContent = L.restart;
  tipsText.textContent = L.tips;
}

function sideName(side) {
  return side === "red" ? L.turnRed : L.turnBlack;
}

function roleLabel(currentRole) {
  if (currentRole === "red") return L.modeRed;
  if (currentRole === "black") return L.modeBlack;
  return L.modeSpectator;
}

function renderSession() {
  const red = roomSnapshot.players.red || "\u5f85\u52a0\u5165";
  const black = roomSnapshot.players.black || "\u5f85\u52a0\u5165";
  const room = joinedRoomId || "-";
  const name = nickname || "-";
  sessionText.textContent =
    `\u623f\u95f4\uff1a${room} | \u6635\u79f0\uff1a${name} | ${roleLabel(role)} | ` +
    `\u7ea2\uff1a${red} \u9ed1\uff1a${black} \u65c1\u89c2\uff1a${roomSnapshot.spectatorCount}`;
}

function setLobbyVisible(visible) {
  lobbyOverlay.classList.toggle("hidden", !visible);
}

function setJoinError(message) {
  joinError.textContent = message || "";
}

function bindSocketEvents() {
  socket.on("connect", () => {
    joinBtn.disabled = false;
    setJoinError("");
  });

  socket.on("connect_error", () => {
    joinBtn.disabled = false;
    setJoinError(L.notConnected);
  });

  socket.on("disconnect", () => {
    joinBtn.disabled = false;
    if (joinedRoomId) {
      role = null;
      joinedRoomId = "";
      roomSnapshot = {
        players: { red: null, black: null },
        spectatorCount: 0
      };
      board = createInitialBoard();
      turn = "red";
      selected = null;
      legalMoves = [];
      gameOver = false;
      renderSession();
      setLobbyVisible(true);
      setJoinError(L.notConnected);
      updateStatus(L.notConnected);
      requestDraw();
    }
  });

  socket.on("joined", onJoinedRoom);
  socket.on("room-info", (roomInfo) => {
    if (!roomInfo) return;
    roomSnapshot = roomInfo;
    renderSession();
  });

  socket.on("state-sync", ({ state }) => {
    waitingSyncAck = false;
    if (!state) return;
    applyRemoteState(state);
  });

  socket.on("room-ending", ({ message }) => {
    if (!message) return;
    updateStatus(message);
  });

  socket.on("room-cleared", ({ message }) => {
    role = null;
    nickname = "";
    joinedRoomId = "";
    roomSnapshot = {
      players: { red: null, black: null },
      spectatorCount: 0
    };
    waitingSyncAck = false;
    board = createInitialBoard();
    turn = "red";
    selected = null;
    legalMoves = [];
    gameOver = false;
    renderSession();
    setLobbyVisible(true);
    setJoinError(message || "");
    updateStatus(message || L.startHint);
    syncButtons();
    requestDraw();
  });
}

function onJoinSubmit(event) {
  event.preventDefault();
  const nextNickname = nicknameInput.value.trim();
  const nextRoomId = roomInput.value.trim();

  if (!nextNickname || !nextRoomId) {
    setJoinError("\u8bf7\u586b\u5199\u6635\u79f0\u4e0e\u623f\u95f4\u53f7");
    return;
  }

  setJoinError("");
  joinBtn.disabled = true;
  socket.emit(
    "join-room",
    {
      nickname: nextNickname,
      roomId: nextRoomId
    },
    (result) => {
      joinBtn.disabled = false;
      if (!result || !result.ok) {
        setJoinError((result && result.message) || L.joinFailed);
      }
    }
  );
}

function onJoinedRoom(payload) {
  role = payload.role || null;
  nickname = payload.nickname || "";
  joinedRoomId = payload.roomId || "";
  waitingSyncAck = false;

  if (payload.room) {
    roomSnapshot = payload.room;
  }

  selected = null;
  legalMoves = [];
  gameOver = false;
  setLobbyVisible(false);
  setJoinError("");
  applyRemoteState(payload.state);
  renderSession();
}

function applyRemoteState(nextState) {
  if (!nextState || !nextState.board) return;
  board = cloneBoard(nextState.board);
  turn = nextState.turn === "black" ? "black" : "red";
  gameOver = Boolean(nextState.gameOver);
  selected = null;
  legalMoves = [];
  waitingSyncAck = false;
  updateStatus(nextState.status || `${L.turnPrefix}${sideName(turn)}`);
  syncButtons();
  requestDraw();
}

function syncStateToServer(lastMove) {
  if (!joinedRoomId || role !== "red" && role !== "black") return;

  waitingSyncAck = true;
  socket.emit(
    "sync-state",
    {
      roomId: joinedRoomId,
      state: {
        board: cloneBoard(board),
        turn,
        gameOver,
        status: statusText.textContent
      },
      lastMove
    },
    (result) => {
      if (!result || !result.ok) {
        waitingSyncAck = false;
        updateStatus((result && result.message) || L.syncFailed);
      }
    }
  );
}

function setupCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(BOARD_WIDTH * ratio);
  canvas.height = Math.round(BOARD_HEIGHT * ratio);
  canvas.style.width = `${BOARD_WIDTH}px`;
  canvas.style.height = `${BOARD_HEIGHT}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  buildBoardTextures();
}

function buildBoardTextures() {
  boardGrainPattern = createWoodGrainPattern();
  boardSpeckPattern = createSpeckPattern();
}

function createWoodGrainPattern() {
  const tile = document.createElement("canvas");
  tile.width = 220;
  tile.height = 220;
  const tctx = tile.getContext("2d");

  const base = tctx.createLinearGradient(0, 0, tile.width, tile.height);
  base.addColorStop(0, "rgb(138 95 56 / 11%)");
  base.addColorStop(0.5, "rgb(206 161 114 / 6%)");
  base.addColorStop(1, "rgb(93 63 36 / 10%)");
  tctx.fillStyle = base;
  tctx.fillRect(0, 0, tile.width, tile.height);

  for (let i = 0; i < 30; i++) {
    const y = 8 + i * 7 + (i % 4);
    const drift = (i % 2 === 0 ? 1 : -1) * (4 + (i % 6));
    tctx.strokeStyle =
      i % 5 === 0 ? "rgb(90 59 34 / 18%)" : "rgb(232 197 149 / 11%)";
    tctx.lineWidth = 0.8 + (i % 3) * 0.15;
    tctx.beginPath();
    tctx.moveTo(-24, y);
    tctx.bezierCurveTo(
      tile.width * 0.24,
      y + drift,
      tile.width * 0.66,
      y - drift,
      tile.width + 24,
      y + drift * 0.45
    );
    tctx.stroke();
  }

  for (let i = 0; i < 14; i++) {
    const cx = 16 + i * 14;
    const cy = 20 + ((i * 37) % 170);
    tctx.strokeStyle = i % 2 === 0 ? "rgb(130 88 51 / 8%)" : "rgb(249 222 182 / 8%)";
    tctx.lineWidth = 0.75;
    tctx.beginPath();
    tctx.ellipse(cx, cy, 10 + (i % 3) * 2, 5 + (i % 2), 0.2, 0, Math.PI * 1.8);
    tctx.stroke();
  }

  return ctx.createPattern(tile, "repeat");
}

function createSpeckPattern() {
  const tile = document.createElement("canvas");
  tile.width = 120;
  tile.height = 120;
  const tctx = tile.getContext("2d");

  for (let i = 0; i < 180; i++) {
    const x = (i * 47) % 120;
    const y = (i * 61 + 13) % 120;
    const r = i % 9 === 0 ? 0.95 : 0.55;
    tctx.fillStyle = i % 2 === 0 ? "rgb(255 236 200 / 8%)" : "rgb(93 63 35 / 7%)";
    tctx.beginPath();
    tctx.arc(x, y, r, 0, Math.PI * 2);
    tctx.fill();
  }

  return ctx.createPattern(tile, "repeat");
}

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function placeBackRank(b, row, side) {
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
    b[row][c] = { side, type: lineup[c] };
  }
}

function createInitialBoard() {
  const b = createEmptyBoard();
  placeBackRank(b, 0, "black");
  placeBackRank(b, 9, "red");

  b[2][1] = { side: "black", type: "cannon" };
  b[2][7] = { side: "black", type: "cannon" };
  b[7][1] = { side: "red", type: "cannon" };
  b[7][7] = { side: "red", type: "cannon" };

  for (const c of [0, 2, 4, 6, 8]) {
    b[3][c] = { side: "black", type: "pawn" };
    b[6][c] = { side: "red", type: "pawn" };
  }

  return b;
}

function cloneBoard(source) {
  return source.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function inPalace(side, r, c) {
  if (c < 3 || c > 5) return false;
  if (side === "red") return r >= 7 && r <= 9;
  return r >= 0 && r <= 2;
}

function countBetween(b, fr, fc, tr, tc) {
  let count = 0;

  if (fr === tr) {
    const step = tc > fc ? 1 : -1;
    for (let c = fc + step; c !== tc; c += step) {
      if (b[fr][c]) count++;
    }
    return count;
  }

  if (fc === tc) {
    const step = tr > fr ? 1 : -1;
    for (let r = fr + step; r !== tr; r += step) {
      if (b[r][fc]) count++;
    }
    return count;
  }

  return -1;
}

function isPseudoLegalMove(b, fr, fc, tr, tc) {
  if (!inBounds(fr, fc) || !inBounds(tr, tc)) return false;
  if (fr === tr && fc === tc) return false;

  const moving = b[fr][fc];
  if (!moving) return false;

  const target = b[tr][tc];
  if (target && target.side === moving.side) return false;

  const dr = tr - fr;
  const dc = tc - fc;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);

  switch (moving.type) {
    case "rook":
      if (fr !== tr && fc !== tc) return false;
      return countBetween(b, fr, fc, tr, tc) === 0;

    case "horse":
      if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return false;
      if (adr === 2) {
        const legR = fr + dr / 2;
        return !b[legR][fc];
      }
      {
        const legC = fc + dc / 2;
        return !b[fr][legC];
      }

    case "elephant":
      if (adr !== 2 || adc !== 2) return false;
      if (moving.side === "red" && tr < 5) return false;
      if (moving.side === "black" && tr > 4) return false;
      return !b[fr + dr / 2][fc + dc / 2];

    case "advisor":
      if (adr !== 1 || adc !== 1) return false;
      return inPalace(moving.side, tr, tc);

    case "king":
      if (adr + adc === 1) return inPalace(moving.side, tr, tc);
      if (fc === tc && target && target.type === "king") {
        return countBetween(b, fr, fc, tr, tc) === 0;
      }
      return false;

    case "cannon":
      if (fr !== tr && fc !== tc) return false;
      {
        const between = countBetween(b, fr, fc, tr, tc);
        if (target) return between === 1;
        return between === 0;
      }

    case "pawn":
      {
        const forward = moving.side === "red" ? -1 : 1;
        if (dr === forward && dc === 0) return true;
        const crossedRiver = moving.side === "red" ? fr <= 4 : fr >= 5;
        if (crossedRiver && dr === 0 && adc === 1) return true;
        return false;
      }

    default:
      return false;
  }
}

function findKing(b, side) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      if (p && p.side === side && p.type === "king") {
        return { r, c };
      }
    }
  }
  return null;
}

function isInCheck(side, b) {
  const king = findKing(b, side);
  if (!king) return true;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      if (!p || p.side === side) continue;
      if (isPseudoLegalMove(b, r, c, king.r, king.c)) return true;
    }
  }

  return false;
}

function applyMoveOnBoard(b, fr, fc, tr, tc) {
  const captured = b[tr][tc];
  b[tr][tc] = b[fr][fc];
  b[fr][fc] = null;
  return captured;
}

function isLegalMoveForSide(b, side, fr, fc, tr, tc) {
  const moving = b[fr][fc];
  if (!moving || moving.side !== side) return false;
  if (!isPseudoLegalMove(b, fr, fc, tr, tc)) return false;

  const next = cloneBoard(b);
  applyMoveOnBoard(next, fr, fc, tr, tc);
  return !isInCheck(side, next);
}

function collectLegalMovesForPiece(b, side, r, c) {
  const p = b[r][c];
  if (!p || p.side !== side) return [];

  const moves = [];
  for (let tr = 0; tr < ROWS; tr++) {
    for (let tc = 0; tc < COLS; tc++) {
      if (isLegalMoveForSide(b, side, r, c, tr, tc)) {
        moves.push({ r: tr, c: tc });
      }
    }
  }
  return moves;
}

function hasAnyLegalMove(side, b) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      if (!p || p.side !== side) continue;

      for (let tr = 0; tr < ROWS; tr++) {
        for (let tc = 0; tc < COLS; tc++) {
          if (isLegalMoveForSide(b, side, r, c, tr, tc)) return true;
        }
      }
    }
  }
  return false;
}

function opposite(side) {
  return side === "red" ? "black" : "red";
}

function onUndo() {
  if (!joinedRoomId) return;
  updateStatus("\u8054\u673a\u6a21\u5f0f\u4e0d\u652f\u6301\u6094\u68cb");
}

function onRestart() {
  if (!joinedRoomId) return;
  updateStatus("\u5bf9\u5c40\u7ed3\u675f\u540e\u623f\u95f4\u4f1a\u81ea\u52a8\u6e05\u7406\uff0c\u8bf7\u91cd\u65b0\u8fdb\u623f");
}

function onBoardClick(event) {
  if (gameOver || activeAnimation || waitingSyncAck) return;
  if (!joinedRoomId) {
    setLobbyVisible(true);
    updateStatus(L.startHint);
    return;
  }
  if (role !== "red" && role !== "black") {
    updateStatus(L.spectatorOnly);
    return;
  }
  if (turn !== role) {
    updateStatus(L.waitForTurn);
    return;
  }

  const pos = locateGridByPointer(event);
  if (!pos) return;

  const r = pos.r;
  const c = pos.c;
  const clicked = board[r][c];

  if (!selected) {
    if (clicked && clicked.side === turn) {
      selected = { r, c };
      legalMoves = collectLegalMovesForPiece(board, turn, r, c);
      updateStatus(`${L.selectedPrefix}${sideName(turn)}${L.piece[turn][clicked.type]}`);
      requestDraw();
    }
    return;
  }

  if (clicked && clicked.side === turn) {
    selected = { r, c };
    legalMoves = collectLegalMovesForPiece(board, turn, r, c);
    updateStatus(`${L.selectedPrefix}${sideName(turn)}${L.piece[turn][clicked.type]}`);
    requestDraw();
    return;
  }

  const canMove = legalMoves.some((m) => m.r === r && m.c === c);
  if (!canMove) {
    updateStatus(L.invalidMove);
    requestDraw();
    return;
  }

  const from = { ...selected };
  const to = { r, c };
  const movingPiece = { ...board[from.r][from.c] };
  selected = null;
  legalMoves = [];
  startMoveAnimation(from, to, movingPiece, () => {
    finalizeMove(from, to, movingPiece);
  });
}

function finalizeMove(from, to, movingPiece) {
  const captured = applyMoveOnBoard(board, from.r, from.c, to.r, to.c);

  if (captured && captured.type === "king") {
    gameOver = true;
    updateStatus(`${sideName(movingPiece.side)}${L.capturedKingWin}`);
    syncStateToServer({ from, to });
    syncButtons();
    requestDraw();
    return;
  }

  turn = opposite(turn);
  const anyMove = hasAnyLegalMove(turn, board);
  if (!anyMove) {
    gameOver = true;
    if (isInCheck(turn, board)) {
      updateStatus(`${L.checkmate}${sideName(opposite(turn))}${L.winSuffix}`);
    } else {
      updateStatus(`${L.stalemate}${sideName(opposite(turn))}${L.winSuffix}`);
    }
    syncStateToServer({ from, to });
    syncButtons();
    requestDraw();
    return;
  }

  if (isInCheck(turn, board)) {
    updateStatus(`${L.inCheckPrefix}${sideName(turn)}`);
  } else {
    updateStatus(`${L.turnPrefix}${sideName(turn)}`);
  }

  syncStateToServer({ from, to });
  syncButtons();
  requestDraw();
}

function startMoveAnimation(from, to, movingPiece, onDone) {
  activeAnimation = {
    from,
    to,
    piece: movingPiece,
    start: performance.now(),
    duration: 210,
    onDone
  };
  syncButtons();
  ensureRenderLoop();
}

function syncButtons() {
  undoBtn.disabled = true;
  restartBtn.disabled = true;
}

function updateStatus(text) {
  statusText.textContent = text;
  refreshTurnTag();
}

function refreshTurnTag() {
  if (gameOver) {
    turnTag.textContent = L.gameOverTag;
  } else {
    turnTag.textContent = `${sideName(turn)}${L.turnSuffix}`;
  }
}

function gridToPixel(r, c) {
  return { x: MARGIN + c * CELL, y: MARGIN + r * CELL };
}

function locateGridByPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (BOARD_WIDTH / rect.width);
  const y = (event.clientY - rect.top) * (BOARD_HEIGHT / rect.height);
  const c = Math.round((x - MARGIN) / CELL);
  const r = Math.round((y - MARGIN) / CELL);

  if (!inBounds(r, c)) return null;
  const p = gridToPixel(r, c);
  const tolerance = CELL * 0.45;
  if (Math.abs(p.x - x) > tolerance || Math.abs(p.y - y) > tolerance) return null;
  return { r, c };
}

function requestDraw() {
  draw(performance.now());
  ensureRenderLoop();
}

function needsAnimatedFrame() {
  return Boolean(activeAnimation || selected);
}

function ensureRenderLoop() {
  if (!renderLoopId && needsAnimatedFrame()) {
    renderLoopId = requestAnimationFrame(renderFrame);
  }
}

function renderFrame(now) {
  renderLoopId = 0;
  draw(now);

  if (activeAnimation && now - activeAnimation.start >= activeAnimation.duration) {
    const done = activeAnimation.onDone;
    activeAnimation = null;
    syncButtons();
    if (typeof done === "function") done();
    draw(now);
  }

  if (needsAnimatedFrame()) {
    renderLoopId = requestAnimationFrame(renderFrame);
  }
}

function draw(now) {
  drawBoard();
  drawHighlights(now);
  drawPieces(now);
}

function strokeEngravedPath(trace, width = 1.1) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.beginPath();
  trace();
  ctx.strokeStyle = "rgb(150 113 76 / 76%)";
  ctx.stroke();

  ctx.translate(0, -0.35);
  ctx.beginPath();
  trace();
  ctx.lineWidth = Math.max(0.55, width * 0.52);
  ctx.strokeStyle = "rgb(255 239 209 / 34%)";
  ctx.stroke();
  ctx.restore();
}

function drawBoard() {
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const gridLeft = MARGIN;
  const gridTop = MARGIN;
  const gridWidth = CELL * (COLS - 1);
  const gridHeight = CELL * (ROWS - 1);
  const framePad = 21;
  const frameX = gridLeft - framePad;
  const frameY = gridTop - framePad;
  const frameW = gridWidth + framePad * 2;
  const frameH = gridHeight + framePad * 2;
  const panelInset = 9;
  const panelX = frameX + panelInset;
  const panelY = frameY + panelInset;
  const panelW = frameW - panelInset * 2;
  const panelH = frameH - panelInset * 2;

  const tableBg = ctx.createLinearGradient(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  tableBg.addColorStop(0, "#6f4527");
  tableBg.addColorStop(0.5, "#5f3b21");
  tableBg.addColorStop(1, "#51311b");
  ctx.fillStyle = tableBg;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.save();
  ctx.shadowColor = "rgb(34 19 8 / 55%)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 9;
  const frameGrad = ctx.createLinearGradient(frameX, frameY, frameX, frameY + frameH);
  frameGrad.addColorStop(0, "#ad794d");
  frameGrad.addColorStop(0.52, "#8e5e39");
  frameGrad.addColorStop(1, "#734829");
  ctx.fillStyle = frameGrad;
  ctx.fillRect(frameX, frameY, frameW, frameH);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(frameX, frameY, frameW, frameH);
  ctx.clip();
  if (boardGrainPattern) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = boardGrainPattern;
    ctx.fillRect(frameX, frameY, frameW, frameH);
  }
  for (let i = 0; i < 10; i++) {
    const y = frameY + 14 + i * 36;
    const drift = (i % 2 === 0 ? 1 : -1) * (4 + (i % 3));
    ctx.beginPath();
    ctx.strokeStyle = i % 3 === 0 ? "rgb(255 217 166 / 10%)" : "rgb(83 53 30 / 15%)";
    ctx.lineWidth = 1;
    ctx.moveTo(frameX - 20, y);
    ctx.bezierCurveTo(
      frameX + frameW * 0.28,
      y + drift,
      frameX + frameW * 0.72,
      y - drift,
      frameX + frameW + 20,
      y + drift * 0.45
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgb(65 40 20 / 86%)";
  ctx.lineWidth = 2.35;
  ctx.strokeRect(frameX + 0.7, frameY + 0.7, frameW - 1.4, frameH - 1.4);
  ctx.strokeStyle = "rgb(248 216 170 / 30%)";
  ctx.lineWidth = 1.1;
  ctx.strokeRect(frameX + 3.6, frameY + 3.6, frameW - 7.2, frameH - 7.2);

  const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  panelGrad.addColorStop(0, "#f2d7aa");
  panelGrad.addColorStop(0.52, "#e9c694");
  panelGrad.addColorStop(1, "#ddad75");
  ctx.fillStyle = panelGrad;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(panelX, panelY, panelW, panelH);
  ctx.clip();
  if (boardGrainPattern) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = boardGrainPattern;
    ctx.fillRect(panelX, panelY, panelW, panelH);
  }
  if (boardSpeckPattern) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = boardSpeckPattern;
    ctx.fillRect(panelX, panelY, panelW, panelH);
  }
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const cx = gridLeft + c * CELL + CELL * 0.5;
      const cy = gridTop + r * CELL + CELL * 0.5;
      ctx.beginPath();
      ctx.strokeStyle = (r + c) % 2 === 0 ? "rgb(118 83 50 / 10%)" : "rgb(255 226 182 / 10%)";
      ctx.lineWidth = 0.42;
      ctx.ellipse(cx, cy, 16, 8, 0.22, 0, Math.PI * 1.9);
      ctx.stroke();
    }
  }
  ctx.restore();

  const innerGlow = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  innerGlow.addColorStop(0, "rgb(255 242 215 / 14%)");
  innerGlow.addColorStop(0.2, "rgb(255 236 206 / 3%)");
  innerGlow.addColorStop(1, "rgb(112 77 47 / 11%)");
  ctx.fillStyle = innerGlow;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.strokeStyle = "rgb(120 86 54 / 58%)";
  ctx.lineWidth = 1.45;
  ctx.strokeRect(gridLeft - 0.5, gridTop - 0.5, gridWidth + 1, gridHeight + 1);
  ctx.strokeStyle = "rgb(250 222 181 / 26%)";
  ctx.lineWidth = 0.75;
  ctx.strokeRect(gridLeft + 0.9, gridTop + 0.9, gridWidth - 1.8, gridHeight - 1.8);

  for (let r = 0; r < ROWS; r++) {
    const y = MARGIN + r * CELL;
    strokeEngravedPath(() => {
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(MARGIN + CELL * (COLS - 1), y);
    }, 1.08);
  }

  for (let c = 0; c < COLS; c++) {
    const x = MARGIN + c * CELL;
    strokeEngravedPath(() => {
      if (c === 0 || c === COLS - 1) {
        ctx.moveTo(x, MARGIN);
        ctx.lineTo(x, MARGIN + CELL * (ROWS - 1));
      } else {
        ctx.moveTo(x, MARGIN);
        ctx.lineTo(x, MARGIN + CELL * 4);
        ctx.moveTo(x, MARGIN + CELL * 5);
        ctx.lineTo(x, MARGIN + CELL * (ROWS - 1));
      }
    }, 1.08);
  }

  drawPalace();
  drawStars();
  drawRiver();
}

function drawPalace() {
  strokeEngravedPath(() => {
    ctx.moveTo(MARGIN + CELL * 3, MARGIN);
    ctx.lineTo(MARGIN + CELL * 5, MARGIN + CELL * 2);
    ctx.moveTo(MARGIN + CELL * 5, MARGIN);
    ctx.lineTo(MARGIN + CELL * 3, MARGIN + CELL * 2);
    ctx.moveTo(MARGIN + CELL * 3, MARGIN + CELL * 7);
    ctx.lineTo(MARGIN + CELL * 5, MARGIN + CELL * 9);
    ctx.moveTo(MARGIN + CELL * 5, MARGIN + CELL * 7);
    ctx.lineTo(MARGIN + CELL * 3, MARGIN + CELL * 9);
  }, 1.08);
}

function drawStars() {
  const marks = [
    [2, 1], [2, 7], [7, 1], [7, 7],
    [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
    [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]
  ];

  for (const mark of marks) {
    drawStarAt(mark[0], mark[1]);
  }
}

function drawStarAt(r, c) {
  const p = gridToPixel(r, c);
  const x = p.x;
  const y = p.y;
  const gap = 2.7;
  const arm = 8.8;
  const rise = 6.8;
  const left = c > 0;
  const right = c < COLS - 1;

  const traceCorner = (dirX, dirY) => {
    const nearX = x + dirX * gap;
    const nearY = y + dirY * gap;
    const farX = x + dirX * arm;
    const farY = y + dirY * rise;

    // Reverse corner orientation so the elbow sits near the intersection.
    ctx.moveTo(farX, nearY);
    ctx.lineTo(nearX, nearY);
    ctx.lineTo(nearX, farY);
  };

  if (left) {
    strokeEngravedPath(() => {
      traceCorner(-1, -1);
      traceCorner(-1, 1);
    }, 1.04);
  }

  if (right) {
    strokeEngravedPath(() => {
      traceCorner(1, -1);
      traceCorner(1, 1);
    }, 1.04);
  }
}

function drawRiver() {
  ctx.save();
  const riverX = MARGIN + 2.5;
  const riverY = MARGIN + CELL * 4 + 2.5;
  const riverW = CELL * 8 - 5;
  const riverH = CELL - 5;

  const riverTint = ctx.createLinearGradient(riverX, riverY, riverX, riverY + riverH);
  riverTint.addColorStop(0, "rgb(160 112 67 / 7%)");
  riverTint.addColorStop(0.5, "rgb(255 231 194 / 3%)");
  riverTint.addColorStop(1, "rgb(101 71 42 / 7%)");
  ctx.fillStyle = riverTint;
  ctx.fillRect(riverX, riverY, riverW, riverH);

  ctx.fillStyle = "rgb(126 108 86 / 76%)";
  ctx.font = "700 50px 'STKaiti', 'KaiTi', 'Noto Serif SC', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const y = MARGIN + CELL * 4.5 + 1;
  ctx.strokeStyle = "rgb(255 243 219 / 30%)";
  ctx.lineWidth = 0.8;
  ctx.strokeText(L.riverLeft, MARGIN + CELL * 2, y);
  ctx.strokeText(L.riverRight, MARGIN + CELL * 6, y);
  ctx.fillText(L.riverLeft, MARGIN + CELL * 2, y);
  ctx.fillText(L.riverRight, MARGIN + CELL * 6, y);
  ctx.restore();
}

function drawHighlights(now) {
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);

  if (selected) {
    const p = gridToPixel(selected.r, selected.c);
    ctx.beginPath();
    ctx.strokeStyle = `rgb(255 255 255 / ${0.74 + pulse * 0.14})`;
    ctx.lineWidth = 2.25;
    ctx.arc(p.x, p.y, PIECE_RADIUS + 5.9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = `rgb(255 255 255 / ${0.3 + pulse * 0.16})`;
    ctx.lineWidth = 1.1;
    ctx.arc(p.x, p.y, PIECE_RADIUS + 8.4 + pulse * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const move of legalMoves) {
    const p = gridToPixel(move.r, move.c);
    const target = board[move.r][move.c];
    if (target) {
      ctx.beginPath();
      ctx.strokeStyle = `rgb(255 255 255 / ${0.45 + pulse * 0.22})`;
      ctx.lineWidth = 1.9;
      ctx.arc(p.x, p.y, PIECE_RADIUS + 4.5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.fillStyle = `rgb(255 255 255 / ${0.58 + pulse * 0.18})`;
      ctx.arc(p.x, p.y, 3.6 + pulse * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = "rgb(110 77 47 / 52%)";
      ctx.lineWidth = 0.8;
      ctx.arc(p.x, p.y, 4.8 + pulse * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawPieces(now) {
  const anim = activeAnimation;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (anim && r === anim.from.r && c === anim.from.c) continue;
      drawPiece(r, c, p, false);
    }
  }

  if (anim) {
    const fromPixel = gridToPixel(anim.from.r, anim.from.c);
    const toPixel = gridToPixel(anim.to.r, anim.to.c);
    const raw = Math.max(0, Math.min(1, (now - anim.start) / anim.duration));
    const t = easeInOutCubic(raw);
    const x = fromPixel.x + (toPixel.x - fromPixel.x) * t;
    const y = fromPixel.y + (toPixel.y - fromPixel.y) * t;
    drawPieceAt(x, y, anim.piece, true);
  }
}

function drawPiece(r, c, piece, isMoving) {
  const p = gridToPixel(r, c);
  drawPieceAt(p.x, p.y, piece, isMoving);
}

function drawPieceAt(x, y, piece, isMoving) {
  const outer = PIECE_RADIUS - 1.1 + (isMoving ? 0.1 : 0);
  const sideInk = piece.side === "red" ? "#8b352b" : "#2d2d2b";
  const textColor = piece.side === "red" ? "#9b3a30" : "#2e2e2d";

  // Very shallow base lip to imply thickness, not spherical volume.
  ctx.beginPath();
  ctx.fillStyle = "rgb(170 113 66 / 42%)";
  ctx.arc(x, y + 0.72, outer - 0.1, 0, Math.PI * 2);
  ctx.fill();

  const face = ctx.createLinearGradient(x, y - outer, x, y + outer);
  face.addColorStop(0, "#f0cd98");
  face.addColorStop(0.5, "#efca94");
  face.addColorStop(1, "#ebc388");
  ctx.beginPath();
  ctx.fillStyle = face;
  ctx.arc(x, y, outer - 0.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "rgb(118 77 45 / 82%)";
  ctx.lineWidth = 1.25;
  ctx.arc(x, y, outer - 0.65, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgb(248 222 184 / 35%)";
  ctx.lineWidth = 0.58;
  ctx.arc(x, y, outer - 2.35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgb(112 72 43 / 52%)";
  ctx.lineWidth = 0.94;
  ctx.arc(x, y, outer - 4.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgb(255 240 212 / 22%)";
  ctx.lineWidth = 0.48;
  ctx.arc(x, y, outer - 3.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "600 28px 'STKaiti', 'KaiTi', 'Noto Serif SC', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const glyph = L.piece[piece.side][piece.type];

  ctx.save();
  ctx.fillStyle = piece.side === "red" ? "rgb(255 236 220 / 24%)" : "rgb(255 249 236 / 18%)";
  ctx.fillText(glyph, x, y - 0.28);
  ctx.strokeStyle = sideInk;
  ctx.lineWidth = 0.42;
  ctx.strokeText(glyph, x, y + 0.48);
  ctx.fillStyle = textColor;
  ctx.fillText(glyph, x, y + 0.34);
  ctx.restore();
}

function easeInOutCubic(t) {
  if (t < 0.5) return 4 * t * t * t;
  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}
