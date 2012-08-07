var process_exit = process.exit;
process.exit=exit;

var otr=require("otr");
var options = require("optimist").argv;
var fs = require("fs");
var path = require("path");
var prompt = require("prompt");

prompt.message="";
prompt.delimiter="";

prompt.start();

var oKeysFile;    
var oAccountName;
var oProtocol;
var oList=false;
var oGenerate=false;
var fileExists = false;
var user = new otr.UserState();
var key_generation_inprogress = false;

oKeysFile = options.f ? options.f.toString() : (options.file? options.file.toString() : "~/.purple/otr.private_key");
oAccountName = options.a ? options.a.toString() : (options.accountname? options.accountname.toString() : undefined );
oProtocol = options.p ? options.p.toString() : (options.protocol? options.protocol.toString() : undefined );
oList = options.l || options.list;
oGenerate = options.g || options.generate;

if(options.h || options.help){
    usage();
    exit();
}

//if(fs.exists(oKeysFile)){   //-->nodejs v0.8+
if(path.existsSync(oKeysFile)){
    fileExists=true;
    try{
        user.readKeysSync(oKeysFile);
    }catch(e){        
        console.log("corrupt file:".red, oKeysFile, e);        
        exit();
    }
}

if(oList){
    if(!fileExists){
        console.log("File: ",oKeysFile,"doesn't exist.".red);
    }else{
        if(oAccountName && oProtocol){
            var fp = user.fingerprint(oAccountName,oProtocol);
            if(fp){ 
                console.log(oProtocol+":"+oAccountName,"fingerprint:",fp); 
            }else console.log("specified account not found.");
            
        }else{
            if(user.accounts().length){
                user.accounts().forEach(function(acc){
                    console.log(acc.fingerprint.yellow, (acc.protocol+":"+acc.accountname).green );
                });            
            }else console.log("No accounts found in",oKeysFile);
        }        
    }
    exit();
}else if(oGenerate){
    if(!oAccountName || !oProtocol) {
        console.error("Cannot generate keypair. Please specify both accountname and protocol.");
        usagehint();
        exit();
    }else{
        if(user.fingerprint(oAccountName,oProtocol)){
            //keypair already exists..
            console.log("A keypair already exists for specified account.".yellow);
            console.log("Generating a new keypair will overwrite the existing one.");
            prompt.confirm("Do you wish to proceed [Y/n]?",function(err,result){                
                if(err) exit();                
                if(result){
                    generate_key();
                }else exit();
            });
            
        }else{
            generate_key();        
        }
    }    
}else{
    console.log("No action specified.".grey);
    usagehint();
    exit();
}


function usagehint(){
    console.log("For help, type:",options.$0,"-h");
}

function usage(){
    console.log("Usage: ",options.$0, "[OPTION] [ACTION]");
    console.log("Manage your OTR keys. Default file location is ~/.purple/otr.private_key (Pidgin)\n");
    console.log("options:");
    console.log("  -f, --file\t\tpath to file containing otr keys");
    console.log("  -a, --accountname\taccountname");
    console.log("  -p, --protocol\tprotocol");
    console.log("actions:");
    console.log("  -l, --list\t\tdisplays public key fingerprint of specified account/protocol.[all if not specified]");
    console.log("  -g, --generate\tgenerate keypair for specified accountname/protocol.");    
    console.log
}

function generate_key(){
    key_generation_inprogress=true;
    console.log("Generating OTR keypair for account:", oProtocol+":"+oAccountName);
    console.log("Target file:",oKeysFile);
    console.log("This will take a few minutes...".yellow);
    //todo: make a backup file in case anything goes wrong or process terminates during key generation..
    user.generateKey(oKeysFile,oAccountName,oProtocol,function(err){
        key_generation_inprogress=false;
	    if(!err){
	     console.log("Key Generated Successfully".green);
	    }else{
	     console.log(err);
	    }
	    exit();
    });
}

function exit(val){
    if(key_generation_inprogress) {
        console.log("Please wait until key generation is complete".yellow);
        return;
    }
    prompt.pause();
    process_exit(val);
}
