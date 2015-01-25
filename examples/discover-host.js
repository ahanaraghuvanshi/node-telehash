var telehash = require("../index.js").telehash;
var util = require('../lib/iputil');
var NETWORK_INTERFACE = ""; //for example eth0, zt0, or ip-address

telehash.init({
	log: console.error,
	mode: 3, // full operating mode
	interface: NETWORK_INTERFACE,
	udplib: "node",
	respondToBroadcasts: true,
	port: 42424
}, function (err, info) {

	console.log("bound to address:", info.socket.address());
	console.log("listening for broadcasts");
	telehash.broadcast();

});
