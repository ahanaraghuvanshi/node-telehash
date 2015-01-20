var telehash = require("../index.js").v1.telehash;
var util = require('../lib/v1/iputil');
var NETWORK_INTERFACE = ""; //for example eth0, zt0 - if empty first interface with non loopack address found will be used
var bcast = process.argv[2] == 'broadcast';

init(function (info) {
	console.log("bound to:", info.socket.address());
	if (bcast) {
		console.log("broadcasting...");
		telehash.broadcast();
	} else telehash.seed(seeding);

});

function init(callback) {
	console.log("initialising");
	telehash.init({
		log: console.error,
		mode: 3, // full operating mode
		interface: NETWORK_INTERFACE,
		udplib: "enet",
	}, function (err, info) {
		if (err) {
			console.error(err);
			setTimeout(function () {
				init(callback);
			}, 5000);
			return;
		}
		callback(info);
	});
}

function seeding(err) {
	if (status !== "online") {
		console.log(status);
		return;
	}
	console.log("== ONLINE ==");
}
