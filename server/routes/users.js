const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const { authMiddleware } = require('../middlewares/auth');
const { emitToUser, isUserOnline } = require('../sockets/gameSocket');

const router = express.Router();
const TIME_MAP = { bullet: 60, blitz: 300, rapid: 600, classical: 1800 };

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
      .populate('friendRequestsSent', 'username rating avatar')
      .populate('challengeRequestsReceived.user', 'username rating avatar')
      .populate('challengeRequestsSent.user', 'username rating avatar');

    const addPresence = (people = []) =>
      people.map((person) => ({
        ...person.toObject(),
        online: isUserOnline(person._id),
      }));

    const addChallengePresence = (requests = []) =>
      requests
        .filter((entry) => entry?.user && entry?.game)
        .map((entry) => ({
          gameId: entry.game.toString(),
          timeControl: entry.timeControl || 'blitz',
          createdAt: entry.createdAt,
          user: {
            ...entry.user.toObject(),
            online: isUserOnline(entry.user._id),
          },
        }));

    res.json({
      friends: addPresence(user.friends || []),
      received: addPresence(user.friendRequestsReceived || []),
      sent: addPresence(user.friendRequestsSent || []),
      incomingChallenges: addChallengePresence(user.challengeRequestsReceived || []),
      outgoingChallenges: addChallengePresence(user.challengeRequestsSent || []),
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

router.post('/:id/challenge', authMiddleware, async (req, res) => {
  try {
    const opponentId = req.params.id;
    const challengerId = req.user._id.toString();
    const timeControl = TIME_MAP[req.body?.timeControl] ? req.body.timeControl : 'blitz';

    if (opponentId === challengerId) {
      return res.status(400).json({ message: "You can't challenge yourself" });
    }

    const [challenger, opponent] = await Promise.all([
      User.findById(challengerId),
      User.findById(opponentId),
    ]);

    if (!challenger || !opponent) {
      return res.status(404).json({ message: 'User not found' });
    }

    const areFriends = challenger.friends?.some((id) => id.toString() === opponentId);
    if (!areFriends) {
      return res.status(400).json({ message: 'You can only challenge your friends' });
    }

    const existingIncoming = opponent.challengeRequestsReceived?.find((entry) => entry.user?.toString() === challengerId);
    if (existingIncoming) {
      return res.status(400).json({ message: 'Challenge already sent' });
    }

    const baseTime = TIME_MAP[timeControl] || 300;
    const challengerIsWhite = Math.random() < 0.5;

    const game = await Game.create({
      timeControl,
      status: 'waiting',
      timeWhite: baseTime,
      timeBlack: baseTime,
      whitePlayerId: challengerIsWhite ? challengerId : null,
      blackPlayerId: challengerIsWhite ? null : challengerId,
    });

    const challengeEntry = { user: challengerId, game: game._id, timeControl, createdAt: new Date() };
    const outgoingEntry = { user: opponentId, game: game._id, timeControl, createdAt: challengeEntry.createdAt };

    await Promise.all([
      User.findByIdAndUpdate(opponentId, { $push: { challengeRequestsReceived: challengeEntry } }),
      User.findByIdAndUpdate(challengerId, { $push: { challengeRequestsSent: outgoingEntry } }),
    ]);

    emitToUser(opponentId, 'challenge_received', {
      gameId: game._id.toString(),
      challengerId,
      challengerUsername: challenger.username,
      timeControl,
    });

    res.json({ message: 'Challenge sent', gameId: game._id.toString(), timeControl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/challenges/:gameId/accept', authMiddleware, async (req, res) => {
  try {
    const meId = req.user._id.toString();
    const { gameId } = req.params;

    const me = await User.findById(meId);
    const incoming = me?.challengeRequestsReceived?.find((entry) => entry.game?.toString() === gameId);
    if (!incoming) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const challengerId = incoming.user.toString();
    const game = await Game.findById(gameId);
    if (!game || game.status !== 'waiting') {
      await Promise.all([
        User.findByIdAndUpdate(meId, { $pull: { challengeRequestsReceived: { game: gameId } } }),
        User.findByIdAndUpdate(challengerId, { $pull: { challengeRequestsSent: { game: gameId } } }),
      ]);
      return res.status(400).json({ message: 'Challenge is no longer available' });
    }

    if (game.whitePlayerId && game.blackPlayerId) {
      game.status = 'active';
    } else if (!game.whitePlayerId) {
      game.whitePlayerId = meId;
      game.status = 'active';
    } else if (!game.blackPlayerId) {
      game.blackPlayerId = meId;
      game.status = 'active';
    } else {
      return res.status(400).json({ message: 'Could not join challenge' });
    }

    await game.save();

    await Promise.all([
      User.findByIdAndUpdate(meId, { $pull: { challengeRequestsReceived: { game: gameId } } }),
      User.findByIdAndUpdate(challengerId, { $pull: { challengeRequestsSent: { game: gameId } } }),
    ]);

    emitToUser(challengerId, 'challenge_accepted', {
      gameId: game._id.toString(),
      acceptedById: meId,
      acceptedByUsername: me.username,
    });

    res.json({ message: 'Challenge accepted', gameId: game._id.toString() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/challenges/:gameId/decline', authMiddleware, async (req, res) => {
  try {
    const meId = req.user._id.toString();
    const { gameId } = req.params;

    const me = await User.findById(meId);
    const incoming = me?.challengeRequestsReceived?.find((entry) => entry.game?.toString() === gameId);
    if (!incoming) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const challengerId = incoming.user.toString();

    await Promise.all([
      User.findByIdAndUpdate(meId, { $pull: { challengeRequestsReceived: { game: gameId } } }),
      User.findByIdAndUpdate(challengerId, { $pull: { challengeRequestsSent: { game: gameId } } }),
      Game.findByIdAndDelete(gameId),
    ]);

    emitToUser(challengerId, 'challenge_declined', {
      gameId,
      declinedById: meId,
      declinedByUsername: me.username,
    });

    res.json({ message: 'Challenge declined' });
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
