var mongoose = require('mongoose');

var ChatStateSchema = new mongoose.Schema({
    chatId: { type: Number, unique: true, index: true },
    currentList: { type: String, default: 'default' },
    knownLists: { type: [String], default: ['default'] },
});

module.exports = mongoose.model('ChatState', ChatStateSchema);
