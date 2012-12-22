var channels = require('../index.js').v1.channels;

channels.init({
    mode:2,
    ready: function () { //will be called when we are seeded    	
        connect();
    }
});
/*
    This example serves to demonstrate certain aspects of the behaviour of the channels module.
    Bear in mind the there can only be one channel open between two unique ip:port. So in the below scenario:
        
        Alice --> listens for @alice
        Alice --> connects to @bob
        
        Bob --> listens for @bob
        Bob --> connects to @alice
        
        Only one channel will be created between @alice's and @bob's switches.
        Depending on the order of packet arrival and which end handles a connect/listen first only one callback
        will occur when a channel is opened with a remote switch.
*/
function connect() {
   
    channels.listen("@alice", function(peer){onConnect(peer,"@alice");});//name others will connect to us by
    channels.connect("@bob", function(peer){onConnect(peer,"@bob");});//friend we want to connect to
    channels.connect("@eve", function(peer){onConnect(peer,"@eve");});//friend we want to connect to
}

function onConnect(peer, User ) {

    if(User == "@alice") {
        console.log("Incoming Connection.");//callback from channels.listen
    }else{
        console.log("Connected to:", User);//callback from channels.connect
    }
    //in both cases above there is no guarantee that anyone is whom they claim to be and we may even get multiple
    //peers claiming to be @bob or @eve.. so we must use public-key crypto to verify our peers 
    //(assuming we have already exchanged our public keys. public keys can be shared on a social network profile page?
    //TODO:It is probably more appropriate verify underlying signals in channels module rather than here to reduce
    //potential number of spam/malicious callbacks..
    
    setInterval(function(){
        peer.send( new Buffer("Hi, I'm ALICE!"));
    },3000);
    
    peer.data = function (msg) {
        console.log("<-- ", msg.toString(), " from:", this.ipp );
    }  
}
