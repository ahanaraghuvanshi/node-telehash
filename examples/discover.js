var telehash = require("../index.js").telehash;
var slib = require("../index.js").switch;
var util = require('../lib/iputil');
var NETWORK_INTERFACE = ""; //for example eth0, zt0 - if empty first interface with non loopack address found will be used

var bcast = process.argv[2] == 'broadcast';

init(oninit);

function oninit() {
	if (bcast) {
		console.log("broadcasting...");
		telehash.broadcast();
	} else telehash.seed(seeding);

}

function init(callback) {
	console.log("initialising");
	telehash.init({
		mode: 3, // full operating mode
		interface: NETWORK_INTERFACE,
		port: 42424
	}, function (err) {
		if (err) {
			console.error(err);
			setTimeout(function () {
				init(callback);
			}, 5000);
			return;
		}
		callback();
	});
}

function seeding(status, info) {
	console.log("Status update:", status, info ? info : "");
	if (status === 'offline' && info === 'snat-detected') {
		console.log("Network firewall/NAT router is restricted. Exiting..");
		process.exit();
	}
	if (status !== "online") {
		return;
	}

	console.log("public address:", telehash.publicAddress());
}

setInterval(function () {
	if (telehash.state() !== 2) return; //not online
	telehash.ping("178.79.135.146:42425");
	telehash.ping("178.79.135.146:42424");
}, 20000);

setInterval(function () {
	var peers = telehash.peers();
	console.log("Peers:", peers.length);

}, 20000);
