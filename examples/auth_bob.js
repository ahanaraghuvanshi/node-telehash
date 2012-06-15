var channels = require('echannels');
var securelink = require('./secure-link');

channels.init({   
    ready: function () {   	
        connect();
    }
});

var LINK = {
    self:{
        id:"@bob",
        key:"keys/bob.pri.pem"
    },
    peers:{},
    callback:onConnected
}

LINK.peers["@bob"]={key:"keys/bob.pub.pem"};
LINK.peers["@alice"]={key:"keys/alice.pub.pem"};

function connect() {
    channels.listen(LINK.self.id, function(peer){
        securelink.incoming(LINK,peer);
    });
    
    channels.connect("@alice", function(peer){
        securelink.outgoing(LINK,peer,"@alice");
    });
}


function onConnected( obj ){
    if(obj.error) {console.log(obj.error); return;}
    
    //if we reached here we have a secure link
    obj.link.send(new Buffer("Hi "+obj.link.peerid+", I'm "+LINK.self.id+"!"));
    obj.link.data=function( msg ){
        console.log( "<<secure message>>",msg.toString() );
    }  
}
