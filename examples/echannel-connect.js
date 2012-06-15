var channels = require('echannels');

var channel_name = "telehash.echo.server";

if(process.argv[2]) channel_name = process.argv[2];
var port = process.argv[3] ? process.argv[3] : 0;

channels.init({
//    seeds:['192.168.42.157:42424'],
    port:port,    
    ready: function () { //will be called when we are seeded    	
        connect();
    }
});
   
function connect() {
    //this will establish a connection to any switche(s) on the network
    //listening for 'telehash.echo.server'. onConnect will be called for each remote switch
    //which accepts the connection request.
    //note: The connect process will keep retrying to connect after a default 20 sec timeout so we can
    //keep attempting to connect to all and any switches as they join and leave the network
    
    channels.connect(channel_name, onConnect, 0);
}

function onConnect(server) {  
    //when a connection is made we get back a peer object we can use to communicate with the
    //remote switch
    console.log("CONNECTED TO:",server.ipp);
    //simply send a 'Hello!' every 5 seconds..
    server.data = function (msg) {
        //this is a triggerred callback for when we receive a datagram from the remote switch
        console.log("data from server: " + msg.toString());
    }
    var interval = setInterval(function () {
    	//the send method in the server object is used to send a datagram to the remote switch
        if(server) server.send(new Buffer("Hello!"),0);
        //if(server) server.send(new Buffer("Hello! On Channel1"),1);
    }, 20);
    
    server.disconnected = function(){
        clearInterval(interval);
    }   
}
