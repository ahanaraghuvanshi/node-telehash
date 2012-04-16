var telehash = require("./telehash");
var hlib = require("./hash");

telehash.init({mode:2});
telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    connect("echo.message.back");
});

function connect(name) {

    var connector = telehash.connect( name );
    
    connector.send("TeleHash Rocks!", 20, function ( obj ) {
        if( obj ){
           console.log("Reply #"+ obj.count+" MESSAGE: ", obj.telex['+message'], "from:", obj.s.ipp);
        }else{        
           console.log("Reply TIMEOUT!");
        }
    });   
    
}
