var telehash = require("./telehash");
var hlib = require("./hash");
var util = require("./util");

telehash.init({mode:2});

telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    server("echo.message.back");
});

function server(name) {
    telehash.listen({
        id: name
    }, function ( conn ) {

        console.log("<<-- MESSAGE:", conn.message );
        conn.reply( "Got your message, '"+conn.message+"'" );
       
    });
}
