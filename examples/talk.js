var telehash = require("../index.js").v1.telehash;

var stdin = process.openStdin();
stdin.setEncoding("UTF-8");

//throw away output to stderr - required nodejs v0.6+
process.__defineGetter__('stderr', function() {
    return {write:function(){}};
});

var connector;
var chatCache = {};
var me;
var friend;

me = process.argv[2];
friend = process.argv[3];

stdin.on('data', function(chunk){
    if(chunk.length > 1 ){
        SendTxt( chunk );
    }
});

if(!me && !friend){        
    console.log("Usage: node talk @you @friend");
    process.exit();
}

telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    talk();
});

function talk(){
    console.log("connecting to:",friend);
    connector = telehash.connect( friend );
    listen(me);
    console.log("we are:",me);
    SendTxt('[CONNECTED]');
}

function listen(name) {
    telehash.listen(name, function ( obj ) {
            
            obj.reply({ack:1});//ACK the message
            
            if(!chatCache[obj.message.txt]){        
                chatCache[obj.message.txt]=1;
                console.log("<<--:", obj.message.txt);
            }
        }
    );
}
function SendTxt( txt ) {
    if(!connector) return;
    var gotResponse = false;    
    connector.send({txt:txt}, function ( obj ) {    
        if( obj ){
           if(obj.message.ack) gotResponse = true;
           if(obj.count == 1) console.log("-->>:",txt);
        }else{        
           if(!gotResponse){                      
               setTimeout(function(){SendTxt(txt);},100);
           }
        }
    },5);//timeout after 5 seconds.
}

stdin.on('end', function () {
    if(this.exiting) return;
    this.exiting = true;
    if(connector) connector.send({txt:'[DISCONNECTED]'});
    setTimeout(function(){
        telehash.shutdown();
        process.exit(0);
    },500);
});


