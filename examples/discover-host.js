var telehash = require("../index.js").v1.telehash;
var util = require('../lib/v1/iputil');
var NETWORK_INTERFACE = "";//for example eth0, zt0

telehash.init({
    mode:3,         // full operating mode
    interface: NETWORK_INTERFACE,
    udplib:"enet",
    respondToBroadcasts:true,
    port:42424,
    onSocketBound:function(addr){
        console.log("bound to address:",addr);
        console.log("listening for broadcasts");
        telehash.broadcast();
    }
});
