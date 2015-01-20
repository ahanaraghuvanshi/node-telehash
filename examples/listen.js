var telehash = require("../index.js").v1.telehash;

telehash.init(function initialised(err, info) {
	if (err) {
		console.log(err);
		return;
	}
	console.log("initialised");
	telehash.seed(function (status) {
		if (status !== "online") {
			console.log(status);
			return;
		}
		console.log("seeded");
		server("echo.message.back");
	});
});

function server(name) {
	console.log("server running");
	telehash.listen(name, function (conn) {
		console.log("<<-- MESSAGE:", conn.message, " from:", conn.from, " via:", conn.source);
		conn.reply("I Agree, '" + conn.message + "'");
	});
}
