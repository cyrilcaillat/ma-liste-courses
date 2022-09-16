var mongoose = require('mongoose');
var mongoDatabaseURI = 'mongodb://'+process.env.DB_USER+':'+process.env.DB_PASSWORD+'@'+process.env.DB_HOST+':'+process.env.DB_PORT+'/'+process.env.DB_DATABASE;
mongoose.connect(mongoDatabaseURI,{ useNewUrlParser: true,useUnifiedTopology: true  } );

mongoose.connection.on('connected', function() {
	console.log('Mongoose default connection open to ' + mongoDatabaseURI);
});

mongoose.connection.on('error', function(err) {
    console.log('Mongoose default connection error: ' + err);
    console.log('mongoDatabaseURI :'+mongoDatabaseURI);
});

mongoose.connection.on('disconnected', function() {
	console.log('Mongoose default connection disconnected');
});

// TODO: load all model files from directory model.