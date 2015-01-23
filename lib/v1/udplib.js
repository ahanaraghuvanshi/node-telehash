var util = require('./iputil');
var enet = require('enet');
var os = require("os");

exports.enet = enet;
exports.createSocket = createSocket;

function defaultInterfaceIP(iface) {
	//iface can be an interface name string or ip address string
	//returns first ip address of interface or the ip address if it matches
	//an ipv4 external network interface address
	var ip = util.getLocalIP(iface);
	if (ip.length) return ip[0];
}

function createSocket(lib, incomingCallback, port, interface, createdCallback, bcast) {
	var ip;
	interface = interface || "ALL";

	if (bcast || interface === "ALL") {
		/* to listen to bcast packets, we must bind to 0.0.0.0 address
		 * listening on all interfaces help to recover from network interfaces going up and down
		 */
		ip = "0.0.0.0";
	}

	if (interface === "127.0.0.1") {
		ip = interface;
	} else {
		if (!ip) ip = defaultInterfaceIP(interface);
	}

	if (!ip && interface) {
		ip = interface;
	}

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
	var closed = true;
	if (port == -1) port = 42424; //default telehash port

	socket.on("listening", function () {
		closed = false;
		socket.setBroadcast(true);
		createdCallback(undefined, socket);
	});
	socket.on("close", function () {
		closed = true;
	});
	socket.on("error", function (e) {
		closed = true;
		createdCallback(e);
	});

	socket.bind(port, ip);
}

function createENetHost(incomingCallback, port, ip, createdCallback) {
	createdCallback = createdCallback || function () {};
	if (port == -1) port = 42424; //default telehash port
	var addr;
	var closed = true;

	try {
		addr = new enet.Address(ip, port);
	} catch (e) {
		createdCallback(e);
		return;
	}

	enet.createServer({
		address: addr,
		peers: 64
	}, function (err, host) {
		if (err) {
			closed = true;
			createdCallback(err);
			return;
		}
		closed = false;
		host.on("telex", incomingCallback);
		host.on("shutdown", function () {
			closed = true;
		});
		var socket = {
			enet: host,
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
					address: host.address().address,
					port: host.address().port
				});
			}
		};
		host.start();
		createdCallback(undefined, socket);
	});
}
