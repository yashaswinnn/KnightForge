const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const { isUserOnline } = require('../sockets/gameSocket');

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

router.get('/', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const users = await User.find({ gamesPlayed: { $gte: 0 } })
      .sort({ rating: -1 })
      .limit(parseInt(limit))
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
    res.json({ entries });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
