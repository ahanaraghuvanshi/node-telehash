var telehash = require("./telehash");

var stdin = process.openStdin();
stdin.setEncoding("UTF-8");

telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    chat("telechat:lobby");
});

function chat(name) {

    var connector = telehash.connect( name, false );
    
    connector.send("Joining...");
    console.log("Joining chat room: "+ name);
    telehash.listen( name, function( MSG ){
        console.log(new Date() + " <" + MSG.from + "> " + MSG.message);
    });
    
    stdin.on('data', function(chunk){
        connector.send( chunk );
    });
                
}


process.on('SIGINT', function() {
    console.log("Use Control-D to exit.");
});
stdin.on('end', function () {
    telehash.shutdown();
    process.exit(0);
});
