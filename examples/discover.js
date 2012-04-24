var telehash = require("./telehash");

telehash.init({mode:3});//full switch mode

telehash.seed(function (err) {
    if (err) {
        console.log(err);
        return;
    }

    //we seed into the DHT and participate.. 
    console.log("__ SEEDED __");
});
