var dgram = require('dgram');
var slib = require('./switch');
var hlib = require('./hash');
var util = require('./util');

// high level exported functions

// init({port:42424, seeds:['1.2.3.4:5678]}) - pass in custom settings other than defaults, optional but if used must be called first!
exports.init = getSelf;

// seed(function(err){}) - will start seeding to dht, calls back w/ error/timeout or after first contact
exports.seed = doSeed;

// listen({id:'asdf'}, function(telex){}) - give an id to listen to on the dHT, callback fires whenever incoming telexes arrive to it, should seed() first for best karma!
exports.listen = doListen;

// connect({id:'asdf', ...}, function(telex){}) - id to connect to, other data is sent along
exports.connect = doConnect;

// send('ip:port', {...}) - sends the given telex to the target ip:port, will attempt to find it and punch through any NATs, etc, but is lossy, no guarantees/confirmations
exports.send = doSend;

// as expected
exports.shutdown = doShutdown;

// internals

var self;
var listeners = [];
var connectors = {};

/*
   STATE.offline: initial state
   STATE.seeding: only handle packets from seeds to determine our ip:port and NAT type
   STATE.online: full packet processing
   TODO:add callbacks to inform user of the module when switching between states..
*/
var STATE = {offline:0, seeding:1, online:2};


// init self, use this whenever it may not be init'd yet to be safe
function getSelf(arg)
{
    if(self) return self;
    self = arg || {};

    self.state = STATE.offline;	//start in offline state

    if(!self.seeds) self.seeds = ['164.40.143.34:42424','208.68.163.247:42424']; 

    // udp socket
    self.server = dgram.createSocket("udp4", incomingDgram);

    // If bind port is not specified, pick a random open port.
    self.server.bind(self.port ? parseInt(self.port) : 0, self.ip || '0.0.0.0');    

    // set up switch master callbacks
    slib.setCallbacks({data:doData, sock:self.server, news:doNews, behindNAT:behindNAT, behindSNAT:behindSNAT});

    // start timer to monitor all switches and drop any over thresholds and not in buckets
    self.scanTimeout = setInterval(scan, 25000); // every 25sec, so that it runs 2x in <60 (if behind a NAT to keep mappings alive)

    self.connect_listen_Interval = setInterval(connect_listen,10000);

    return self;
}

function behindNAT(){
	return (self.nat == true || self.snat == true);
}
function behindSNAT(){
	return (self.snat == true);
}


function resetIdentity(){
    if( self.me ) {
	self.me.purge();
    }
    delete self.me;
    listeners = [];
    connectors= {};
    delete self.nat;
    delete self.snat;
}

function doSeed(callback)
{

    if(!self) {
	getSelf();
    }

    //we can only seed into DHT when we are offline.
    if(self.state != STATE.offline){
	return;
    }
    //reset our identity
    resetIdentity();

    console.log("Seeding..");
    self.state = STATE.seeding;

    if( callback ) self.onSeeded = callback;

    // in 10 seconds, error out if nothing yet!
    self.seedTimeout = setTimeout(function(){
	self.state = STATE.offline;//go back into offline state
        if(self.onSeeded) self.onSeeded("timeout");
        delete self.seedTimeout;
	purgeSeeds();
        //try again...
	doSeed( callback );
    }, 10000);
    
    pingSeeds();
}
function purgeSeeds(){
    self.seeds.forEach(function(ipp){
      	slib.getSwitch(ipp).purge();	
    });
}
function pingSeeds(){
    // loop all seeds, asking for furthest end from them to get the most diverse responses!
    self.seeds.forEach(function(ipp){
	var hash = new hlib.Hash(ipp);
	var s = slib.getSwitch(ipp);
	s.seed = true;	//mark it as a seed - (during scan check if we have lines open to any initial seeds)
	s.popped = true;
	s.send( {'+end':hash.far()} );
    });
}

