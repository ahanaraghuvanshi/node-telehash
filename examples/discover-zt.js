/* Experimental telehash on ZeroTier 'earth' network */
var telehash = require("../index.js").v1.telehash;
var NETWORK_INTERFACE = "zt0"; //tun interface created by zerotier
var bcast = process.argv[2] == 'broadcast';

telehash.init({
    mode:3,         // full operating mode
    interface: NETWORK_INTERFACE,
    seeds: ["28.192.75.207:42424"],
    udplib:"enet",
    onSocketBound:function(addr){
        console.log("bound to address:",addr);
        if(bcast){
            console.log("broadcasting...");
            telehash.broadcast();
        } else telehash.seed();
    }
});
