var util = require('./iputil');
var enet = require('enet');

exports.enet = enet;
exports.createSocket = createSocket

function defaultInterfaceIP(iface){
    var ip = util.getLocalIP(iface);
    var i;
    if (ip.length) {
        for(i = 0; i < ip.length; i++){
            if( ip[i] !== "127.0.0.1") return ip[i];
        }
    }
}

function createSocket(lib, incomingCallback, port, ip, interface, onListening){
    //only listen on one ip address and interface
    if(ip === "0.0.0.0" || !ip ) ip = defaultInterfaceIP(interface);
    if(!ip) {
        ip = "127.0.0.1";
        console.log("binding to loopback address");
    }
    switch(lib){
        case "node":
            return createNodeDgramSocket(incomingCallback, port, ip, onListening);
        case "enet":
            return createENetHost(incomingCallback, port, ip, onListening);
        default:
            return createNodeDgramSocket(incomingCallback, port, ip, onListening);
    }
}

function createNodeDgramSocket(cb, port, ip, onListening){
    var dgram = require('dgram');
    var socket =  dgram.createSocket("udp4",cb);
    if(port ==-1) port=42424;//default telehash port   
    socket.bind(port,ip);
    socket.address_original = socket.address;
    socket.address= function(){
            return{ address:ip, port:socket.address_original().port};
    }
    socket.on("listening",function(){
        if(onListening) onListening(socket.address());
    });
    return socket;
}

function createENetHost(cb, port, ip, onListening){
    if(port == -1) port=42424; //defualt telehash port
    var addr = new enet.Address(ip,port);
    var host = new enet.Host(addr,64);

    host.on("telex",cb);
    host.on("ready",function(){
        if(onListening) onListening({ip:ip, port:host.address().port()});
    });
    host.start_watcher();
    return ({
        enet:true,
        send:function(msg,offset,length,port,ip,callback){
            host.send(ip,port,msg.slice(offset,offset+length-1),callback);
        },
        close:function(){
            host.stop_watcher();            
        },
        host:host,
        address:function(){
            return ({
                address:ip, 
                port:host.address().port()
            });
        }
    });
}
