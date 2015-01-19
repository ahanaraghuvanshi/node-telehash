var telehash = require("../index.js").v1.telehash;
var util = require('../lib/v1/iputil');
var NETWORK_INTERFACE = ""; //for example eth0, zt0 - if empty first interface with non loopack address found will be used

var bcast = process.argv[2] == 'broadcast';

telehash.init({
	log: console.error,
	mode: 3, // full operating mode
	interface: NETWORK_INTERFACE,
	udplib: "enet",
	onSocketBound: function (addr) {
		console.log("bound to address:", addr);
		if (bcast) {
			console.log("broadcasting...");
			telehash.broadcast();
		} else telehash.seed();
	}
});
