var mongoose = require('mongoose');

var TodoSchema = new mongoose.Schema({
	text: String,
	date: {
		type: Date,
		default: Date.now
	},
	done: {
		type: Boolean,
		default: false
	},
	creator: {
		type: String
	},
	creatorId: {
		type: Number
	},
	chatId: {
		type : Number
	}
});

var TodoModel = mongoose.model('Todo', TodoSchema);

module.exports = TodoModel;