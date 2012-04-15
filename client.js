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

//once we are seeded. we connect to switches listening for 'name' and send them a message
//expecting a response. As this connection goes is relayed over the network they may receive it multiple times
//through the various switches they are tapping. When we receive a response from the switch
//we simply log it to the console.
//The connect process is continues.  the message will be sent out multiple times/minute and equally responses 
//will arrive continiously
function connect(name) {
    telehash.connect({
        id: name,
        message: 'telehash rocks!'
    }, function (s, telex) {

       console.log("Reply MESSAGE: ", telex['+message'], "from:", s.ipp);

    });
}
