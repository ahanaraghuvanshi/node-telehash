var telehash = require("./telehash");
var hlib = require("./hash");
var util = require("./util");

exports.init = init;
exports.connect = doConnector;
exports.listen = doListener;

var knocks = []
var peers = {};
var self;

function init(arg) {
    if (self) return self;

    self = telehash.init({
        mode:2,
        handleOOB: onOOBData,	//capture out-of-band packets coming into the switch
        seeds: arg.seeds
    });

    telehash.seed(function (err) {
        if (err) {
            console.log(err);
            return;
        }
        //inform consumer of module that we are seeded so they can start to connect/listen
        if (arg.ready) arg.ready(); 
    });
}

//using the telehash.connect() function find switches on the network listening for 'name'
//and establish a line to them. the connection setup is handeled by handleResponse which will
//callback onConnect with a new peer handler object
function doConnector(name, onConnect, retry) {
    console.log("Connecting...to: ", name);
    var connector = telehash.connect(name);
    
    connector.send({con:'CONNECT'}, function(obj){
        if( obj ){
           handleResponse(obj.from,obj.message,onConnect);
        }else{        
           //connect timeout..loop again.
           setTimeout( function(){
                doConnector(name,onConnect);           
           }, retry? retry*1000:20000 ); //try again after 'retry' seconds, or 20 seconds default
        }    
    },10);//10 second timeout for responses
}

//using the telehash.listen() function accept connections from switches on the network looking for 'name'
//establishing a line to them. The connectio setup is handled by handleConnect which will callback onConnect 
//with a new peer handler object
function doListener(name, onConnect) {
    console.log("Listening...for:", name);
    telehash.listen(name, function ( conn ) {
        handleConnect(conn, onConnect);
    });
}

function createNewPeer(from) {
    //return an object to use to communicate with the connected peer
    var peer = {
        ipp: from,
        send: function (buffer) { //msg should be a Buffer()
            OOBSend(from, buffer);
        },
        data: function (msg) {} //to be implemented by user to consume incoming packets
    };
    peers[from] = peer;
    return peer;
}

//function to access underlying switch udp-socket to send raw data, or json out-of-band.
//The switch will automatically assume non json datagrams are out of band, but inorder for the
//switch not to interpret channels json data as telexes we have to mark them with a _OOB header.
//The _OOB header will be stripped at the receiving end.
function OOBSend(to, buffer) {
    try {
        var json_data = JSON.parse(buffer.toString());
        json_data['_OOB'] = true;
        msg = new Buffer(JSON.stringify(json_data) + '\n', "utf8");
        OOBSendRaw(to, msg);
    } catch (E) {
        //not json
        OOBSendRaw(to, buffer);
        return;
    }
}

//this actually sends the data on the socket.
function OOBSendRaw(to, buffer) {
    var ip = util.IP(to);
    var port = util.PORT(to);
    self.server.send(buffer, 0, buffer.length, port, ip);
}

//this will be called when we get out-of-band data from the underlying switch which
//should be coming from a peer we have already established a connection with!
function onOOBData(msg, rinfo) {
    var from = rinfo.address + ":" + rinfo.port;
    //is it a knock?
    if(msg.toString() == "TELEHASH#KNOCK\n"){
    	knocks.forEach(function(K){
    		if(K.ip == rinfo.address && K.timeout > Date.now() ){
                if(!peers[from]) K.callback(createNewPeer(from));
    		}
    	});
        return;
    }    
    //raw data - pass it to the callback for handling
    for (var ipp in peers) {
        if (peers[ipp].ipp == from) {
            peers[ipp].data(msg);	//found the matching peer handler, pass it the data
        }
    }
}

function handleConnect(conn, callback) {

    if( conn.message.con != "CONNECT") return;
    if( peers[conn.from]) return;//already connected
    console.log("Got A CONNECT request from: " + conn.from + " via:" + conn.source);

    if(conn.visible){
        if(!self.snat){
            conn.reply({status:'OK', from:self.me.ipp});
            if (!peers[conn.from]) {
                callback(createNewPeer(conn.from));
            }
            return;
        }
    }else{
        if(!self.nat){
        	
            conn.reply({status:"NAT", from:self.me.ipp});
            //open a 10 second window to allow other end to send an OOB knock from ip address util.IP(conn.from)
            //and callback new peer.
            
            knocks.push({
            	ip:util.IP(conn.from),
            	callback:callback,
            	timeout:Date.now()+10000
            });

            return;
        }
    }
    
    conn.reply({status:"FAILED", from:self.me.ipp});
}

function handleResponse(from, message, callback) {
    if( message.status == "FAILED"){
        return;
    }
    if( peers[message.from] ) return;//already connected
    if (message.status == "NAT") {
        console.log("Sending KNOCK To:"+message.from);
        OOBSend(message.from, new Buffer('TELEHASH#KNOCK\n'));
    }
    if (!peers[message.from]) {
        callback(createNewPeer(message.from));
    }
}
