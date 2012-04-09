var channels = require('./channels');

channels.init({
	//seeds:['172.16.200.253:42424'],
	ready:function(){
		server();		
	}		
});

function server(){
	channels.listen("telehash.echo.server", onConnect );
}

function onConnect( peer ){

	console.log("NEW CLIENT: "+peer.ipp+" channel:"+peer.channel);
	peer.data = function(msg){
	
		this.send(msg);//echo message back
		
	}
}
