var telehash = require("telehash");
var util = require('iputil');

var localip = util.getLocalIP();

if (localip.length > 0) {

    var list = [];
    for(var i = 0; i < localip.length; i++){
        if( localip[i] != "127.0.0.1") { list[0] = localip[i]+":42424"; break;}//get first local ip use as our identity
    }

    telehash.init({
        mode:3,         // full operating mode
        port: '42424',
        seeds: list     // self seed
    });
    
    telehash.seed();
}
