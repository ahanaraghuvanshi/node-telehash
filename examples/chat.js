var telehash = require("../index.js").v1.telehash;

var chatCache = {};
var connector;
var chatRoom = "telechat:lobby";
var nickName = "@user";

var stdin = process.openStdin();
stdin.setEncoding("UTF-8");

//throw away output to stderr - required nodejs v0.6+
process.__defineGetter__('stderr', function () {
	return {
		write: function () {}
	};
});

if (!process.argv[2]) {
	console.log("Usage: node chat.js nickname [chatroom]\n");
	process.exit();
}

nickName = process.argv[2];
if (process.argv[3]) chatRoom = process.argv[3];


telehash.init(function (err, info) {
	if (err) return;

	telehash.seed(function (err) {
		if (err) {
			console.log(err);
			return;
		}
		stdin.on('data', function (chunk) {
			if (chunk.length > 1) {
				if (connector) connector.send({
					txt: chunk,
					nick: nickName
				});
			}
		});
		chat(chatRoom);
	});
});

function chat(name) {

	connector = telehash.connect(name, true);

	telehash.listen(name, function (MSG) {
		var msg_sig = MSG.guid + MSG.message;
		if (!chatCache[msg_sig]) {
			if (MSG.message.x) {
				if (MSG.message.x == 'join') console.log("[JOINED] " + MSG.message.nick);
				if (MSG.message.x == 'leave') console.log("[LEFT THE CHAT] <" + MSG.message.nick + ">");
			} else {
				if (MSG.message.txt) console.log("<" + MSG.message.nick + ">: " + MSG.message.txt);
			}
			chatCache[msg_sig] = true;

		}
	});

	console.log("Joining chat room: " + name + " as " + nickName);
	connector.send({
		x: 'join',
		nick: nickName
	});
}

//cant catch SIGINT signals on windows!
if (process.platform != 'win32') {
	process.on('SIGINT', function () {
		console.log("Use Control-D to exit.");
	});
}

stdin.on('end', function () {
	if (this.exiting) return;
	this.exiting = true;
	if (connector) connector.send({
		x: 'leave',
		nick: nickName
	});
	setTimeout(function () {
		telehash.shutdown();
		process.exit(0);
	}, 500);
});
