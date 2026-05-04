var mongoose = require('mongoose');

var HistorySchema = new mongoose.Schema({
    chatId:   { type: Number, index: true },
    text:     { type: String },
    count:    { type: Number, default: 1 },
    lastUsed: { type: Date,   default: Date.now },
});
HistorySchema.index({ chatId: 1, text: 1 }, { unique: true });

module.exports = mongoose.model('History', HistorySchema);
