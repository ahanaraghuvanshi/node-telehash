## TeleHash v1

TeleHash is a new wire protocol for exchanging JSON in a **real-time** and fully decentralized manner, enabling applications to connect directly and **participate as servers** on the edge of the network.
It is designed to **efficiently route and distribute** small bits of data in order for applications to **discover each other** directly or in relation to events around piece of shared content.
The core benefits of TeleHash over other similar platforms and protocols is that it is both generic (not tied to any specific application or content structures) and is **radically decentralized** with **no servers or points of central control.**

This work is a continuation of [Jeremie Miller's] (https://github.com/quartzjer/node-telehash) early implementation of the telehash protocol v1 spec.
v1 is incompatible with the latest version of the spec at [telehash.org](http://telehash.org)

## nodejs module

    npm install get-telehash

## Getting started
Selecting the **version** of the protocol:

    var telehash = require("get-telehash").v1.telehash;

First optional step is to **initialise** the telehash module:

    telehash.init({
        mode: 2,    /* 1 = Announcer,  2 = Listener,  3 = Fully Functional */
        seeds: ["178.79.135.146:42424", "178.79.135.146:42425"],
        udplib: "enet", /* enet or node */
        broadcastMode: false,
        respondToBroadcasts: false
    });

If you skip this step, the module will automatically initialise itself with the default settings shown above.

Next you have to **seed** into the DHT:

    telehash.seed( function(err){
        if(err){ 
            //if err == 'timeout' - seeding timed out
        }else{
            //connected we can now send and receive telexes.
        }
    });

telehash will continue to try to seed until it succeeds. (even after the 10 second timeout occurs)

## Low-Level Switch functions

`dial()`, `announce()`, `tap()` and `send()` are the building blocks to using the telehash protocol.

### telehash.dial( end_name )
Dial once to find the closest switches to that end_name.

    telehash.dial( '@telehash' );

### telehash.announce(end_name, signals )
Send signals into the network aimed at the end_name.

    telehash.announce( '@telehash', {'+foo':'abcd'} );


### telehsh.tap(end_name, rule, callback )
Send a .tap request to the switches closest to end_name for signals expressed in a single rule object.
When switches forward telexes to our switch matching the tap rule the callback function is fired passing a copy of 
the telex and the switch (sw) which forwarded the telex.

    telehash.tap( '@telehash', {
        "is":{
            "+end":"18a8912b4cf128..."
        },
        "has":["+wall"]
    }, function(sw,telex){} )


### telehash.send(to, telex)
To send a telex directly to a switch given by it's ip and port.

    telehash.send('208.68.164.253:42424', {'+end':'1a2b3c...'} );


[wall.js](https://github.com/mnaamani/node-telehash/blob/master/examples/wall.js) has a detailed example of using all the functions.

## Simple Request/Response API
`listen()` and `connect()` can be used to for simple request/response message exchange. 
Exchanged messages (string or JSON) must be small enough to fit in a single telex, and there is no guarantee of delivery.

### telehash.listen( end_name, callback )

    telehash.listen('echo', function (request) {
        console.log(request.message);
    });


This will actively wait for any connect requests sent to the provided id 'echo'. 
For each incoming request the callback is called with a **request** object:

    {
      guid:    "9S13NyQoGt1",    // the +connect signal from underlying telex
      message: "TeleHash Rocks!" // the +message signal 
      from:    "cbfd90dd186722e1aa9a73d7a20f5af5562d5f80" //the +from signal
      source:  "208.68.163.247:42424" //the ip:port of the relaying switch
      reply:   function(message){..} // for replying to the sender of the telex
    }

To send a response:

    request.reply('It sure does!');

See [listen.js](https://github.com/mnaamani/node-telehash/blob/master/examples/listen.js) for a detailed example.


### telehash.connect(end_name, [discard_response] )
`connect()` will return a connector object. In the background the connector will use the DHT to
find anyone listening for the end_name.

    var connector = telehash.connect( 'echo', false );

### connector.send( message, [callback, timeout_s] )

Using the connector's send function we can then send actual messages to those listeners. 
Replies will fire the callback function, with a response object. 
    
    connector.send( 'TeleHash Rocks!', function(response){
        console.log( response.message );
    });

The send function takes optional callback function and timeout parameters. 
Responses must arrive within the specified timeout_s (seconds) (or default 10 seconds) period or they will get discarded. 
The callback will always be fired after timeout period expires with an empty (undefined) reponse object.

The response object will look like:

    {
        from:     '212.13.155.60:5432',   // ip:port of the relaying switch
        message:  'It sure does!',   // the +message signal in the underlying telex
        count:    3  // total reponses recived so far
    }
    
See [connect.js](https://github.com/mnaamani/node-telehash/blob/master/examples/connect.js) for a detailed example.

### Links
[Kademlia DHT] (http://en.wikipedia.org/wiki/Kademlia)

[NAT] (http://en.wikipedia.org/wiki/Network_address_translation)

