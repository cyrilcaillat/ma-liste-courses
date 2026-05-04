var mongoose = require('mongoose');

var SessionSchema = new mongoose.Schema({
    key: { type: String, unique: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', SessionSchema);
