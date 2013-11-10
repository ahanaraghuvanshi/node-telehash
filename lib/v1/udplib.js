var util = require('./iputil');
var enet = require('enet');

exports.enet = enet;
exports.createSocket = createSocket

function defaultInterfaceIP(iface){
    var ip = util.getLocalIP(iface);
    if (ip.length) return ip[0];
}

function createSocket(lib, incomingCallback, port, ip, interface, onListening, bcast){
  /* better to only listen on one ip address and interface */
  /* unless we need to listen to bcast packets, so must listen on 0.0.0.0 === */
    var default_ip = defaultInterfaceIP(interface);
    if(bcast){
        ip = "0.0.0.0";
    }else{
        if(ip === "0.0.0.0" || !ip){
            ip = default_ip;
        }else{
            /* user specified ip doesn't match default interface ip */
            default_ip = ip;
        }
    }
    if(!ip || !default_ip) {
        ip = default_ip = "127.0.0.1";
        console.log("falling back on loopback interface");
    }

    switch(lib){
        case "node":
            return createNodeDgramSocket(incomingCallback, port, ip, onListening, default_ip);
        case "enet":
            return createENetHost(incomingCallback, port, ip, onListening, default_ip);
        default:
            return createNodeDgramSocket(incomingCallback, port, ip, onListening, default_ip);
    }
}

function createNodeDgramSocket(cb, port, ip, onListening, default_ip){
    var dgram = require('dgram');
    var socket =  dgram.createSocket("udp4",cb);
    if(port ==-1) port=42424;//default telehash port   
    socket.address_original = socket.address;
    socket.address= function(){
            return{ address:default_ip, port:socket.address_original().port};
    }
    socket.on("listening",function(){
        socket.setBroadcast(true);
        if(onListening) onListening(socket.address());
    });
    socket.bind(port,ip);
    return socket;
}

function createENetHost(cb, port, ip, onListening, default_ip){
    if(port == -1) port=42424; //default telehash port
    var addr = new enet.Address(ip,port);
    var host = new enet.Host(addr,64);

    host.on("telex",cb);
    host.on("ready",function(){
        if(onListening) onListening({address:default_ip, port:host.address().port()});
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
                address:default_ip, 
                port:host.address().port()
            });
        }
    });
}
