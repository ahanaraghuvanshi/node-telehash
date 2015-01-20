var telehash = require("../index.js").v1.telehash;
var util = require('../lib/v1/iputil');

var localip = util.getLocalIP();

if (localip.length) {
	telehash.init({
		log: console.log,
		mode: 3, // full operating mode
		port: '42424',
		respondToBroadcasts: false, //self seeding hosts should dlisten on a single ip (not 0.0.0.0)
		seeds: [localip[0] + ":42424"], // self seed
	}, function (err, info) {
		if (!err) {
			console.log(info.socket.address());
			telehash.seed(function (err) {
				if (err) console.log(err);
			});
		}
	});
}
