const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const { authMiddleware, optionalAuth } = require('../middlewares/auth');

const router = express.Router();

const TIME_MAP = { bullet: 60, blitz: 300, rapid: 600, classical: 1800 };

function formatGame(game, whiteUser, blackUser) {
  const obj = game.toObject ? game.toObject() : game;
  obj.id = obj._id.toString();
  if (obj.whitePlayerId) obj.whitePlayerId = obj.whitePlayerId.toString();
  if (obj.blackPlayerId) obj.blackPlayerId = obj.blackPlayerId.toString();
  if (whiteUser) {
    obj.whitePlayer = { id: whiteUser._id.toString(), username: whiteUser.username, rating: whiteUser.rating, avatar: whiteUser.avatar || null };
  }
  if (blackUser) {
    obj.blackPlayer = { id: blackUser._id.toString(), username: blackUser.username, rating: blackUser.rating, avatar: blackUser.avatar || null };
  }
  return obj;
}

router.get('/active', async (req, res) => {
  try {
    const { timeControl } = req.query;
    const query = { status: 'waiting', isAiGame: false };
    if (timeControl) query.timeControl = timeControl;
    const games = await Game.find(query).sort({ createdAt: -1 }).limit(20);
    const result = await Promise.all(games.map(async (g) => {
      const [white, black] = await Promise.all([
        g.whitePlayerId ? User.findById(g.whitePlayerId) : null,
        g.blackPlayerId ? User.findById(g.blackPlayerId) : null,
      ]);
      return formatGame(g, white, black);
    }));
    res.json({ games: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const games = await Game.find({ status: 'completed', isAiGame: false }).sort({ updatedAt: -1 }).limit(parseInt(limit));
    const result = await Promise.all(games.map(async (g) => {
      const [white, black] = await Promise.all([
        g.whitePlayerId ? User.findById(g.whitePlayerId) : null,
        g.blackPlayerId ? User.findById(g.blackPlayerId) : null,
      ]);
      return formatGame(g, white, black);
    }));
    res.json({ games: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { timeControl = 'blitz', isAiGame = false, color = 'random', aiDifficulty = null } = req.body;
    const baseTime = TIME_MAP[timeControl] || 300;

    if (!isAiGame) {
      const existingOwnWaitingGame = await Game.findOne({
        status: 'waiting',
        isAiGame: false,
        timeControl,
        $or: [{ whitePlayerId: req.user._id }, { blackPlayerId: req.user._id }],
      }).sort({ createdAt: -1 });

      if (existingOwnWaitingGame) {
        const [white, black] = await Promise.all([
          existingOwnWaitingGame.whitePlayerId ? User.findById(existingOwnWaitingGame.whitePlayerId) : null,
          existingOwnWaitingGame.blackPlayerId ? User.findById(existingOwnWaitingGame.blackPlayerId) : null,
        ]);
        return res.json(formatGame(existingOwnWaitingGame, white, black));
      }

      const waitingGames = await Game.find({
        status: 'waiting',
        isAiGame: false,
        timeControl,
        _id: { $ne: existingOwnWaitingGame?._id },
        $or: [
          { whitePlayerId: null, blackPlayerId: { $ne: req.user._id } },
          { blackPlayerId: null, whitePlayerId: { $ne: req.user._id } },
        ],
      }).sort({ createdAt: 1 });

      for (const waitingGame of waitingGames) {
        const joinAsWhite = !waitingGame.whitePlayerId;
        const updatedGame = await Game.findOneAndUpdate(
          {
            _id: waitingGame._id,
            status: 'waiting',
            ...(joinAsWhite ? { whitePlayerId: null } : { blackPlayerId: null }),
          },
          {
            $set: {
              status: 'active',
              ...(joinAsWhite
                ? { whitePlayerId: req.user._id }
                : { blackPlayerId: req.user._id }),
            },
          },
          { new: true }
        );

        if (updatedGame) {
          const [white, black] = await Promise.all([
            updatedGame.whitePlayerId ? User.findById(updatedGame.whitePlayerId) : null,
            updatedGame.blackPlayerId ? User.findById(updatedGame.blackPlayerId) : null,
          ]);
          return res.json(formatGame(updatedGame, white, black));
        }
      }
    }

    const isWhite = color === 'white' || (color === 'random' && Math.random() < 0.5);
    const gameData = {
      timeControl, isAiGame, aiDifficulty,
      status: isAiGame ? 'active' : 'waiting',
      timeWhite: baseTime, timeBlack: baseTime,
    };
    if (isWhite) gameData.whitePlayerId = req.user._id;
    else gameData.blackPlayerId = req.user._id;
    const game = await Game.create(gameData);
    const [white, black] = await Promise.all([
      game.whitePlayerId ? User.findById(game.whitePlayerId) : null,
      game.blackPlayerId ? User.findById(game.blackPlayerId) : null,
    ]);
    res.status(201).json(formatGame(game, white, black));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    const [white, black] = await Promise.all([
      game.whitePlayerId ? User.findById(game.whitePlayerId) : null,
      game.blackPlayerId ? User.findById(game.blackPlayerId) : null,
    ]);
    res.json(formatGame(game, white, black));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
