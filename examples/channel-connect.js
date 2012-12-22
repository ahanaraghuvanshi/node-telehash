var channels = require('../index.js').v1.channels;

var channel_name = "telehash.echo.server";

if(process.argv[2]) channel_name = process.argv[2];

channels.init({    
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
    
    channels.connect(channel_name, onConnect, 30);
}

function onConnect(server) {   
    //when a connection is made we get back a peer object we can use to communicate with the
    //remote switch
    console.log("CONNECTED TO:",server.ipp);
    server.data = function (msg) {
        //this is a triggerred callback for when we receive a datagram from the remote switch
        console.log("data from server: " + msg.toString());
    }

    //simply send a 'Hello!' every 5 seconds..
    setInterval(function () {
    	//the send method in the server object is used to send a datagram to the remote switch
        server.send(new Buffer("Hello!"));
    }, 5000);
}
