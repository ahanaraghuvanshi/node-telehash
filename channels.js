var telehash = require("./telehash");
var hlib = require("./hash");
var util = require("./util");

exports.init = init;
exports.connect = doClient;
exports.listen = doServer;

var peers = {};
var self;

function init(arg){
  if( self ) return self;
  
  self = telehash.init({handleOOB:onOOBData, seeds:arg.seeds});

  telehash.seed( function(err){
        if ( err ){
                console.log(err);
                return;
        }
	if(arg.ready) arg.ready();
  });
}

function doClient( name, onConnect ){
	console.log("Connecting...to:",name);	
	telehash.connect({id:name}, function(s,telex){
		handleResponse(s,telex,onConnect);
	});
	
}

function doServer( name, onConnect ){
	console.log("Listening...for:",name);	
	telehash.listen( {id:name}, function(s,telex){
		handleConnect(s,telex,onConnect);
	});
}

function createNewPeer(id,from){
    //return an object to use to communicate with the connected peer
    var peer={  id:id,
            ipp:from,
            send:function(buffer){//msg should be a Buffer()
                OOBSend(from,buffer);
            },
            data:function(msg){}//to be implemented by user to consume incoming packets
    };
    peers[from]=peer;
    return peer;
}
function OOBSend(to,buffer){
    try {
        var json_data = JSON.parse(buffer.toString());
        json_data['_OOB']=true;
	    msg = new Buffer(JSON.stringify(json_data)+'\n', "utf8");
	    OOBSendRaw(to,msg);
	} catch(E) {
		//!not json
        OOBSendRaw(to,buffer);
        return;
	}
}

function OOBSendRaw(to,buffer){
    var ip = util.IP(to);
    var port = util.PORT(to);
    self.server.send(buffer, 0, buffer.length, port, ip);
}

function onOOBData(msg, rinfo){
    var from = rinfo.address + ":" + rinfo.port;
	//raw data - pass it to the callback for handling
	for(var ipp in peers){
		if(peers[ipp].ipp == from ){
			peers[ipp].data(msg);
		}
	}
}
function handleConnect(s, telex, callback){
	console.log("Got A +CONNECT request from: " + telex['+from']+"+connect="+telex['+connect']+" via:"+s.ipp);	

    var end = new hlib.Hash(telex['+from']).toString();
	var from = telex['+from'];
	var id = telex['+connect'];

    //if we are behind NAT, and remote end is behind SNAT or we are both behind the same NAT send back via relay
    if( self.nat && (telex['+snat'] || util.IP(telex['+from']) == util.IP(telex._to)) ){
	    
        s.send( {'+end':end,'+message':"CONNECT_FAILED",'+connect':id, '+from':self.me.ipp} );//signals to be relayed back

    }else{
        telehash.send(from, {'from':self.me.ipp, 'connect':id, 'message':'OK'});//data telex informing them of our ip:port
        if(!peers[from]){
            callback(createNewPeer(id, from));
    	}
    }
}

function handleResponse(s, telex, callback){
    if( telex['+message'] == "CONNECT_FAILED" ){
        console.log("CONNECT FAILED");
        return;
    }

	console.log("GOT OK from: "+telex['from']+"connect="+telex['connect']);
 
    var from = telex['from'];
	var id = telex['connect'];

    if(!peers[from]){
        callback( createNewPeer(id, from));
	}
}

