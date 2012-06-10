var telehash = require("telehash");
var otrchan = require("./otrchannel.js");

var chatCache = {};
var connector;
var local_id = "alice";
var remote_id = "bob";

var ALLOW_NEW_RELATIONSHIPS = true;

var stdin = process.openStdin();
stdin.setEncoding("UTF-8");

//throw away output to stderr - required nodejs v0.6+
process.__defineGetter__('stderr', function() {
    return {write:function(){}};
});
 
if( !process.argv[2] && !process.argv[3]) {
    console.log("Usage: node otrchat.js local_id remote_id\n");
    process.exit();
}

local_id = process.argv[2];
remote_id = process.argv[3];

var self = otrchan.makeUser({
    keys: "./keys/"+local_id+".keys",
    fingerprints: "./keys/"+local_id+".fp",
    name: local_id
});

var remote_party = self.makeOTRChannel(local_id+"@telechat.org","telechat",remote_id,{
            onInject: function(msg){
                if(connector) connector.send({txt:msg});                
            },
            onGetSecret:function(question){
                return "SECRET";
            },
            onNewFingerpint:function(ctx){
                if(ALLOW_NEW_RELATIONSHIPS) return;
                console.log("Abandoining Session");                
                ctx.close();
                shutdown();
            },
            onSecure:function(ctx){
                if(ctx.trust!="smp" && ALLOW_NEW_RELATIONSHIPS ){
                    console.log("Initiating SMP");                     
                    ctx.initSMP(); //if we want to establish new trust relationship
                }else {
                    if(ctx.trust!="smp"){console.log("Abandoning Session");ctx.close();shutdown();return;}
                    console.log("Connection Secure and Authenticated...");
                }
            },
            onDisconnected:function(ctx){
                    console.log("Abandoining Session");
                    ctx.close();
                    shutdown();    
            },
            onInsecure:function(ctx){
                console.log("!!! Insecure Connection !!!");
            },
            onSMPComplete:function(ctx){
                console.log("SMP Complete :)");
            },
            onSMPFailed:function(ctx){
                console.log("SMP Failed!");
                console.log("Abandoining Session");
                ctx.close();
                shutdown();
            },
            onSMPAborted:function(ctx){
                console.log("SMP Aborted.. trying again");
                setTimeout(function(){ctx.initSMP();},Math.random()*5000);
            }
});

stdin.on('data', function(chunk){
        if(chunk.length > 1 ){
            if(connector) {
                if(chunk=="!smp!\n"){
                        remote_party.initSMP();
                        return;
                 }
                 if(chunk=="?trust?\n"){
                        console.log("trust=",remote_party.trust);
                        return;
                 }
                if(chunk=="?encrypted?\n"){
                        console.log("channel is",(remote_party.msgstate==1)?"encrypted":"not encrypted!");
                        return;
                 }
               remote_party.send(chunk);
            }
        }
});
 
    
telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    chat( local_id,remote_id );
});

function chat(me,friend) {
    connector = telehash.connect( "OTR:"+friend+":"+me, true );
          
    telehash.listen( "OTR:"+me+":"+friend, function( MSG ){
        var msg_sig = MSG.guid + MSG.message;
        if(!chatCache[msg_sig]){
            chatCache[msg_sig] = true;
            //console.log("RAW: <<-",MSG.message.txt);
            remote_party.recv(MSG.message.txt);
        }
    });
    
   
}
var initInterval = setInterval(function(){
    if(remote_party.msgstate!=1) {
        remote_party.connect();
        return;
    }
    clearInterval(initInterval);
},1000);
//cant catch SIGINT signals on windows!
if(process.platform!='win32'){
    process.on('SIGINT', function() {
        console.log("Use Control-D to exit.");
    });
}

stdin.on('end', shutdown );

function shutdown(){
    if(this.exiting) return;
    this.exiting = true;    
    remote_party.close();
    setTimeout(function(){        
        telehash.shutdown();
        process.exit(0);
    },500);
}
