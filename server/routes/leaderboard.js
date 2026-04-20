const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const { isUserOnline } = require('../sockets/gameSocket');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalGames, activeGamesNow, topUser] = await Promise.all([
      User.countDocuments(),
      Game.countDocuments({ status: 'completed' }),
      Game.countDocuments({ status: 'active' }),
      User.findOne().sort({ rating: -1 }).select('username rating'),
    ]);
    res.json({
      totalUsers,
      totalGames,
      activeGamesNow,
      topRating: topUser?.rating || 0,
      topPlayer: topUser?.username || null,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, scope = 'global' } = req.query;
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);

    if (scope === 'friends') {
      const me = await User.findById(req.user._id).select('friends');
      const friendIds = [...new Set([req.user._id.toString(), ...(me?.friends || []).map((id) => id.toString())])];

      const users = await User.find({ _id: { $in: friendIds } })
        .sort({ rating: -1 })
        .limit(parsedLimit)
        .select('-password');

      const entries = users.map((user, idx) => ({
        rank: idx + 1,
        rating: user.rating,
        gamesPlayed: user.gamesPlayed,
        winRate: user.gamesPlayed > 0 ? user.gamesWon / user.gamesPlayed : 0,
        user: {
          id: user._id.toString(),
          username: user.username,
          rating: user.rating,
          avatar: user.avatar || null,
          online: isUserOnline(user._id),
        },
      }));

      return res.json({ entries, scope: 'friends', metric: 'rating' });
    }

    if (scope === 'weekly') {
      const since = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
      const games = await Game.find({
        status: 'completed',
        isAiGame: false,
        updatedAt: { $gte: since },
        whitePlayerId: { $ne: null },
        blackPlayerId: { $ne: null },
      }).select('whitePlayerId blackPlayerId result');

      const weeklyMap = new Map();
      const ensureEntry = (userId) => {
        const id = userId.toString();
        if (!weeklyMap.has(id)) {
          weeklyMap.set(id, { userId: id, weeklyScore: 0, gamesPlayed: 0, wins: 0 });
        }
        return weeklyMap.get(id);
      };

      games.forEach((game) => {
        const white = ensureEntry(game.whitePlayerId);
        const black = ensureEntry(game.blackPlayerId);

        white.gamesPlayed += 1;
        black.gamesPlayed += 1;

        if (game.result === 'white') {
          white.wins += 1;
          white.weeklyScore += 3;
        } else if (game.result === 'black') {
          black.wins += 1;
          black.weeklyScore += 3;
        } else if (game.result === 'draw') {
          white.weeklyScore += 1;
          black.weeklyScore += 1;
        }
      });

      const userIds = Array.from(weeklyMap.keys()).slice(0, parsedLimit * 3);
      const users = await User.find({ _id: { $in: userIds } }).select('-password');
      const userMap = new Map(users.map((user) => [user._id.toString(), user]));

      const entries = Array.from(weeklyMap.values())
        .map((entry) => {
          const user = userMap.get(entry.userId);
          if (!user) return null;
          return {
            rating: entry.weeklyScore,
            gamesPlayed: entry.gamesPlayed,
            winRate: entry.gamesPlayed > 0 ? entry.wins / entry.gamesPlayed : 0,
            user: {
              id: user._id.toString(),
              username: user.username,
              rating: user.rating,
              avatar: user.avatar || null,
              online: isUserOnline(user._id),
            },
          };
        })
        .filter(Boolean)
        .sort((a, b) => (
          b.rating - a.rating ||
          b.winRate - a.winRate ||
          b.gamesPlayed - a.gamesPlayed ||
          b.user.rating - a.user.rating
        ))
        .slice(0, parsedLimit)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

      return res.json({ entries, scope: 'weekly', metric: 'weeklyScore' });
    }

    const users = await User.find({ gamesPlayed: { $gte: 0 } })
      .sort({ rating: -1 })
      .limit(parsedLimit)
      .select('-password');

    const entries = users.map((user, idx) => ({
      rank: idx + 1,
      rating: user.rating,
      gamesPlayed: user.gamesPlayed,
      winRate: user.gamesPlayed > 0 ? user.gamesWon / user.gamesPlayed : 0,
      user: {
        id: user._id.toString(),
        username: user.username,
        rating: user.rating,
        avatar: user.avatar || null,
        online: isUserOnline(user._id),
      },
    }));

    res.json({ entries, scope: 'global', metric: 'rating' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
