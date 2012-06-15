var channels = require('echannels');
var otrchan = require("./otrchannel.js");

var local_id = "alice";
var remote_id = "bob";
var self;
var channel;

var ALLOW_NEW_RELATIONSHIPS = true;

var stdin = process.openStdin();
stdin.setEncoding("UTF-8");

//throw away output to stderr - required nodejs v0.6+
process.__defineGetter__('stderr', function() {
    return {write:function(){}};
});

if( !process.argv[2] && !process.argv[3]) {
    console.log("Usage: node otrtalk.js local_id remote_id\n");
    process.exit();
}

local_id = process.argv[2];
remote_id = process.argv[3];

self = otrchan.makeUser({
    keys: "./keys/"+local_id+".keys",
    fingerprints: "./keys/"+local_id+".fp",
    name: local_id
});

var remote_party = self.makeOTRChannel(local_id+"@telechat.org","telechat",remote_id,{
            onInject: function(msg){
                if(channel) channel.send( new Buffer(msg) );
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
            if(channel) {
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
               if(remote_party.msgstate == 1 && remote_party.trust=="smp") remote_party.send(chunk);
            }
        }
});


channels.init({
    //seeds: ["192.168.1.149:42424"],
    mode:2,
    ready: function () { //will be called when we are seeded    	
        connect();
    }
});


function connect() {   
    channels.listen(local_id, function(peer){onConnect(peer,local_id);});
    channels.connect(remote_id, function(peer){onConnect(peer,remote_id);});   
}

function onConnect(peer, User ) {

    //TODO QUE Incoming Connections... try and establish a secure otr link with each until successful. drop remaining in que
    //when we have an active otr link ignore all other incoming responses
 
    if(remote_party.msgstate==1) {
        //dont accept connections if we have an active session
        peer.close();
        return;
    }
    
    channel = peer;
    
    peer.data = function (msg) {
        remote_party.recv(msg.toString());
    }

    peer.disconnected = function(){
    }

    if(User == remote_id) peer.send(new Buffer("?OTRv2?"));
}



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
        channels.shutdown();
        process.exit(0);
    },500);
}


