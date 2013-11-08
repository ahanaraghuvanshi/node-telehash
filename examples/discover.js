var telehash = require("../index.js").v1.telehash;
var util = require('../lib/v1/iputil');
var NETWORK_INTERFACE = "";//for example eth0, zt0 - if empty first interface with non loopack address found will be used

telehash.init({
    mode:3,         // full operating mode
    port:4444,
    respondToBroadcasts:true,
    interface: NETWORK_INTERFACE,
    udplib:"enet",
    onSocketBound:function(addr){
        console.log("bound to address:",addr);
        if(process.argv[2] == 'broadcast'){
            console.log("broadcasting...");
            telehash.broadcast();
        } else telehash.seed();
    }
});
