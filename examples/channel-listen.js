var channels = require('channels');

var channel_name = "telehash.echo.server";

if(process.argv[2]) channel_name = process.argv[2];

channels.init({
    ready: function () { //called when we are seeded
        server();
    }
});

function server() {
    //will listen for connections to 'telehash.echo.server'
    //onConnect will be called when a remote switch establish a connection to us
    channels.listen(channel_name, onConnect);
}

function onConnect(peer) {

    //when a remote switch connects to us we can communicate back to them through the peer object
    console.log("CLIENT CONNECTED: " + peer.ipp);    
    peer.data = function (msg) {
	//we receive data through a callback to the the data function
	//and we can send a reply back using the send function. msg is of type Buffer()
        peer.send(msg); //echo message back
    }
    setTimeout(function(){
        peer.send(new Buffer("Welcome..") );
    },200);
}
