var channels = require('./channels');

channels.init({
	//seeds:['172.16.200.253:42424'],
	ready:function(){
		connect();
	}		
});

function connect(){

	channels.connect("telehash.echo.server", onConnect );
}

function onConnect( server ){

	console.log("CONNECTED");
	server.data = function(msg){

		console.log("data from server: " + msg.toString() );
	}

	setInterval( function(){				
		server.send( new Buffer("Hello!") );
	},5000);
}


