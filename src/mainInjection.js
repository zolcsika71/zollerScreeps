// Override functions into this module to execute functions in main flow
let mod = {};
module.exports = mod;
mod.extend = function(){
    console.log("mainInjection.extend");
};
//mod.flush = function(){};
//mod.analyze = function(){};
//mod.register = function(){};
//mod.execute = function(){};
//mod.cleanup = function(){};