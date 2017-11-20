const prettyjson = require('prettyjson');

exports.prettyLog = function(data, options={}){
	console.log(prettyjson.render(data,options));
}
