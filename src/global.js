let mod = {};
Util = require (`./util`);
module.exports = mod;


mod.BB = function (x) {
    console.log(JSON.stringify(x, null, 2));
};

mod.execute = function () {



    return true;

};

mod.consoleMe = function () {

    console.log(`global`);
    Util.consoleMe();

};

mod.initMemory = function () {

    Object.keys(Memory).forEach(segment => {

        console.log(segment);

        delete Memory[segment];

    });

};

