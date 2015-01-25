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
		host.once("shutdown", function () {
			closed = true;
		});
		var socket = {
			_telehash: true,
			host: host,
			send: function (msg, offset, length, port, ip, callback) {
				if (closed) throw new Error("socket closed");
				host.send(ip, port, msg.slice(offset, offset + length - 1), callback);
			},
			close: function () {
				if (closed) throw new Error("socket closed");
				closed = true;
				host.removeListener("telex", incomingCallback);
				host.destroy();
			},
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
