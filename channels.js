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
    
    if(arg.mode !=2 || arg.mode !=3) arg.mode = 2; //minimum required is mode 2 for channels to work.
    
    self = telehash.init({
        channels_init:true,     //to check if we initialsed telehash module first
        mode:arg.mode,
        handleOOB: onOOBData,	//capture out-of-band packets coming into the switch
        seeds: arg.seeds,
        port: arg.port,
        ip: arg.ip
    });

    if( !self.channels_init ){
        console.log("Warning: Channels module needs to be initialise before telehash module!");
        process.exit();
    }
    
    telehash.seed(function (err) {
        if (err) {
            console.log(err);
            return;
        }
        //inform consumer of module that we are seeded so they can start to connect/listen
        if (arg.ready) arg.ready(); 
    });
    
    return self;
}

//using the telehash.connect() function find switches on the network listening for 'name'
//and send them a connection request. the connection setup is handeled by handleResponse which will
//callback onConnect with a new peer handler object
function doConnector(name, onConnect, retry) {
    console.log("Connecting...to: ", name);
    var connector = telehash.connect(name);

    connector.send({x:'CONNECT',snat:self.snat,ipp:self.me.ipp}, function(obj){
        if( obj ){
           handleResponse(obj.message,onConnect);
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

function popf(to){
    OOBSendRaw(to,new Buffer(JSON.stringify({})));
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

    if( conn.message.x != "CONNECT") return;
    
    //if( peers[conn.message.ipp]) return;//already connected
    
    console.log("Got A CONNECT request from: " + conn.from + " via:" + conn.source);

    if(conn.message.snat || util.IP(conn.message.ipp)==self.me.ip ){
        if(!self.nat){
            conn.reply({status:"NAT", ipp:self.me.ipp});
            //open a 10 second window to allow other end to send an OOB knock from ip address util.IP(conn.message.ipp)
            //and callback new peer.
            knocks.push({
            	ip:util.IP(conn.message.ipp),
            	callback:callback,
            	timeout:Date.now()+10000
            });
            return;
        }
    }else{        
        if(!self.snat){
            conn.reply({status:'OK', ipp:self.me.ipp});
            popf(conn.message.ipp);//pop our firewall
            
            if (!peers[conn.message.ipp]) {                
                callback(createNewPeer(conn.message.ipp));
            }
            return;
        }else{
            //reverse..we will send a knock
            conn.reply({status:'REVERSE', ip:self.me.ip});
            console.error("CHANNELS: Reversing Connection");
            //short delay..
            setTimeout(function(){
                OOBSend(conn.message.ipp, new Buffer('TELEHASH#KNOCK\n'));//todo make the knock a random number
                if (!peers[conn.message.ipp]) {                
                    callback(createNewPeer(conn.message.ipp));
                }
            },1500);
            return;
        }
    }
    if( util.IP(conn.message.ipp)==self.me.ip ) {
        conn.reply({status:"LOCAL"});//todo: send our local ip
    }else{
        conn.reply({status:"FAILED"});
    }
}

function handleResponse(message, callback) {
    if( message.status == "FAILED"){
        //todo: we will need to proxy our connections through a 3rd party!
        return;
    }
    if( message.status == "LOCAL"){
        //todo we are behind same NAT.. exchange local ip addresses - nice if we are on the same LAN
        //if we are both behing a 3G/mobile network chances are low that we are going to see each other
        return;
    }
    
    if( message.status == "REVERSE"){
        //this will work from first time as long as other end is not behind a load balancer (multiple ip addresses)
        //otherwise multiple connect retries will be required..
        //open a 10 second window to allow other end to send an OOB knock from ip address util.IP(message.ip)
        //and callback new peer.
        knocks.push({
          	ip:util.IP(message.ip),
           	callback:callback,
           	timeout:Date.now()+10000
        });
        console.error("CHANNELS: Reversing Connection");
        return;    
    }
    
    if (message.status == "NAT" || message.status == "OK" ){
        popf(message.ipp);//pop the firewall
        
        if (message.status == "NAT") {
            console.log("Sending KNOCK To:"+message.ipp);
            OOBSend(message.ipp, new Buffer('TELEHASH#KNOCK\n'));//todo make the knock a random number
        }
    
        if (!peers[message.ipp]) {
            callback(createNewPeer(message.ipp));
        }
    }
}
