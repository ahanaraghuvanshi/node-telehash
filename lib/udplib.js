var util = require('./iputil');
var enet;

exports.createSocket = createSocket

var localip = util.getLocalIP();
var default_local_ip="0.0.0.0";

if (localip.length > 0) {
    var list = [];
    for(var i = 0; i < localip.length; i++){
        if( localip[i] != "127.0.0.1") { default_local_ip=localip[i]; break;}
    }
}

function createSocket(lib, incomingCallback, port, ip){
    switch(lib){
        case "node":
            console.log("UDP lib: node");
            return createNodeDgramSocket(incomingCallback, port, ip);
        case "enet":
            console.log("UDP lib: ENet");
            return createENetHost(incomingCallback, port, ip);

        //TODO
        case "chrome:udp":
        case "firefox":
        case "node.js on android/iphone":
        case "JS based mobile frameworks":

        default:
            console.log("UDP lib: node");
            return createNodeDgramSocket(incomingCallback, port, ip);
    }
}

function createNodeDgramSocket(cb,port,ip){
    var dgram = require('dgram');
    var socket =  dgram.createSocket("udp4",cb);
    if(port ==-1) port=42424;//default telehash port   
    socket.bind(port,ip);
    
    socket.address_original = socket.address;
    socket.address= function(){
            var addr;
            if(ip == "0.0.0.0" || this.address_original().address=="0.0.0.0") {
                addr=default_local_ip;            
            }else addr = this.address_original().address;
            
            return{ address:addr, port:this.address_original().port};
     }
     return socket;
}

function createENetHost(cb,port,ip){
    if(!enet){
        enet = require('enet');
    }
    if(port == -1) port=42424; //defualt telehash port
    var addr = new enet.Address(ip,port);
    var host = new enet.Host(addr,64);

    host.on("telex",cb);
    host.start_watcher();
    host.peers = {};
    return ({
        enet:true,
        send:function(msg,start_index,length,port,ip){
            host.send(ip,port,msg);
        },
        close:function(){
            host.stop_watcher();            
        },
        host:host,
        address:function(){
            if(ip && ip!="0.0.0.0") return ({address:ip, port:this.host.address().port()});
            return ({
                address:default_local_ip, 
                port:this.host.address().port()
            });
        }
    });
}
