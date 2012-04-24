var telehash = require("telehash");

telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    connect("echo.message.back");
});

function connect(name) {

    var connector = telehash.connect( name );
    var gotResponse = false;
        
    connector.send("TeleHash Rocks!", function ( obj ) {    
        if( obj ){
        
           console.log("Reply #"+ obj.count+" MESSAGE: ", obj.message, "from:", obj.from);
           gotResponse = true;
           
        }else{
        
           if(!gotResponse){        
               console.log("No Replies! :( Retrying..");
               setTimeout(function(){connect(name);},100);
           }else{
            console.log("We got our replies.. yay!");
            telehash.shutdown();
            process.exit();
           }
        }
    },5);//timeout after 5 seconds.
    
}
