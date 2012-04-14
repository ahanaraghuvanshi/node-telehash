var channels = require('./channels');

channels.init({
    ready: function () { //will be called when we are seeded    	
        connect();
    }
});

function connect() {
   
    channels.listen("@alice", function(peer){onConnect(peer,"@alice");});
    channels.connect("@bob", function(peer){onConnect(peer,"@bob");});
    channels.connect("@eve", function(peer){onConnect(peer,"@eve");});
}

function onConnect(peer, User ) {
    if(User == "@alice") {
        console.log("Incoming Connection.");
    }else{
        console.log("Connected to:", User);
    }

    setInterval(function(){
        peer.send( new Buffer("Hi, I'm ALICE!"));
    },3000);
    
    peer.data = function (msg) {
        console.log("<- ",peer.id," ", msg.toString() );
    }  
}
