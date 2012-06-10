var otr=require("otr");

exports.makeUser = makeUser;

var ActiveConnections = {};

function makeUser(conf){
    var user = new otr.User();
    user.conf = conf;
    user.name = conf.name;
    init(user);
    return user;
}

function cuid(o){
    return (o.accountname+":"+o.protocol+">"+o.username);
}

function getConnCtx( user, accountname, protocol, recipient ){
    var id = cuid({
        accountname: accountname,
        protocol: protocol,
        username: recipient
    });
    if( !ActiveConnections[id] ){     
        ActiveConnections[id]=new otr.ConnContext(user,accountname,protocol,recipient);
    }
    return ActiveConnections[id];
}

function makeOps(user){
    user.ops = new otr.MessageOps( newEventHandler(user) );
}

function init(user){    
    makeOps(user);
    user.readKeysSync(user.conf.keys);
    user.readFingerprintsSync(user.conf.fingerprints);
    user.makeOTRChannel = function(accountname,protocol,remote_party,callbacks){    
        var ctx = getConnCtx( user, accountname, protocol, remote_party );        
        ctx.callbacks = callbacks;
        ctx.connect = function(){
            ctx.send("?OTRv2?");
        };
        ctx.send = function(message){
            return SendMessage(user, ctx, message);
        };
        ctx.recv = function(message){
            var msg = user.ops.messageReceiving(user, accountname, protocol, remote_party, message);
            if(msg) console.log("<<", msg);
        };
        ctx.close = function(){
            user.ops.disconnect(user,accountname,protocol,remote_party);
        };
        ctx.initSMP= function(){
                user.ops.initSMP(user, ctx, ctx.callbacks.onGetSecret());
        };
        return ctx;
    };
}

function SendMessage(from, ctx, message){
  if( from && from.ops ){
    var msgout, err;
    msgout = from.ops.messageSending(from, ctx.accountname, ctx.protocol, ctx.username, message);
    if(msgout){
       err=from.ops.fragmentAndSend(ctx,msgout);
       return err;       
    }
  }
}

function newEventHandler(user){
  return (function( o ){
    //console.log(o.EVENT);
    var ctx;
    switch(o.EVENT){
        case "smp_request":
            ctx = getConnCtx(user,o.accountname,o.protocol,o.username);         
            if(ctx.callbacks.onGetSecret) user.ops.respondSMP(user, ctx , ctx.callbacks.onGetSecret());
            return;
        case "smp_complete":
            ctx = getConnCtx(user,o.accountname,o.protocol,o.username);
            if(ctx.callbacks.onSMPComplete) ctx.callbacks.onSMPComplete(ctx);            
            return;
        case "smp_failed":
            ctx = getConnCtx(user,o.accountname,o.protocol,o.username);
            if(ctx.callbacks.onSMPFailed) ctx.callbacks.onSMPFailed(ctx);
            return;
        case "smp_aborted":
            ctx = getConnCtx(user,o.accountname,o.protocol,o.username);
            if(ctx.callbacks.onSMPAborted) ctx.callbacks.onSMPAborted(ctx);
            return;
        case "display_otr_message":
            console.log("OTR MESSAGE:",o.message);
        case "is_logged_in":
            return 1;

        case "gone_secure":
            //console.log("SECURE:",o.context);
            /*if(o.context.trust!="smp"){
                setTimeout(function(){
                    var ctx = getConnCtx(user,o.context.accountname,o.context.protocol,o.context.username);
                    user.ops.initSMP(user, ctx, ctx.callbacks.onGetSecret());
                },Math.random()*300);//try to prevent both sides initiating SMP at same time..
            }else{
                ctx = getConnCtx(user,o.accountname,o.protocol,o.username);
                if(ctx.callbacks.onSecure) ctx.callbacks.onSecure();
            }
            */
            ctx = getConnCtx(user,o.accountname,o.protocol,o.username);
            if(ctx.callbacks.onSecure) ctx.callbacks.onSecure(ctx);
            return;

        case "gone_insecure":
            console.log("INSECURE!:",o.context);
            ctx = getConnCtx(user,o.accountname,o.protocol,o.username);
            if(ctx.callbacks.onInsecure) ctx.callbacks.onInsecure(ctx);
            return;
        case "remote_disconnected":
            console.log("Remote Disconnected!");
            ctx = getConnCtx(user,o.accountname,o.protocol,o.username);
            if(ctx.callbacks.onDisconnected) ctx.callbacks.onDisconnected(ctx);
            return;
        case "policy":
            //console.log(o.context);          
            //if(user.name=="alice") return 55; //OTRL_POLICY_DEFAULT == OTRL_POLICY_OPPORTUNISTIC
            //if(user.name=="bob") return 59; //OTRL_POLICY_ALWAYS                       
            return 59;

        case "update_context_list":
            //console.log("update_context_list");
            //console.log("msgstate:",alice_connection.msgstate);
            //console.log(users[user.name].conn.msgstate);
            return;
        case "max_message_size":            
            return 1300;//telehash

        case "inject_message":
            getConnCtx(user,o.accountname,o.protocol,o.username).callbacks.onInject(o.message);            
            return;
        case "create_privkey":
            console.log(user.name," doesn't have a private key for account:",o.accountname,o.protocol);
            return;
        case "notify":
            //console.log(o.title,o.primary,o.secondary);
            console.log("NOTIFY MESSAGE:",o.title,o.primary);
            return;
        case "new_fingerprint":
            console.log("New Fingerprint for:",o.username, o.accountname,o.protocol,o.fingerprint);
            ctx = getConnCtx(user,o.accountname,o.protocol,o.username);
            if(ctx.callbacks.onNewFingerprint) ctx.callbacks.onNewFingerprint(ctx);
            return;
        case "write_fingerprints":
            writeFingerprints(user);
            return;
        case "still_secure":
            console.log("Secure Connection Reestablished!");
            return;
        default:
            console.log("Unhandled Event:",o.EVENT);
            return;
    }
  });
};

function readKeys(user,cb){
    var conf = user.conf;
	user.readKeys(conf.keys,function(err){
		if(!err){

		}else{ console.log(err); }
        if(cb) cb(user);
	});
}

function readFingerprints(user,cb){
    user.readFingerprintsSync(user.conf.fingerprints,function(){
        if(cb) cb(user);
    });
}
function writeFingerprints(user,cb){
    console.log(user.name,"Writing fingerprints..."); 
    user.writeFingerprintsSync(user.conf.fingerprints,function(){
        if(cb) cb(user);
    });
}






