var telehash = require("./telehash");
var hlib = require("./hash");

telehash.seed( function(err){
        if ( err ){
                console.log(err);
                return;
	}
	connect("echo.message.back");
});

function connect(name){
	telehash.connect({id:name, message:'telehash rocks!'}, function(s,telex){			
		
        //we got a direct data telex back. We can send telexes back now with telehash.send(s.ipp, {...});
		if(telex['message'])  console.log("Reply MESSAGE: ", telex['message'],"from:",s.ipp );

        //we are behind an SNAT so we get a relayed telex back.. we need to negotiate another way to connect
        //STUN,TURN, ICE... or roll our own?
   		if(telex['+message']) console.log("Reply MESSAGE: ", telex['+message'],"relay from:",s.ipp );

	});
}

