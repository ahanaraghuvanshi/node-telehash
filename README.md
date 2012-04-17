# Overview - TeleHash

'TeleHash is a new wire protocol for exchanging JSON in a real-time and fully decentralized manner, enabling applications to connect directly and participate as servers on the edge of the network. It is designed to efficiently route and distribute small bits of data in order for applications to discover each other directly or in relation to events around piece of shared content. The core benefits of TeleHash over other similar platforms and protocols is that it is both generic (not tied to any specific application or content structures) and is radically decentralized with no servers or points of central control.' http://telehash.org/about.html



# Telehash Node.js module

* Based on the original code from https://github.com/quartzjer/node-telehash by Jeremie Miller.
* Everything works but it is still alpha. (excpect some API changes as we move forward)

This module provides a simple high-level API for using TeleHash. Currently it has the following basic functions:

    listen(), connect(), dial(), announce(), tap(), send()
    

## listen( {id:end_name}, callback_function )

    var telehash = require("./telehash");
    telehash.seed( function(err){
        telehash.listen({ id: 'echo' },
            function ( request ) {
                console.log(request.message);
            }
        );
    });


This will seed you into the DHT and actively wait for any connect requests sent to the provided id 'echo'. A request object 'request' is returned upon receiving a request which contains a 'message' (string or JSON object), a reply can be sent with:

    request.reply( {...} );//the reply can be a string or JSON object.


See listen.js for a detailed example.

## connect(end_name)

    var telehash = require("./telehash");
    telehash.seed( function(err){
        var connector = telehash.connect( 'echo' );      
        connector.send( 'TeleHash Rocks!', function(response){
            console.log( response.message );
        });      
    });

The connect() function will return a connector object. In the background the connector will use the DHT to find anyone listening for the end_name 'echo'. Using the connector's send function we can then send actual messages (as a sting or JSON object) to the listeners. Replies will fire the callback function, with a response object (which contains the message).

## connector.send( {...}, function(){}, timeout_seconds )

The send function takes optional callback function and timeout parameters. Responses must arrive within the timeout period or they will get discarded. The callback will always be fired after the timeout period expires with an empty (undefined) reponse object.

See connect.js for a detailed example.

## Channels Module: built on connect() and listen functions

Using the basic *connect* and *listen* functions a *channels* module is implemented to establish a peer-to-peer UDP *session/channel* between two switches.
(Current implementation uses Out-of-Band channel over the underlying switch UDP socket)

## channels.listen()

Here we initialise the channels module and once we are seeded we establish a listener for 'telehash.echo.server'. 

    var channels = require('./channels');
    channels.init({
       ready:function(){
          channels.listen("telehash.echo.server", onConnect );
       }		
    });

OnConnect(peer) will be called when a channel is sucessfully opened with a new 'peer'.

    function onConnect( peer ){
       peer.data = function(msg){
          peer.send(msg);//echo message back
       }
    }

The object peer has two methods data and send. The data() function is a callback fired when a packet arrives on the channel, and send() is used to send data on the channel to the peer. (The data exchanged is a Buffer() object)

## channels.connect()

To open a channel to a listener listening for 'telehash.echo.server' we use channels.connect():

    var channels = require('./channels');
    channels.init({
       ready:function(){
           channels.connect("telehash.echo.server", onConnect );
       }		
    });
    
    function onConnect( peer ){
       peer.data = function(msg){
          console.log( msg.toString() );
       }
       setInterval( function(){				
          peer.send( new Buffer("Hello!") ); //send a message continuously 
       },5000);
    }

Once the channel is open you could build anything ontop of it: establishing voice/video streams, exchanging files, sending emails.. anything really.
It is upto you however to implement peer trust/authentication etc. (anyone can listen for any end/hash)

see the channel-listen.js and channel-connect.js for simple examples.
see alice.js and bob.js for more advanced example which illustrates the behaviour of channels better.

Channels can only be established under certain conditions related to the type of NAT a peer is operating behind of:

    Switch A        Switch B        Channel can be established?
    NAT             NAT             YES //but must not be behind the same NAT
    NAT             no NAT          YES
    no NAT          no NAT          YES
    SNAT            no NAT          YES //Switch B must be the listener
    SNAT            NAT/SNAT        NO  //almost impossible


## dial( end_name )

    telehash.dial( '@telehash' );
    
Will dial once to find the closest switches to that end_name. (end_name is the plain text, not its hash)

## announce(end_name, signals )

    telehash.announce( '@telehash', {'+foo':'abcd...'} );
    
Will send signals into the network aimed at the end_name. (end_name is the plain text name of the end, not its hash)

## tap(end_name, rule, function(){} )

    telehash.tap( '@telehash', {...}, function(sw,telex){} )
    
Will send a .tap request to the switches closest to end_name for signals expressed in a single rule. When switches forward telexes to us matching the tap rule the callback function is fired with a copy of the telex.

## send(to, telex)

    telehash.send('1.2.3.4:56789', {'+end':'1a2b3c...'} );
    
Send will send a telex directly to a switch given by it's ip:port.

see the wall.js example for example of all the low-level functions.

## Notes

The code produces alot of debug output so I suggest you redirect the stderr to /dev/null while running.
For reliable NAT detection we use node.js's os.networkInterfaces() wich is not yet implemented for windows.

## TODO


## Refrence
    TeleHash.Org: http://telehash.org/
    official TeleHash github repo: https://github.com/quartzjer/TeleHash
    Locket Project: https://github.com/LockerProject/Locker


