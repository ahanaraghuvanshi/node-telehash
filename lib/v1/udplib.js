var util = require('./iputil');
var enet = require('enet');
var os = require("os");

exports.enet = enet;
exports.createSocket = createSocket;

function defaultInterfaceIP(iface) {
	var ip = util.getLocalIP(iface);
	if (ip.length) return ip[0];
}

function createSocket(lib, incomingCallback, port, ip, interface, createdCallback, bcast) {
	//decided to go back to listening on "0.0.0.0"
	var default_ip = defaultInterfaceIP(ip || interface);
	if (bcast) {
		/* to listen to bcast packets, we must bind to 0.0.0.0 address */
		ip = "0.0.0.0";
	}

	ip = ip || default_ip || "0.0.0.0";

	switch (lib) {
	case "enet":
		return createENetHost(incomingCallback, port, ip, createdCallback);
	case "node":
	case undefined:
		return createNodeDgramSocket(incomingCallback, port, ip, createdCallback);
	}
}

function createNodeDgramSocket(incomingCallback, port, ip, createdCallback) {
	createdCallback = createdCallback || function () {};
	var dgram = require('dgram');
	var socket = dgram.createSocket("udp4", incomingCallback);
	var closed = false;
	if (port == -1) port = 42424; //default telehash port

	socket.on("listening", function () {
		socket.setBroadcast(true);
		createdCallback(undefined, socket);
	});
	socket.on("close", function () {
		closed = true;
	});
	socket.on("error", function () {
		createdCallback(new Error("bind failed"));
	});
	socket.bind(port, ip);
}

function createENetHost(incomingCallback, port, ip, createdCallback) {
	createdCallback = createdCallback || function () {};
	if (port == -1) port = 42424; //default telehash port
	var addr, host;
	var closed = false;

	try {
		addr = new enet.Address(ip, port);
		host = new enet.Host(addr, 64);
	} catch (e) {
		closed = true;
		createdCallback(e);
	}

	var socket = {
		enet: true,
		send: function (msg, offset, length, port, ip, callback) {
			if (closed) throw new Error("socket closed");
			host.send(ip, port, msg.slice(offset, offset + length - 1), callback);
		},
		close: function () {
			if (closed) throw new Error("socket closed");
			closed = true;
			host.destroy();
		},
		host: host,
		address: function () {
			if (closed) throw new Error("socket closed");
			return ({
				address: host.address().address(),
				port: host.address().port()
			});
		}
	};

	host.on("telex", incomingCallback);
	host.on("ready", function () {
		createdCallback(undefined, socket);
	});
	host.on("error", function () {
		createdCallback(new Error("bind failed"));
	});

	host.start_watcher();
}
