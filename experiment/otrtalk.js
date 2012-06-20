var channels = require('echannels');
var libotr = require("otr");

var local_id = "alice";
var remote_id = "bob";
var self,remote,otrchan,echannel;

var stdin = process.openStdin();
stdin.setEncoding("UTF-8");

//throw away output to stderr - required nodejs v0.6+
process.__defineGetter__('stderr', function() {
    return {write:function(){}};
});

if( process.argv.length < 4) {
    console.log("Usage: node otrtalk.js local_id remote_id\n");
    process.exit();
}
local_id = process.argv[2];
remote_id = process.argv[3];

//todo check that userstate loaded successfully...
self = new libotr.User({name:local_id,keys:'./keys/'+local_id+'.keys',fingerprints:'./keys/'+local_id+'.fp'});
//check if there is a private key for account specified...
remote = self.ConnContext(local_id+"@telechat.org","telechat",remote_id);
otrchan = new libotr.OTRChannel(self, remote, {
    policy:59,
    MTU:1450,
    secret:"SECRET",
    secrets:{'question-1':'secret-1','question-2':'secret-2'},
    accept_unknown_peers:true
});

otrchan.on("shutdown",function(){
    //console.log("Shutting down Socket");
    //if(echannel) echannel.close();
});
otrchan.on("inject_message",function(msg){
    if(echannel) echannel.send( new Buffer(msg) );
});

otrchan.on("message",function(msg){
    if(this.isAuthenticated()) console.log("<< ",msg);
    else console.log("ignoring: <<",msg);
});

otrchan.on("display_otr_message",function(msg){
    console.error("[OTR]",msg);
});
otrchan.on("log_message",function(msg){
    console.error("[LOG]",msg);
});
otrchan.on("new_fingerprint",function(fp){
    console.log(this.context.username,"'s New Fingerprint:",fp);
    if(this.parameters.accept_unknown_peers) return;
    console.log("No New Peers Accepted.. Aborting.");
    this.close();
});
otrchan.on("gone_secure",function(){
    console.log("Connection Encrypted.");
    if(!this.isAuthenticated() && this.parameters.accept_unknown_peers ){
        if(echannel.initiator){
            console.log("Authenticating...");                     
            try{
                this.start_smp_question('question-1'); //if we want to establish new trust relationship
            }catch(e){
                console.error(e);
            }
        }
    }else {
        if(!this.isAuthenticated()){
            console.log("Only Previously Authenticated Peers Allowed! Abandoning Session");
            this.close();            
            return;
        }
        console.log("Peer Authenticated [Previously Known]");
    }
});
otrchan.on("still_secure",function(){
    console.log("Secure Connection Re-Established");
});
otrchan.on("remote_disconnected",function(){
    console.log("Remote Peer Disconnected. Ending Session.");
    shutdown();
});

otrchan.on("gone_insecure",function(){
    console.log("Connection INSECURE!");
    this.close();
});

otrchan.on("smp_request",function(question){
    console.log("Responding to SMP Authentication");
    if(question){
      console.log("Question=",question);
      if(this.parameters && this.parameters.secrets && this.parameters.secrets[question]){
          this.respond_smp(this.parameters.secrets[question]);
      }else{
          console.log("We don't have secret to match the incoming Question challenge");
          this.close();
      }
    }else{
      this.respond_smp();
    }
});

otrchan.on("smp_complete",function(){
    //console.log("SMP_COMPLETE");
    if(this.context.trust=="smp") {
        //we initiated the smp authentication and smp completed successfully
        console.log("Peer Authenticated.");
    }else{
        //remote end initiated smp authentication.. it successeded now its our turn..
        console.log("Authenticating..."); 
        this.start_smp();
    }    
});

otrchan.on("smp_failed",function(){
    console.log("Peer Authentication Failed!");
    this.close();
});

otrchan.on("smp_aborted",function(){
    //this generally happens if both ends try to init smp at same time..    
    console.error("SMP_ABORTED");
    return;
});

stdin.on('data', function(chunk){
        if(chunk.length > 1 ){
            if(echannel) {
                if(chunk=="!!\n"){
                        console.log("Establishing Encrypted Channel");
                        otrchan.connect();
                        return;
                 }
                if(chunk=="!smp!\n"){
                        otrchan.start_smp();
                        return;
                 }
                 if(chunk=="?trust?\n"){
                        console.log("trust=",otrchan.context.trust);
                        return;
                 }
                if(chunk=="?encrypted?\n"){
                        console.log("channel is",(otrchan.isEncrypted())?"encrypted":"not encrypted!");
                        return;
                 }
               if(otrchan.isEncrypted() && otrchan.isAuthenticated()) otrchan.send(chunk);
            }
        }
});


channels.init({
    seeds: ["172.16.200.253:42424"],
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
 
    if(otrchan.isEncrypted()) {
        //dont accept connections if we have an active session
        peer.close();
        return;
    }
    
    echannel = peer;
    
    echannel.data = function (msg) {
        otrchan.recv(msg);
    }

    echannel.disconnected = function(){        
    }
    
    console.log("PEER CONNECTED");
    if(User == remote_id ) echannel.initiator = true;
    otrchan.connect();
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
    console.log("Shuting Down");
    this.exiting = true;    
    otrchan.close();
    setTimeout(function(){        
        channels.shutdown();
        process.exit(0);
    },1000);
}


