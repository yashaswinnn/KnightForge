const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Game = require('../models/Game');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'chess_secret_dev';
const TIME_MAP = { bullet: 60, blitz: 300, rapid: 600, classical: 1800 };
const matchmakingQueue = [];
const onlineUsers = new Map();

function markUserOnline(userId) {
  if (!userId) return;
  onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
}

function markUserOffline(userId) {
  if (!userId || !onlineUsers.has(userId)) return;
  const nextCount = onlineUsers.get(userId) - 1;
  if (nextCount <= 0) {
    onlineUsers.delete(userId);
    return;
  }
  onlineUsers.set(userId, nextCount);
}

function isUserOnline(userId) {
  return !!userId && onlineUsers.has(String(userId));
}

function getSocketsByUserId(io, userId) {
  const normalizedId = userId?.toString();
  return Array.from(io.sockets.sockets.values()).filter(
    (socket) => socket.user?._id?.toString() === normalizedId
  );
}

function removeFromMatchmaking(socketId) {
  const index = matchmakingQueue.findIndex((entry) => entry.socketId === socketId);
  if (index >= 0) {
    matchmakingQueue.splice(index, 1);
    return true;
  }
  return false;
}

async function finalizeRatedGame(game, result) {
  if (game.isAiGame || !game.whitePlayerId || !game.blackPlayerId) return null;

  const [white, black] = await Promise.all([
    User.findById(game.whitePlayerId),
    User.findById(game.blackPlayerId),
  ]);

  if (!white || !black) return null;

  let whiteDelta = 0;
  let blackDelta = 0;

  if (result === 'white') {
    whiteDelta = 15;
    blackDelta = -15;
  } else if (result === 'black') {
    whiteDelta = -15;
    blackDelta = 15;
  } else {
    whiteDelta = 3;
    blackDelta = -3;
  }

  const newWhite = Math.max(100, white.rating + whiteDelta);
  const newBlack = Math.max(100, black.rating + blackDelta);

  const wUpdate = { $inc: { gamesPlayed: 1 }, $set: { rating: newWhite } };
  const bUpdate = { $inc: { gamesPlayed: 1 }, $set: { rating: newBlack } };

  if (result === 'white') {
    wUpdate.$inc.gamesWon = 1;
    bUpdate.$inc.gamesLost = 1;
  } else if (result === 'black') {
    wUpdate.$inc.gamesLost = 1;
    bUpdate.$inc.gamesWon = 1;
  } else {
    wUpdate.$inc.gamesDraw = 1;
    bUpdate.$inc.gamesDraw = 1;
  }

  await Promise.all([
    User.findByIdAndUpdate(game.whitePlayerId, wUpdate),
    User.findByIdAndUpdate(game.blackPlayerId, bUpdate),
  ]);

  return {
    white: { playerId: white._id.toString(), delta: whiteDelta, rating: newWhite },
    black: { playerId: black._id.toString(), delta: blackDelta, rating: newBlack },
  };
}

async function tryMatchPlayers(io, timeControl) {
  const candidates = matchmakingQueue.filter((entry) => entry.timeControl === timeControl);
  if (candidates.length < 2) return;

  const [first, second] = candidates;
  removeFromMatchmaking(first.socketId);
  removeFromMatchmaking(second.socketId);

  const baseTime = TIME_MAP[timeControl] || 300;
  const whiteFirst = Math.random() < 0.5;

  const game = await Game.create({
    timeControl,
    status: 'active',
    timeWhite: baseTime,
    timeBlack: baseTime,
    whitePlayerId: whiteFirst ? first.userId : second.userId,
    blackPlayerId: whiteFirst ? second.userId : first.userId,
  });

  const room = `game:${game._id.toString()}`;
  const firstSocket = io.sockets.sockets.get(first.socketId);
  const secondSocket = io.sockets.sockets.get(second.socketId);

  firstSocket?.join(room);
  secondSocket?.join(room);

  firstSocket?.emit('match_found', { gameId: game._id.toString() });
  secondSocket?.emit('match_found', { gameId: game._id.toString() });
}

