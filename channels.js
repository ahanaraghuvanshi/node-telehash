var telehash = require("./telehash");
var hlib = require("./hash");
var util = require("./util");

exports.init = init;
exports.connect = doConnector;
exports.listen = doListener;

var peers = {};
var self;

function init(arg) {
    if (self) return self;

    self = telehash.init({
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
function doConnector(name, onConnect) {
    console.log("Connecting...to: ", name);
    telehash.connect({
        id: name
    }, function (s, telex) {
        handleResponse(s, telex, onConnect);
    });

}

//using the telehash.listen() function accept connections from switches on the network looking for 'name'
//establishing a line to them. The connectio setup is handled by handleConnect which will callback onConnect 
//with a new peer handler object
function doListener(name, onConnect) {
    console.log("Listening...for:", name);
    telehash.listen({
        id: name
    }, function (s, telex) {
        handleConnect(s, telex, onConnect);
    });
}

function createNewPeer(id, from) {
    //return an object to use to communicate with the connected peer
    var peer = {
        id: id,
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
    //raw data - pass it to the callback for handling
    for (var ipp in peers) {
        if (peers[ipp].ipp == from) {
            peers[ipp].data(msg);	//found the matching peer handler, pass it the data
        }
    }
}

function handleConnect(s, telex, callback) {
    console.error("Got A +CONNECT request from: " + telex['+from'] + "+connect=" + telex['+connect'] + " via:" + s.ipp);

    var end = new hlib.Hash(telex['+from']).toString();
    var from = telex['+from'];
    var id = telex['+connect'];

    //if we are behind NAT, and remote end is behind SNAT or we are both behind the same NAT send back via relay
    if (self.nat && (telex['+snat'] || util.IP(telex['+from']) == util.IP(telex._to))) {

        s.send({
            '+end': end,
            '+message': "CONNECT_FAILED",
            '+response': id,
            '+from': self.me.ipp,
            '_hop':1
        }); //signals to be relayed back
    } else {
        telehash.send(from, {
            '+from': self.me.ipp,
            '+response': id,
            '+message': 'OK'
        }); //data telex informing them of our ip:port
        if (!peers[from]) {
            callback(createNewPeer(id, from));
        }
    }
}

function handleResponse(s, telex, callback) {
    if (telex['+message'] == "CONNECT_FAILED") {
        console.error("CONNECT FAILED");
        return;
    }

    console.error("GOT OK from: " + telex['+from'] + "response=" + telex['+response']);

    var from = telex['+from'];
    var id = telex['+response'];

    if (!peers[from]) {
        callback(createNewPeer(id, from));
    }
}
