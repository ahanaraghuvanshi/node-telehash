var channels = require('channels');
var securelink = require('./secure-link');

channels.init({
    mode:2,
    ready: function () {   	
        connect();
    }
});

var LINK = {
    myName: "@bob",
    myPrivateKey:"keys/bob.pri.pem",
    peerName:"@alice",
    peerPublicKey:"keys/alice.pub.pem",
    callback:onConnected
}

function connect() {
    
    channels.listen(LINK.myName, function(peer){
        securelink.incoming(LINK,peer);
    });
    
    channels.connect(LINK.peerName, function(peer){
        securelink.outgoing(LINK,peer);
    });
}


function onConnected( obj ){
    if(obj.error) {console.log(obj.error); return;}
    
    //if we reached here we have a secure link, slink with @bob
    obj.link.send(new Buffer("Hi Alice, I'm Bob!"));
    obj.link.data=function( msg ){
        console.log( "<<secure message>>",msg.toString() );
    }  
}
