var channels = require('./channels');

channels.init({    
    ready: function () { //will be called when we are seeded    	
        connect();
    }
});

function connect() {
    //this will establish a connection to any switche(s) on the network
    //listening for 'telehash.echo.server'. onConnect will be called for each remote switch
    //which accepts the connection request.
    //note: The connect process is continious and will keep attempting to connect to all and any switches
    //on the network, as they join and leave.
    channels.connect("telehash.echo.server", onConnect);    
}

function onConnect(server) {
    //when a connection is made we get back a server object we can use to communicate with the
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
