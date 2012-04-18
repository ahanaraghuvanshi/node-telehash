var telehash = require("./telehash");

var chatCache = {};
var connector;
var chatRoom = "telechat:lobby";
var nickName = "@user";

var stdin = process.openStdin();
stdin.setEncoding("UTF-8");

//throw away output to stderr - required nodejs v0.6+
process.__defineGetter__('stderr', function() {
    return {write:function(){}};
});
 
if( !process.argv[2] ) {
    console.log("Usage: node chat.js nickname [chatroom]\n");
    process.exit();
}

nickName = process.argv[2];
if( process.argv[3] ) chatRoom = process.argv[3];




telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    chat( chatRoom );
});

function chat(name) {

    connector = telehash.connect( name, true ); 
          
    telehash.listen( name, function( MSG ){
        var msg_sig = MSG.guid + MSG.from
        if(!chatCache[msg_sig]){
            if( MSG.message.x){
                if( MSG.message.x == 'join' ) console.log(MSG.from, " [JOINED] as "+MSG.message.nick);
                if( MSG.message.x == 'leave' ) console.log(MSG.from, " [LEFT THE CHAT] <"+MSG.message.nick+">");
            }else{
                if( MSG.message.txt) console.log("<" + (MSG.message.nick? MSG.message.nick : MSG.from) + ">: " + MSG.message.txt);
            }
            chatCache[msg_sig] = true;
            
        }
    });
        
    stdin.on('data', function(chunk){
        if(chunk.length > 1 ){
            connector.send( {txt:chunk, nick:nickName} );
        }
    });
    
    console.log("Joining chat room: "+ name+" as " + nickName);
    connector.send({x:'join', nick:nickName});            
}

//cant catch SIGINT signals on windows!
if(process.platform!='win32'){
    process.on('SIGINT', function() {
        console.log("Use Control-D to exit.");
    });
}

stdin.on('end', function () {
    if(this.exiting) return;
    this.exiting = true;
    if(connector) connector.send({x:'leave', nick:nickName});
    setTimeout(function(){
        telehash.shutdown();
        process.exit(0);
    },500);
});
