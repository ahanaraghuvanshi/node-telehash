var fs = require('fs');
var crypto = require('crypto');

var dhPrimeHex_4096='ba4189c9e62c9d2334ff536057ee226ab08666c40b78c359c0f74d968eda119ff0b71f7c271fe7d6fc31a5c478816898e1cb45814e7d522ef5cc976452626a713d029539a7b658e2b6efadfb7345b5c22f679ab72537fd5ea4ac9994dbf453697a21aee1f70744f6f1274cdcece2cb38b69ed1c604cb1513b70e4698642e727f90b1f0ae8a9c4a4d8751aef7eee8da35d2f75f6cf8ecdb3e7aa9257708d7f7264b3896837efdaaf64a251aec303e0f57032f2ba233cae77deb7ade0795c981d982a36eb073a0528c2fc1c666759a273eac5d1c4eec4240abc187df2329277d787fb12d068f2e87451eeaf4dd83c2c3e120be3e54f2ed8426dc1fddd3009be5e64a6ccca5a0c6c8394ca2c57f578abc36bf00a9ad82586ee98567938f1862c38a939e5005a4e6d69dd19bcecde98aea328c965ffff5341246bb83c0846db9e8806420aac7880f0d961149e430316e17ec1131bbc71c856430da1fb46769bfc5a00be1bcc1f902a748b91d8c8174022138bd4d42baaef4f588feb3e4c04c71fd68d07c1bd2a122840f2704477c4cffd160133a41b4f93a7bcc8aa1f9995bfac4449bbd1b715ebe37eb85f3374ce5f4a390e9bf650e26f6323e97b72dcf49ccf1be38d494683943222d6ef334ed672bb1bb58ce5f5ba2d687c25336961d38376b2b32b79d2b2a6b56158c9df5a728865c8d3008a8c58d7fa239aac66ac876698733';

exports.incoming = incoming;
exports.outgoing = outgoing;


function generate_secure_link_object(callback,peer,K,remoteID){

    var slo = {
        peerid:remoteID,
        data:function(){},
        send:function(msg){
            peer.send( encryptbuf(msg,K) );
        }
    };
    peer.data = function(msg){
        if(slo.data) slo.data( decryptbuf(msg,K) );
    };

    callback({link:slo});
}
// takes a peer object with .send() and .data() methods used to communicate on a channel.
// will setup a secure channel using DH-STS (http://en.wikipedia.org/wiki/Station-to-Station_protocol)
// return a secure_peer object by callback with .send() and .data() functions used to communicate securely
// once the secure link is setup.
function outgoing(LINK,peer,remoteID){
    console.log("SECURE-LINK: Starting OUTGOING Negotiation");    
    var dh = crypto.createDiffieHellman(dhPrimeHex_4096,'hex');
    var P = dh.generateKeys('base64');
    var packet1 = {p:P,id:LINK.self.id};
       
    peer.send( new Buffer(JSON.stringify(packet1)));    
    
    var replyTimeout = setTimeout(function(){
        //no reply packet received..
        console.log("SECURE-LINK: no response to packet 1!");
        peer.data = function(){};        
        peer.close();        
        LINK.callback({error:'timeout'});
    },8000);
    
    peer.data = function(msg){
        clearTimeout(replyTimeout);
        try {
            var packet2 = JSON.parse( msg.toString() );
            if(packet2.p && packet2.s){
                //if valid signature compute K and reply with packet 3, else stop (callback null)
                var K = dh.computeSecret(packet2.p,'base64','binary');
                var authentic = verify(packet2.p+P, decrypt(packet2.s,K), fs.readFileSync(LINK.peers[remoteID].key,'ascii'));
                if( authentic ){
                    var packet3 = {s:encrypt(sign(P+packet2.p, fs.readFileSync(LINK.self.key,'ascii')),K)};
                    peer.send(new Buffer(JSON.stringify(packet3)));                                        
                    generate_secure_link_object(LINK.callback,peer,K,remoteID);
                    return;                    
                }else{
                    console.log("SECURE-LINK: SIGNATURE FAILED");
                }                
            }else{
                console.log("SECURE-LINK: INVALID PACKET");
            }            
            
        } catch (e){
            //invalid packet..
            console.log("SECURE-LINK: ",e);
        }
        //abandon the session negotiation!
        peer.data = function(){};
        peer.close();
        LINK.callback({error:'failed'});
        return;
    };
}

function incoming(LINK,peer){
    console.log("SECURE-LINK: Starting INCOMING Negotiation");    
    //wait for packet 1
    //send response packet 2
    //wait for reply packet 3
    var dh = crypto.createDiffieHellman(dhPrimeHex_4096,'hex');
    var P = dh.generateKeys('base64');
    
    
    var initialPacketTimeout = setTimeout(function(){
        //first packet not received!
        peer.data = function(){};
        peer.close();        
        LINK.callback({error:'no-init-rcvd'});
    },8000);
    
    
    peer.data = function(msg){
        clearTimeout(initialPacketTimeout);
        try {
            var packet1 = JSON.parse( msg.toString() );
            if(packet1.p && packet1.id){
                var remoteP = packet1.p;
                var remoteID = packet1.id;
                var K = dh.computeSecret(packet1.p,'base64','binary');
                var packet2 = {s:encrypt(sign(P+packet1.p, fs.readFileSync(LINK.self.key,'ascii')),K), p:P};
                peer.send( new Buffer(JSON.stringify(packet2)));

                var replyTimeout = setTimeout(function(){
                    //no reply packet received..                    
                    peer.data=function(){};
                    peer.close();
                    LINK.callback({error:'timeout'});
                },8000);
                
                peer.data = function(msg){
                    clearTimeout(replyTimeout);
                    try{
                        var packet3 = JSON.parse( msg.toString());
                        if(packet3.s){
                            var authentic = verify(remoteP+P, decrypt(packet3.s,K), fs.readFileSync(LINK.peers[remoteID].key,'ascii'));
                            if(authentic){
                                generate_secure_link_object(LINK.callback,peer,K,remoteID);
                                return;
                            }else{
                                console.log("SECURE-LINK: SIGNATURE FAILED");  
                            }
                        }
                    }catch(e){                    
                        console.log("SECURE-LINK:",e);  
                    }
                    peer.data = function(){};
                    peer.close();
                    LINK.callback({error:'failed'});
                };
                
                return;
            }
        }catch(e){
            console.log("SECURE-LINK:",e);  
        }
        
        //abandon the session negotiation!
        peer.data = function(){};
        peer.close();
        LINK.callback({error:'failed'});
        return;
    };
}


function encryptbuf(buf,key){
    var c = crypto.createCipher('AES256', key);
    var output = c.update(buf)+c.final();
    return (new Buffer(output,'ascii'));
}

function decryptbuf(buf,key){
    var c = crypto.createDecipher('AES256', key);
    var output = c.update(buf)+c.final();
    return (new Buffer(output,'ascii'));
}

function encrypt(text,key){
    var output = "";       
    var c = crypto.createCipher('AES256', key);
    output+=c.update(text,'utf8','base64');
    output+=c.final('base64');
    return output;
}
function decrypt(text,key){
    var output = "";  
    var c = crypto.createDecipher('AES256', key);
    output+=c.update(text,'base64','utf8');
    output+=c.final('utf8');
    return output;
}

function sign(text,key){
    var signer = crypto.createSign('RSA-SHA256');
    signer.update(text);
    return signer.sign( key, 'hex');
}
function verify(text,sig,key){
    var verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(text);
    return verifier.verify(key,sig,'hex');
}