//filter incoming packets based on STATE
function incomingDgram(msg,rinfo){

	if( self.state == STATE.offline ) {
		//drop all packets
		return;
	}
	//who is it from?
    	var from = rinfo.address + ":" + rinfo.port;
	
	//parse the packet..and handle out-of-band packets..
	try {
	        var telex = JSON.parse(msg.toString());

	} catch(E) {
		//out of band data non JSON.
		if(self.handleOOB) self.handleOOB(msg,rinfo);
		return;
	}
	if(telex['_OOB']){
		//JSON formatted out of band data:
		if(self.handleOOB) self.handleOOB(msg,rinfo);
		return;	
	}

	//at this point we should have a telex
	console.error("<--\t"+from+"\t"+msg.toString());

	if( self.state == STATE.seeding ){
		//only accept packets from seeds - note: we need at least 2 live seeds for SNAT detection
		for(var i in self.seeds){
			if(from==self.seeds[i]){
				 handleSeedTelex(telex,from,msg.length); break;
			}
		}
		return;
	}
	if( self.state == STATE.online ){	
		//process all packets
		handleTelex(telex,from,msg.length);
	}
}
function handleSeedTelex(telex,from,len){

    //do NAT detection once
    if(!self.me && telex._to && !util.isLocalIP(telex._to) ) {
	//we are behind NAT
	self.nat = true;
	console.log("NAT Detected!");
    }

    //first telex from seed will establish our identity
    if(!self.me && telex._to) {
        self.me = slib.getSwitch(telex._to);
        self.me.self = true; // flag switch to not send to itself
	clearTimeout(self.seedTimeout);
        delete self.seedTimeout;
	doPopTap();//only needed if we are behind NAT
	//delay...to allow time for SNAT detection (we need a response from another seed)
	setTimeout( function(){
		self.state = STATE.online;
		pingSeeds();	
		console.log("GOING ONLINE");
	        if(self.onSeeded) self.onSeeded();	        
	},2000);
    }
	
    if( self.me && from == self.me.ipp ){
	console.log("Self Seeding...");
	self.seed = true;
    }

    if(telex._to && self.me && !self.snat && (util.IP(telex._to) == self.me.ip) && (self.me.ipp !== telex._to) ) {
	//we are behind symmetric NAT
	console.log("Symmetric NAT detected!", JSON.stringify(telex),"from:",from );
	self.snat=true;
	self.nat=true;
   }
   
   delete slib.getSwitch(from).misses;//since we are not processing the telex fully dont count misses
}

function handleTelex(telex, from, len)
{
    if( self.me && from == self.me.ipp ) return;//dont process packets that claim to be from us!

    if( telex['.pop'] ) {
	//TODO:someone just popped their firewall.. if we tried to contact them we might have to _ring them again
	return;
    }

    //must have a _to header in telex
    if( telex._to ){
	if( self.snat ){
		//_to will not match self.me.ipp because we are behind SNAT but at least ip should match
		if( self.me.ip != utils.IP(telex._to)) return;
	}else{
		//_to must equal our ipp
		if( self.me.ipp != telex._to ) return;
	}

    }else {
	//bad telex!
	return;
    }

    //incoming telexes should have a _line or _ring header
    //if a line exists we should already know them..
    if( telex._line ) {    
	if(!slib.knownSwitch(from)) return;
    }else{
	if(!telex._ring) return; //not even a ring.. bad telex
    }

    slib.getSwitch(from).process(telex, len);
}

// process a validated telex that has data, commands, etc to be handled
function doData(from, telex)
{
    //console.log("GOT DATA telex:" + JSON.stringify(telex));
	
    if(telex['+connect'] ){
	  //handle incoming +connections
	  listeners.forEach( function(listener){
		if(listener.end == telex['+end']){
			console.log("Found matching LISTENER");
			if(listener.cb) {
				console.log("CALLBACK() for listener.");
				listener.cb( from, telex );
			}
		}
	  });
	  
	  //this would be a reponse to our outgoing +connect
	for(var id in connectors){	  
	  if( id == telex['+connect']) {
		console.log("Found matching CONNECTOR");
		connectors[id].callback( from, telex );
		delete connectors[id];
		return;
	  }	 
	}
    }
}

function sendPOPRequest(ipp){
	if(self.snat) return;//pointless
	
	var hash = new hlib.Hash(ipp);
	slib.getNear(hash).forEach(function(s){
	  if(self.me) {
		slib.getSwitch(s).send({'+end':hash.toString(), '+pop':'th:'+self.me.ipp});
		console.log("Sending +pop request to:",ipp," via:", s);
	   }
	});
}

