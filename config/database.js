var mongoose = require('mongoose');
var mongoDatabaseURI = 'mongodb://'
	+ encodeURIComponent(process.env.DB_USER) + ':'
	+ encodeURIComponent(process.env.DB_PASSWORD) + '@'
	+ process.env.DB_HOST + ':' + process.env.DB_PORT + '/'
	+ process.env.DB_DATABASE;
var safeURI = 'mongodb://' + process.env.DB_USER + ':***@'
	+ process.env.DB_HOST + ':' + process.env.DB_PORT + '/'
	+ process.env.DB_DATABASE;
mongoose.connect(mongoDatabaseURI);

mongoose.connection.on('connected', function() {
	console.log('Mongoose default connection open to ' + safeURI);
});

mongoose.connection.on('error', function(err) {
    console.log('Mongoose default connection error: ' + err);
    console.log('mongoDatabaseURI :' + safeURI);
});

mongoose.connection.on('disconnected', function() {
	console.log('Mongoose default connection disconnected');
});

// TODO: load all model files from directory model.