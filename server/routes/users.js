const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const { authMiddleware } = require('../middlewares/auth');
const { isUserOnline } = require('../sockets/gameSocket');

const router = express.Router();

router.get('/me/stats', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      gamesLost: user.gamesLost,
      gamesDraw: user.gamesDraw,
      puzzlesSolved: user.puzzlesSolved,
      rating: user.rating,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  try {
    const username = req.body.username?.trim();

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ message: 'Username must be between 3 and 30 characters' });
    }

    const existingUser = await User.findOne({
      username,
      _id: { $ne: req.user._id },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { username },
      { new: true, runValidators: true }
    );

    res.json(updatedUser.toPublic());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/avatar', authMiddleware, async (req, res) => {
  try {
    const avatar = req.body.avatar;

    if (!avatar || typeof avatar !== 'string') {
      return res.status(400).json({ message: 'Avatar image is required' });
    }

    if (!avatar.startsWith('data:image/')) {
      return res.status(400).json({ message: 'Avatar must be a valid base64 image' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { avatar },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser.toPublic());
  } catch (err) {
    console.error('avatar upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/me/friends', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'username rating avatar')
      .populate('friendRequestsReceived', 'username rating avatar')
      .populate('friendRequestsSent', 'username rating avatar');

    const addPresence = (people = []) =>
      people.map((person) => ({
        ...person.toObject(),
        online: isUserOnline(person._id),
      }));

    res.json({
      friends: addPresence(user.friends || []),
      received: addPresence(user.friendRequestsReceived || []),
      sent: addPresence(user.friendRequestsSent || []),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (q.length < 2) return res.json({ users: [] });
    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      _id: { $ne: req.user._id },
    }).select('username rating avatar').limit(10);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const obj = user.toObject();
    obj.id = obj._id.toString();
    res.json(obj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/games', async (req, res) => {
  try {
    const userId = req.params.id;
    const limitValue = Number.parseInt(req.query.limit, 10);
    let gamesQuery = Game.find({
      $or: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      status: 'completed',
    }).sort({ updatedAt: -1 });

    if (Number.isFinite(limitValue) && limitValue > 0) {
      gamesQuery = gamesQuery.limit(limitValue);
    }

    const games = await gamesQuery;

    const result = await Promise.all(games.map(async (g) => {
      const [white, black] = await Promise.all([
        g.whitePlayerId ? User.findById(g.whitePlayerId).select('username rating avatar') : null,
        g.blackPlayerId ? User.findById(g.blackPlayerId).select('username rating avatar') : null,
      ]);
      const obj = g.toObject();
      obj.id = obj._id.toString();
      if (obj.whitePlayerId) obj.whitePlayerId = obj.whitePlayerId.toString();
      if (obj.blackPlayerId) obj.blackPlayerId = obj.blackPlayerId.toString();
      if (white) obj.whitePlayer = { id: white._id.toString(), username: white.username, rating: white.rating, avatar: white.avatar || null };
      if (black) obj.blackPlayer = { id: black._id.toString(), username: black.username, rating: black.rating, avatar: black.avatar || null };
      return obj;
    }));
    res.json({ games: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/friend-request', authMiddleware, async (req, res) => {
  try {
    const toId = req.params.id;
    const fromId = req.user._id.toString();
    if (toId === fromId) return res.status(400).json({ message: "Can't add yourself" });
    const toUser = await User.findById(toId);
    if (!toUser) return res.status(404).json({ message: 'User not found' });
    if (toUser.friendRequestsReceived?.map((id) => id.toString()).includes(fromId)) {
      return res.status(400).json({ message: 'Request already sent' });
    }
    if (toUser.friends?.map((id) => id.toString()).includes(fromId)) {
      return res.status(400).json({ message: 'Already friends' });
    }
    await User.findByIdAndUpdate(toId, { $addToSet: { friendRequestsReceived: fromId } });
    await User.findByIdAndUpdate(fromId, { $addToSet: { friendRequestsSent: toId } });
    res.json({ message: 'Friend request sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/friend-accept', authMiddleware, async (req, res) => {
  try {
    const fromId = req.params.id;
    const meId = req.user._id.toString();
    await User.findByIdAndUpdate(meId, {
      $addToSet: { friends: fromId },
      $pull: { friendRequestsReceived: fromId },
    });
    await User.findByIdAndUpdate(fromId, {
      $addToSet: { friends: meId },
      $pull: { friendRequestsSent: meId },
    });
    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/friend-decline', authMiddleware, async (req, res) => {
  try {
    const fromId = req.params.id;
    const meId = req.user._id.toString();
    await User.findByIdAndUpdate(meId, { $pull: { friendRequestsReceived: fromId } });
    await User.findByIdAndUpdate(fromId, { $pull: { friendRequestsSent: meId } });
    res.json({ message: 'Request declined' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