function doNews(s)
{
   //new .seen switch	

   if(self.snat){
	s.send({'+end':self.me.end}); //ping the new switch
	s.popped = true;
	return;
   }

   //send a +pop to s.via? since it most likely has a line open with the switch we have just .seen
   //informig the switch we wish to connect to to open its firewall to allow us through
   //slib.getSwitch(s.via).send({'+end':s.end, '+pop':'th:'+self.me.ipp});
   sendPOPRequest(s.ipp);
   s.popped = true;

/*
   //allow about 2s for new switch to pop its firewall before we ping it.
   setTimeout(function(){
	   if(self.me) {
		s.send({'+end':self.me.end});
		
	   }
   },2000);
*/

   // TODO if we're actively listening, and this is closest yet, ask it immediately
}

function doPopTap(){
    if( self.nat ) {
      console.error("Tapping +POPs...");
      listeners.push( {hash:self.me.hash, end:self.me.end, rule:{'is':{'+end':self.me.end}, 'has':['+pop']}} );
      //setTimeout( sendTapRequests, 2000);
      //sendTapRequests();
      //send out tap requests as soon as possible after seeding to make sure we capture +pop signals early
      //allow at least initial telexes from seeds to be processed before sending out taps
    }
}

function doFarListen(arg, callback)
{
  //this is a hack for when we are behind a symmetric NAT we will .tap for our +end near 
  //the switches we are trying to +connect to. so they can reply back to us through a telex relay

  var end = new hlib.Hash(arg.id);//end we are tapping for
  var hash = new hlib.Hash(arg.connect);//where we will .tap
  var rule = {'is':{'+end':end.toString()}, 'has':['+connect']};	
  var listener = {id:arg.id, hash:hash, end:end.toString(),  rule:rule, cb:callback};
  listeners.push( listener );
  console.log("DOING FAR LISTEN");
  return listener;
}

function doListen(arg, callback)
{
    //add a listener for arg.id 
    var hash = new hlib.Hash(arg.id);
    var rule = {'is':{'+end':hash.toString()}, 'has':['+connect']};	
    var listener = {id:arg.id, hash:hash, end:hash.toString(),  rule:rule, cb:callback};
    listeners.push( listener );
    console.error("ADDED LISTENER");
    return listener;
}

function listenLoop(){

   var count = 0; 
   //look for closer switches
   listeners.forEach( function(listener){
     count++;
     console.log(count+":LISTENER:"+JSON.stringify(listener.rule));
     //if(self.me && self.me.end == listener.end ) return;//should allow if we are behind symmetric NAT -- will help
     slib.getNear( listener.hash ).forEach( function(ipp){	
	doSend(ipp, {'+end':listener.end});
     });	
   });

   sendTapRequests();
}

function sendTapRequests(){
   
   var tapRequests = {}; //hash of .tap arrays indexed by switch.ipp 
   listeners.forEach( function( listener ){
	var switches = slib.getNear( listener.hash );
	switches.forEach( function(s){
		if(!tapRequests[s]) tapRequests[s]=[];
		tapRequests[s].push( listener.rule );		
	});
	
   });
   Object.keys(tapRequests).forEach(function(ipp){
	if( !slib.getSwitch(ipp).line) return;
	doSend(ipp, {'.tap':tapRequests[ipp]});
   });
}


function doConnect(arg, callback)
{    
	//TODO disconnect: by id
	var id = Date.now().toString();//TODO add a sequence # to the end. to ensure unique id if many connects happen in short period of time
	var connector = {end:new hlib.Hash(arg.id), id:id, callback:callback, arg:arg};
	connectors[id]=connector;

	//helper if we are behind symmetric NAT
	//also needed if both switches behind same NAT but we can't know this at this stage so we will do it by default..
	//if(self.snat) {
		doFarListen({id:self.me.ipp, connect:arg.id}, undefined);
	//}
	console.log("ADDED CONNECTOR");
	return id; //for disconnecting
}

function connectLoop()
{
   // dial the end continuously, timer to re-dial closest, wait forever for response and call back   
   for(var id in connectors){
        var switches = slib.getNear( connectors[id].end );
	console.error("CONNECTOR:"+connectors[id].id);
	switches.forEach( function(s){	
		doSend(s,{'+end':connectors[id].end.toString(),
			  '+connect':connectors[id].id,
			  'from':self.me.ipp,
			  'message':connectors[id].arg.message});
	});
   }
}

