var telehash = require("../indexd.js").v1.telehash;

telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }
    server("echo.message.back");
});

function server(name) {
    telehash.listen(name, function ( conn ) {
            console.log("<<-- MESSAGE:", conn.message, " from:", conn.from, " via:", conn.source );
            conn.reply( "I Agree, '"+conn.message+"'" );
        }
    );
}