function initGameSocket(httpServer) {
  const io = new Server(httpServer, {
    path: '/ws/socket.io',
    cors: { origin: true, credentials: true },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        if (user) socket.user = user;
      } catch {}
    }
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.user?._id?.toString();
    markUserOnline(userId);

    socket.on('join_matchmaking', async ({ timeControl }) => {
      try {
        if (!socket.user) {
          socket.emit('matchmaking_error', { message: 'You must be signed in.' });
          return;
        }

        const selectedTimeControl = TIME_MAP[timeControl] ? timeControl : 'blitz';
        removeFromMatchmaking(socket.id);

        matchmakingQueue.push({
          socketId: socket.id,
          userId,
          timeControl: selectedTimeControl,
        });

        socket.emit('matchmaking_joined', { timeControl: selectedTimeControl });
        await tryMatchPlayers(io, selectedTimeControl);
      } catch (err) {
        console.error('join_matchmaking error:', err);
        socket.emit('matchmaking_error', { message: 'Could not join matchmaking.' });
      }
    });

    socket.on('leave_matchmaking', () => {
      if (removeFromMatchmaking(socket.id)) {
        socket.emit('matchmaking_left');
      }
    });

    socket.on('join_game', async ({ gameId }) => {
      try {
        const game = await Game.findById(gameId);
        if (!game) return;

        const room = `game:${gameId}`;
        socket.join(room);

        if (socket.user && game.status === 'waiting') {
          const uid = socket.user._id;
          const isWhiteSlotFree = !game.whitePlayerId;
          const isBlackSlotFree = !game.blackPlayerId;
          const alreadyIn =
            game.whitePlayerId?.toString() === uid.toString() ||
            game.blackPlayerId?.toString() === uid.toString();

          if (!alreadyIn && (isWhiteSlotFree || isBlackSlotFree)) {
            if (isWhiteSlotFree) game.whitePlayerId = uid;
            else game.blackPlayerId = uid;

            if (game.whitePlayerId && game.blackPlayerId) {
              game.status = 'active';
            }
            await game.save();
            io.to(room).emit('opponent_joined', { gameId });
          }
        }

        const bothPlayersJoined = !!(game.whitePlayerId && game.blackPlayerId);
        if (bothPlayersJoined) {
          io.to(room).emit('opponent_joined', { gameId });
        }
      } catch (err) {
        console.error('join_game error:', err);
      }
    });

    socket.on('make_move', async ({ gameId, move, fen, pgn }) => {
      try {
        const game = await Game.findById(gameId);
        if (!game || game.status !== 'active') return;

        game.fen = fen;
        game.pgn = pgn || game.pgn;
        game.moveCount = (game.moveCount || 0) + 1;
        await game.save();

        socket.to(`game:${gameId}`).emit('game_update', { fen, move, pgn, moveCount: game.moveCount });
      } catch (err) {
        console.error('make_move error:', err);
      }
    });

    socket.on('game_over', async ({ gameId, result, reason, fen, pgn }) => {
      try {
        const game = await Game.findById(gameId);
        if (!game || game.status === 'completed') return;

        game.status = 'completed';
        game.result = result;
        game.termination = reason;
        if (fen) game.fen = fen;
        if (pgn) game.pgn = pgn;
        await game.save();

        const ratingChanges = await finalizeRatedGame(game, result);
        io.to(`game:${gameId}`).emit('game_over', { result, reason, ratingChanges });
      } catch (err) {
        console.error('game_over error:', err);
      }
    });

    socket.on('resign', async ({ gameId }) => {
      try {
        const game = await Game.findById(gameId);
        if (!game || game.status === 'completed') return;
        const uid = socket.user?._id?.toString();
        const result = game.whitePlayerId?.toString() === uid ? 'black' : 'white';
        game.status = 'completed';
        game.result = result;
        game.termination = 'resignation';
        await game.save();
        const ratingChanges = await finalizeRatedGame(game, result);
        io.to(`game:${gameId}`).emit('game_over', { result, reason: 'resignation', ratingChanges });
      } catch (err) {
        console.error('resign error:', err);
      }
    });

    socket.on('offer_draw', ({ gameId }) => {
      const username = socket.user?.username || 'Opponent';
      socket.to(`game:${gameId}`).emit('draw_offered', { username });
    });

    socket.on('accept_draw', async ({ gameId }) => {
      try {
        const game = await Game.findById(gameId);
        if (!game) return;
        game.status = 'completed';
        game.result = 'draw';
        game.termination = 'agreement';
        await game.save();
        const ratingChanges = await finalizeRatedGame(game, 'draw');
        io.to(`game:${gameId}`).emit('game_over', { result: 'draw', reason: 'agreement', ratingChanges });
      } catch (err) {
        console.error('accept_draw error:', err);
      }
    });

    socket.on('request_rematch', async ({ gameId }) => {
      try {
        if (!socket.user) return;
        const game = await Game.findById(gameId);
        if (!game || !game.whitePlayerId || !game.blackPlayerId) return;

        const requesterId = socket.user._id.toString();
        const opponentId = game.whitePlayerId.toString() === requesterId
          ? game.blackPlayerId.toString()
          : game.whitePlayerId.toString();

        const opponentSockets = getSocketsByUserId(io, opponentId);
        if (!opponentSockets.length) return;

        opponentSockets.forEach((opponentSocket) => {
          opponentSocket.emit('rematch_requested', {
            username: socket.user.username || 'Opponent',
            gameId,
          });
        });
      } catch (err) {
        console.error('request_rematch error:', err);
      }
    });

    socket.on('respond_rematch', async ({ gameId, accepted }) => {
      try {
        if (!socket.user) return;
        const game = await Game.findById(gameId);
        if (!game || !game.whitePlayerId || !game.blackPlayerId) return;

        const responderId = socket.user._id.toString();
        const requesterId = game.whitePlayerId.toString() === responderId
          ? game.blackPlayerId.toString()
          : game.whitePlayerId.toString();

        const requesterSockets = getSocketsByUserId(io, requesterId);
        const opponentSockets = getSocketsByUserId(io, responderId);

        if (!accepted) {
          requesterSockets.forEach((requesterSocket) => {
            requesterSocket.emit('rematch_declined', {
              username: socket.user.username || 'Opponent',
            });
          });
          return;
        }

        const baseTime = TIME_MAP[game.timeControl] || 300;
        const newGame = await Game.create({
          timeControl: game.timeControl,
          status: 'active',
          timeWhite: baseTime,
          timeBlack: baseTime,
          whitePlayerId: game.whitePlayerId,
          blackPlayerId: game.blackPlayerId,
        });

        const allSockets = [...requesterSockets, ...opponentSockets];
        const uniqueSockets = Array.from(new Set(allSockets));
        const room = `game:${newGame._id.toString()}`;
        uniqueSockets.forEach((s) => s.join(room));
        uniqueSockets.forEach((s) => s.emit('rematch_started', { newGameId: newGame._id.toString() }));
      } catch (err) {
        console.error('respond_rematch error:', err);
      }
    });

    socket.on('abandon_game', async ({ gameId }) => {
      try {
        const game = await Game.findById(gameId);
        if (!game || game.status === 'completed') return;

        const isStartingPosition =
          game.fen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const noMovesPlayed = !game.moveCount && isStartingPosition;
        const bothJoined = !!(game.whitePlayerId && game.blackPlayerId);

        if (!bothJoined || !noMovesPlayed) return;

        game.status = 'completed';
        game.result = 'black';
        game.termination = 'abandoned';
        await game.save();
        const ratingChanges = await finalizeRatedGame(game, 'black');

        io.to(`game:${gameId}`).emit('game_over', { result: 'black', reason: 'abandoned', ratingChanges });
      } catch (err) {
        console.error('abandon_game error:', err);
      }
    });

    socket.on('chat_message', ({ gameId, message }) => {
      if (!message?.trim()) return;
      const username = socket.user?.username || 'Anonymous';
      io.to(`game:${gameId}`).emit('chat_message', {
        username,
        message: message.trim(),
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnecting', () => {
      removeFromMatchmaking(socket.id);
      socket.rooms.forEach((room) => {
        if (room.startsWith('game:')) {
          socket.to(room).emit('opponent_disconnected', { userId });
        }
      });
    });

    socket.on('disconnect', () => {
      markUserOffline(userId);
    });
  });

  return io;
}

module.exports = { initGameSocket, isUserOnline };
