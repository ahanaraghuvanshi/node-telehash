# Overview - TeleHash


# Telehash Node.js module

* Based on the original code from: Note: https://github.com/quartzjer/node-telehash by Jeremie Miller.
* Everything works but it is still alpha.

This module provides a simple high-level API for using TeleHash. Currently it has the following basic functions:

    high-level: listen(), connect()
    low-level: dial(), announce(), tap(), send()
    

## High Level Functions

## listen()

    var telehash = require("./telehash");
    telehash.seed( function(err){
        telehash.listen({ id: 'echo' },
            function ( request ) {
                console.log(request.message);
            }
        );
    });


This will seed you into the DHT and actively wait for any connect requests sent to the provided id (in this example: 'echo'). A request object 'request' is returned upon receiving a request which contains a 'message' (string or JSON object), a reply can be sent with:

    request.reply( {...} );//the reply can be a string or JSON object.


See listen.js for a detailed example.

## connect()

    var telehash = require("./telehash");
    telehash.seed( function(err){
        var connector = telehash.connect( 'echo' );      
        connector.send( 'TeleHash Rocks!', function(response){
            console.log( response.message );
        });      
    });

The connect() function will return a connector object. In the background the connector will use the DHT to find anyone listening to 'echo'. Using the connector's send function we can then send actual messages (as a sting or JSON object) to the listeners. Replies will fire the callback function, with a response object (which contains the message).

See connect.js for a detailed example.

## Channels: Module based on Connect and Listen functions:

Using the basic *connect* and *listen* functions a *channels* module is implemented to establish a peer-to-peer UDP *session/channel* between two switches.
(Current implementation uses Out-of-Band channel over the underlying switch UDP socket)

## Channels.Listen()

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

## Channels:Connect()

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
It is upto you however to implement peer trust/authentication etc. (Anyone can listen for hash)

see the channel-listen.js and channel-connect.js for simple examples.
see alice.js and bob.js for more advanced example which illustrates the behaviour of channels better.

Channels can only work under certain conditions relating to the type of NAT a peer is operating behind of. See table below:

    Switch A        Switch B        Channel can be opened?
    NAT             NAT             YES //but must not be behind same NAT
    NAT             no NAT          YES
    no NAT          no NAT          YES
    SNAT            no NAT          YES //Switch B must be the listener
    SNAT            NAT/SNAT        NO  //almost impossible


## Low Level Functions


## Try it out..


The code produces alot of debug output so I suggest you redirect the stderr to /dev/null while running.
For reliable NAT detection we use node.js's os.networkInterfaces() wich is not yet implemented for windows.


## TODO

## Refrence

## Notes


