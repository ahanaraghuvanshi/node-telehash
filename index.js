module.exports.iputil = require('./lib/iputil.js');
module.exports.udplib = require('./lib/udplib.js');

module.exports.v1 = {
    "telehash":require('./lib/v1/telehash.js'),
    "switch": require('./lib/v1/switch.js'),
    "hash":require('./lib/v1/hash.js'),
    "channels":require('./lib/v1/channels.js')
};

//module.exports.v2
