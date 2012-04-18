var sys = require("sys");
var telehash = require("./telehash");
var hlib = require("./hash");


var stdin = process.openStdin();
stdin.setEncoding("UTF-8");

telehash.init({mode:2});

telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    wall("42");
});
    

function wall( THEWALL ){

    var endHash = new hlib.Hash(THEWALL);
    var tap = {};
    tap.is = {};
    tap.is["+end"] = endHash.toString();
    tap.has = ["+wall"];
    
    console.log("Write Something on the Wall: ", THEWALL);
    
    telehash.tap( THEWALL, tap, function(from,telex){
        //TODO:Keep a short history of incoming telexes and drop duplicates
        console.log(new Date() + " <" + from.ipp + "> " + telex["+wall"]);
    });
       

    stdin.on('data', function(chunk){
        telehash.dial(THEWALL);
        
        console.log("local: " + chunk);
        telehash.announce(THEWALL,{
            '+wall': chunk,
            '+guid': new Date().getTime()
        });
    });        
}

process.on('SIGINT', function() {
    console.log("Use Control-D to exit.");
});

stdin.on('end', function () {
    telehash.shutdown();
    process.exit(0);
});
