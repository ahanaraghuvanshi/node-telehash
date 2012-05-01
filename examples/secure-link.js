var fs = require('fs');
var crypto = require('crypto');
var dhPrimeHex="";

exports.incoming = incoming;
exports.outgoing = outgoing;

init();
function init(){

    // http://svn.apache.org/repos/asf/httpd/httpd/trunk/modules/ssl/ssl_engine_dh.c
    var dhPrime = [
        0xD6, 0x7D, 0xE4, 0x40, 0xCB, 0xBB, 0xDC, 0x19, 0x36, 0xD6, 0x93, 0xD3,
        0x4A, 0xFD, 0x0A, 0xD5, 0x0C, 0x84, 0xD2, 0x39, 0xA4, 0x5F, 0x52, 0x0B,
        0xB8, 0x81, 0x74, 0xCB, 0x98, 0xBC, 0xE9, 0x51, 0x84, 0x9F, 0x91, 0x2E,
        0x63, 0x9C, 0x72, 0xFB, 0x13, 0xB4, 0xB4, 0xD7, 0x17, 0x7E, 0x16, 0xD5,
        0x5A, 0xC1, 0x79, 0xBA, 0x42, 0x0B, 0x2A, 0x29, 0xFE, 0x32, 0x4A, 0x46,
        0x7A, 0x63, 0x5E, 0x81, 0xFF, 0x59, 0x01, 0x37, 0x7B, 0xED, 0xDC, 0xFD,
        0x33, 0x16, 0x8A, 0x46, 0x1A, 0xAD, 0x3B, 0x72, 0xDA, 0xE8, 0x86, 0x00,
        0x78, 0x04, 0x5B, 0x07, 0xA7, 0xDB, 0xCA, 0x78, 0x74, 0x08, 0x7D, 0x15,
        0x10, 0xEA, 0x9F, 0xCC, 0x9D, 0xDD, 0x33, 0x05, 0x07, 0xDD, 0x62, 0xDB,
        0x88, 0xAE, 0xAA, 0x74, 0x7D, 0xE0, 0xF4, 0xD6, 0xE2, 0xBD, 0x68, 0xB0,
        0xE7, 0x39, 0x3E, 0x0F, 0x24, 0x21, 0x8E, 0xB3
    ];
    function byte2hex(d) {
        return d < 16 ? "0" + d.toString(16) : d.toString(16);
    }
    dhPrime.forEach(function(b){
        dhPrimeHex+=byte2hex(b);
    });    
}

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
    var dh = crypto.createDiffieHellman(dhPrimeHex,'hex');
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
    var dh = crypto.createDiffieHellman(dhPrimeHex,'hex');
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


