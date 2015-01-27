var telehash = require("../index.js").telehash;
var slib = require("../index.js").switch;
var hlib = require("../index.js").hash;
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
		interface: NETWORK_INTERFACE
	}, function (err) {
		if (err) {
			console.error(err);
			process.exit();
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
	if (status === "shutdown") {
		process.exit();
	}
	if (status !== "online") {
		return;
	}

	console.log("public address:", telehash.address());
	console.log("behind NAT?:", telehash.nat());
	console.log("running in mode:", telehash.mode());
}

setInterval(function () {
	slib.getSwitches().forEach(function (s) {
		s.send({
			'+end': s.hash.far()
		});
	});
}, 30000);

setInterval(function () {
	if (telehash.state() !== 2) return; //not online
	telehash.ping("178.79.135.146:42425");
	telehash.ping("178.79.135.146:42424");
}, 20000);

setInterval(function () {
	var peers = telehash.peers();
	console.log("Peers:", peers.length);

}, 20000);

var stdin = process.openStdin();
if (process.platform != 'win32') {
	process.on('SIGINT', function () {
		console.log("Use Control-D to exit.");
	});
}
stdin.on('end', function () {
	telehash.shutdown();
});
