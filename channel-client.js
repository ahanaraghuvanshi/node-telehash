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
    channels.connect("telehash.echo.server", onConnect);    
}

function onConnect(server) {
    //when a connection is made we get back a server object we can use to communicate with the
    //remote switch
    console.log("CONNECTED");
    server.data = function (msg) {
        //this is a triggerred callback for when we receive a datagram from the remote switch
        console.log("data from server: " + msg.toString());
    }

    setInterval(function () {
    	//the send method in the server object is used to send a datagram to the remote switch
        server.send(new Buffer("Hello!"));
    }, 5000);
}