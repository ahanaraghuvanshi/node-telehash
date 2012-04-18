var telehash = require("./telehash");

var stdin = process.openStdin();
stdin.setEncoding("UTF-8");

var chatHistory = {};
var connector;

telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    chat("telechat:lobby");
});

function chat(name) {

    connector = telehash.connect( name, true );    
    connector.send("[JOINED]");
    
    telehash.listen( name, function( MSG ){
        var msg_sig = MSG.guid + MSG.from
        if(!chatHistory[msg_sig]){    
            console.log(MSG.guid + ":<" + MSG.from + "> " + MSG.message);
            chatHistory[msg_sig] = MSG.message;
        }
    });
        
    stdin.on('data', function(chunk){
        connector.send( chunk );
    });
    
    console.log("Joining chat room: "+ name);                
}


process.on('SIGINT', function() {
    console.log("Use Control-D to exit.");
});
stdin.on('end', function () {
    if(this.exiting) return;
    this.exiting = true;
    if(connector) connector.send("[LEFT THE CHAT ROOM]");
    setTimeout(function(){
        telehash.shutdown();
        process.exit(0);
    },500);
});
