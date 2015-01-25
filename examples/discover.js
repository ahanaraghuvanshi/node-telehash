var telehash = require("../index.js").telehash;
var slib = require("../index.js").switch;
var util = require('../lib/iputil');
var NETWORK_INTERFACE = ""; //for example eth0, zt0 - if empty first interface with non loopack address found will be used
var bcast = process.argv[2] == 'broadcast';
var th;

var socket = require('dgram').createSocket("udp4");
socket.bind();

//socket.on("listening", function () {
init(oninit);
//});

function oninit(info) {
	console.log("bound to:", info.socket.address());
	if (bcast) {
		console.log("broadcasting...");
		telehash.broadcast();
	} else telehash.seed(seeding);

}

function init(callback) {
	console.log("initialising");
	telehash.init({
		log: console.error,
		mode: 3, // full operating mode
		interface: NETWORK_INTERFACE,
		socket: socket,
		port: -1,
		packetLog: console.log
	}, function (err, info) {
		if (err) {
			console.error(err);
			setTimeout(function () {
				init(callback);
			}, 5000);
			return;
		}
		th = info;
		callback(info);
	});
}

function seeding(status) {
	if (status === 'snat-detected') {
		console.log("Your firewall/NAT is restricted. Exiting..");
		process.exit();
	}
	if (status !== "online") {
		console.log(status);
		return;
	}
	/*
	setInterval(function () {
		if (!th) return;
		if (!(th.state === 2)) return; //not online
		telehash.ping("178.79.135.146:42425");
		telehash.ping("178.79.135.146:42424");
	}, 20000);
	*/
	console.log("== ONLINE ==");
}
