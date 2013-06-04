var telehash = require("../index.js").v1.telehash;
var util = require('../lib/v1/iputil');
var localip = util.getLocalIP();

if (localip.length > 0) {
    var list = [];
    for(var i = 0; i < localip.length; i++){
        if( localip[i] != "127.0.0.1") { list[0] = localip[i]+":4444"; break;}//get first local ip use as our $
    }

    telehash.init({
        mode:3,         // full operating mode
        port:4444,
        respondToBroadcasts:true,
    });
    
    if(process.argv[2] == 'broadcast'){
        console.log("broadcasting...");
        telehash.broadcast(list[0]);
    } else telehash.seed();

}