function doSend(to, telex)
{   

   //dont send to ip if it matches our's unless it is a local interface
   //if a NAT/firewall supports 'hair-pinning' we can allow this..
   if( behindNAT() ){	
	if(self.me && util.isSameIP(self.me.ipp, to) ) return;	
	if(behindSNAT()){
		telex._snat = 1;//tag our telexes with a _snat header
	}
    }

    var s = slib.getSwitch(to);
	
    if( s.via || s.seed ){
	//this switch has been '.see'n or is a seed should already be popped
	if(s.popped || self.snat ) s.send(telex);
		
    }else{
	//switch not learned from .see .. 
	//either it connected to us directly or we are trying to connect to it directly
	if(s.popped || self.snat ) {
		s.send(telex);
	}else{
		//we need to +pop it, first time connecting..		
		sendPOPRequest(to);
		s.popped = true;
		setTimeout(function(){		  
		  s.send(telex);
	       },2000);
	}
    }

}

function doShutdown()
{
    clearTimeout(self.scanTimeout);
    clearInterval(self.connect_listen_Interval);
    if(self.seedTimeout) {
        self.seeding("shutdown"); // a callback still waiting?!
        delete self.seedTimeout;        
    }
    // drop all switches
    slib.getSwitches().forEach(function(s){ s.purge() });
    self.server.close();
    self = undefined;
}

function connect_listen(){
   if( self.state ) {
	   if( self.state != STATE.online) return;
	   console.log("Connect/Listen Loop");
	   listenLoop();
	   connectLoop();
   }
}

// scan all known switches regularly to keep a good network map alive and trim the rest
function scan()
{
    if( self.state != STATE.online ) return;

    if (!this.count) this.count=1;

    var all = slib.getSwitches();
    console.log("--scan loop: " + this.count++);

    // first just cull any not healthy, easy enough
    all.forEach(function(s){
        if(!s.healthy()) s.drop();
    });

    all = slib.getSwitches();

    all.forEach(function(s){
	if(s.self) return;
        console.log("switch:"+s.ipp + " popped="+ s.popped + " line="+s.line+" BR=" + s.BR +" BSent="+s.Bsent+" misses="+s.misses+" healthy="+s.healthy());
    });
     
    // if only us or nobody around, and we were seeded at one point, try again!
    // unless we are the seed..
/*
    if(all.length <= 1 && self.seeding && !self.seedTimeout && !self.seed )
    {	
        //delete self.seeding;
        if(self.me) self.me.purge(); // this will be stale if offline
        delete self.me;
	listeners = [];
	connectors= {};
	clearInterval(self.connect_listen_Interval);	
        return doSeed(self.seeding);
    }
*/
    //ping all...
    all.forEach( function(s){
	if(s.popped || self.snat ) s.send({"+end":self.me.end});
    });

    //if we lost connection to all initial seeds.. ping them all again?
    var foundSeed = false;
    all.forEach( function (s){
	if( s.seed ) foundSeed = true;
    });
    if(!foundSeed) {
        pingSeeds();
    }

    return;//TODO work on buckets later..

    // TODO overall, ping first X of each bucket
    all.sort(function(a, b){
        return self.me.hash.distanceTo(a.hash) - self.me.hash.distanceTo(b.hash);
    });

    // create array of arrays (buckets) based on distance from self (the heart of kademlia)
    var distance = self.me.hash.distanceTo(all[0].hash); // first bucket
    var buckets = [];
    var bucket = [];
    all.forEach(function(s){
        var d2 = self.me.hash.distanceTo(s.hash);
        if(d2 == distance){console.log('storing '+s.ipp+' in bucket.') ;return bucket.push(s);}
        distance = d2;
        buckets.push(bucket);
        bucket = [];
    });

    // TODO for congested buckets have a sort preference towards stable, and have a max cap and drop rest (to help avoid a form of local flooding)
    // for now, ping everyone!
    buckets.forEach(function(bucket){
        bucket.forEach(function(s){
            if(s.self) return;
	    if(Date.now() > (s.ATsent + 30000)) return; // don't need to ping if already sent them something in the last 30sec
            console.log('pinging ' +s.ipp+" ...");
	    s.send({"+end":self.me.end}); // TODO, best dht mesh balance is probably to generate a random hash this distance away, but greedy +end of us is always smart/safe
        })
    });
}

