const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  whitePlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  blackPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  timeControl: { type: String, enum: ['bullet', 'blitz', 'rapid', 'classical'], default: 'blitz' },
  timeWhite: { type: Number, default: null },
  timeBlack: { type: Number, default: null },
  fen: { type: String, default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  pgn: { type: String, default: '' },
  moveCount: { type: Number, default: 0 },
  status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
  result: { type: String, enum: ['white', 'black', 'draw', null], default: null },
  termination: { type: String, default: null },
  isAiGame: { type: Boolean, default: false },
  aiDifficulty: { type: String, enum: ['easy', 'medium', 'hard', null], default: null },
  lastMoveAt: { type: Date, default: null },
}, { timestamps: true });

gameSchema.methods.toPublic = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  if (obj.whitePlayerId) obj.whitePlayerId = obj.whitePlayerId.toString();
  if (obj.blackPlayerId) obj.blackPlayerId = obj.blackPlayerId.toString();
  return obj;
};

module.exports = mongoose.model('Game', gameSchema);